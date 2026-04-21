"use client";

import {
  apiWsOnOpen,
  apiWsSend,
  apiWsSendIfOpen,
  apiWsSubscribe,
} from "@/lib/api-ws";
import { getCookie } from "@/lib/cookies";
import { useCallback, useEffect, useRef, useState } from "react";

type CallState = "idle" | "incoming" | "outgoing" | "connecting" | "active" | "error";
export type { CallState };

export type CallSummaryStatus = "completed" | "declined" | "canceled" | "failed";

export interface CallSummary {
  status: CallSummaryStatus;
  durationSeconds: number;
  endedAt: number;
}

interface UseDirectCallParams {
  enabled: boolean;
  conversationId: string;
  onCallSummary?: (summary: CallSummary) => void;
}

interface CallSignalPayload {
  type?: string;
  sdp?: string;
  candidate?: string;
  sdpMid?: string;
  sdpMLineIndex?: number;
  securityMaterial?: string;
  reason?: string;
  conversationId?: string;
}

interface PendingOfferSignal {
  sdp: string;
  securityMaterial: string | null;
}

function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    {
      urls: ["stun:stun.l.google.com:19302"],
    },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL?.trim();
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim();

  if (turnUrl && turnUsername && turnCredential) {
    servers.push({
      urls: turnUrl.split(",").map((entry) => entry.trim()).filter(Boolean),
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return servers;
}

function createSecurityMaterialSeed() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `seed-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractSdpFingerprint(sdp?: string | null) {
  if (!sdp) return null;

  const match = sdp.match(/^a=fingerprint:\s*([^\r\n]+)$/im);
  return match?.[1]?.trim().toLowerCase() ?? null;
}

function resolveSecurityMaterial(params: {
  localFingerprint: string | null;
  remoteFingerprint: string | null;
  fallbackMaterial: string | null;
}) {
  const { localFingerprint, remoteFingerprint, fallbackMaterial } = params;

  if (localFingerprint && remoteFingerprint) {
    const [first, second] = [localFingerprint, remoteFingerprint].sort((left, right) =>
      left.localeCompare(right),
    );
    return `dtls:${first}|${second}`;
  }

  return fallbackMaterial;
}

export function useDirectCall({
  enabled,
  conversationId,
  onCallSummary,
}: UseDirectCallParams) {
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [securityMaterial, setSecurityMaterial] = useState<string | null>(null);
  const stateRef = useRef<CallState>("idle");
  const isSignalSubscribedRef = useRef(false);
  const pendingSignalsRef = useRef<Array<Record<string, unknown>>>([]);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingOfferRef = useRef<PendingOfferSignal | null>(null);
  const localFingerprintRef = useRef<string | null>(null);
  const remoteFingerprintRef = useRef<string | null>(null);
  const fallbackSecurityMaterialRef = useRef<string | null>(null);
  const isCallerRef = useRef(false);
  const connectedAtMsRef = useRef<number | null>(null);
  const summarySentRef = useRef(false);
  const onCallSummaryRef = useRef<typeof onCallSummary>(onCallSummary);

  useEffect(() => {
    onCallSummaryRef.current = onCallSummary;
  }, [onCallSummary]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const syncSecurityMaterial = useCallback(() => {
    setSecurityMaterial(
      resolveSecurityMaterial({
        localFingerprint: localFingerprintRef.current,
        remoteFingerprint: remoteFingerprintRef.current,
        fallbackMaterial: fallbackSecurityMaterialRef.current,
      }),
    );
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }

    pendingOfferRef.current = null;
    localFingerprintRef.current = null;
    remoteFingerprintRef.current = null;
    fallbackSecurityMaterialRef.current = null;
  }, []);

  const resetCallSessionState = useCallback(() => {
    isCallerRef.current = false;
    connectedAtMsRef.current = null;
    summarySentRef.current = false;
  }, []);

  const emitCallSummary = useCallback((status: CallSummaryStatus) => {
    if (!isCallerRef.current || summarySentRef.current) {
      return;
    }

    const endedAt = Date.now();
    const durationSeconds = connectedAtMsRef.current
      ? Math.max(0, Math.floor((endedAt - connectedAtMsRef.current) / 1000))
      : 0;

    summarySentRef.current = true;
    onCallSummaryRef.current?.({
      status,
      durationSeconds,
      endedAt,
    });
  }, []);

  const stopRingtone = useCallback(() => {
    const ringtoneAudio = ringtoneAudioRef.current;
    if (!ringtoneAudio) return;

    ringtoneAudio.pause();
    ringtoneAudio.currentTime = 0;
  }, []);

  const flushPendingSignals = useCallback(() => {
    if (!isSignalSubscribedRef.current) {
      return;
    }

    const queue = pendingSignalsRef.current.splice(0, pendingSignalsRef.current.length);
    queue.forEach((payload) => {
      apiWsSendIfOpen(payload);
    });
  }, []);

  const ensureSignalSocketReady = useCallback(async () => {
    if (isSignalSubscribedRef.current) {
      flushPendingSignals();
      return true;
    }

    const token = getCookie("accessToken");
    if (!enabled || !conversationId || !token) return false;

    try {
      await apiWsSend({
        type: "call.subscribe",
        conversationId,
        token,
      });
      isSignalSubscribedRef.current = true;
      flushPendingSignals();
      return true;
    } catch {
      return false;
    }
  }, [conversationId, enabled, flushPendingSignals]);

  const sendSignal = useCallback((payload: Record<string, unknown>) => {
    if (isSignalSubscribedRef.current && apiWsSendIfOpen(payload)) {
      return true;
    }

    pendingSignalsRef.current.push(payload);
    void ensureSignalSocketReady();
    return true;
  }, [ensureSignalSocketReady]);

  const ensurePeerConnection = useCallback(() => {
    if (peerRef.current) {
      return peerRef.current;
    }

    const peerConnection = new RTCPeerConnection({
      // WebRTC media channels are encrypted by default via DTLS-SRTP.
      iceServers: getIceServers(),
    });

    peerConnection.onicecandidate = (event) => {
      const candidate = event.candidate;
      if (!candidate) {
        return;
      }

      sendSignal({
        type: "call.ice",
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
      });
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;

      if (!remoteAudioRef.current) {
        remoteAudioRef.current = new Audio();
        remoteAudioRef.current.autoplay = true;
      }

      remoteAudioRef.current.srcObject = stream;
      void remoteAudioRef.current.play().catch(() => undefined);
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerRef.current !== peerConnection) {
        return;
      }

      if (peerConnection.connectionState === "connected") {
        if (!connectedAtMsRef.current) {
          connectedAtMsRef.current = Date.now();
        }

        setState((currentState) => {
          if (currentState === "idle" || currentState === "error") {
            return currentState;
          }

          return "active";
        });
        return;
      }

      if (
        peerConnection.connectionState === "failed" ||
        peerConnection.connectionState === "disconnected" ||
        peerConnection.connectionState === "closed"
      ) {
        emitCallSummary("failed");
        cleanupPeerConnection();
        resetCallSessionState();
        setSecurityMaterial(null);
        setState("idle");
      }
    };

    peerRef.current = peerConnection;
    return peerConnection;
  }, [cleanupPeerConnection, emitCallSummary, resetCallSessionState, sendSignal]);

  const ensureLocalAudio = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    localStreamRef.current = stream;
    return stream;
  }, []);

  const attachLocalTracks = useCallback(async () => {
    const peerConnection = ensurePeerConnection();
    const stream = await ensureLocalAudio();
    const existingTrackIds = new Set(peerConnection.getSenders().map((sender) => sender.track?.id));

    stream.getTracks().forEach((track) => {
      if (existingTrackIds.has(track.id)) return;
      peerConnection.addTrack(track, stream);
    });

    return peerConnection;
  }, [ensureLocalAudio, ensurePeerConnection]);

  const handleCallSignal = useCallback(
    async (payload: CallSignalPayload) => {
      if (!payload.type) return;

      if (payload.type === "call.offer" && payload.sdp) {
        isCallerRef.current = false;
        connectedAtMsRef.current = null;
        summarySentRef.current = false;
        const nextSecurityMaterial =
          payload.securityMaterial?.trim() || createSecurityMaterialSeed();

        pendingOfferRef.current = {
          sdp: payload.sdp,
          securityMaterial: nextSecurityMaterial,
        };
        remoteFingerprintRef.current = extractSdpFingerprint(payload.sdp);
        fallbackSecurityMaterialRef.current = nextSecurityMaterial;
        syncSecurityMaterial();
        setState("incoming");
        return;
      }

      if (payload.type === "call.answer" && payload.sdp && peerRef.current) {
        await peerRef.current.setRemoteDescription({
          type: "answer",
          sdp: payload.sdp,
        });
        remoteFingerprintRef.current = extractSdpFingerprint(payload.sdp);
        if (payload.securityMaterial?.trim()) {
          fallbackSecurityMaterialRef.current = payload.securityMaterial.trim();
        }
        syncSecurityMaterial();
        setState("connecting");
        return;
      }

      if (payload.type === "call.ice" && payload.candidate && peerRef.current) {
        await peerRef.current.addIceCandidate({
          candidate: payload.candidate,
          sdpMid: payload.sdpMid,
          sdpMLineIndex: payload.sdpMLineIndex,
        });
        return;
      }

      if (payload.type === "call.end") {
        const isCallAccepted = Boolean(connectedAtMsRef.current);
        const normalizedReason = (payload.reason ?? "").toLowerCase();
        const status: CallSummaryStatus =
          normalizedReason === "rejected" || normalizedReason === "declined"
            ? "declined"
            : isCallAccepted || stateRef.current === "active"
              ? "completed"
              : "canceled";

        emitCallSummary(status);
        cleanupPeerConnection();
        resetCallSessionState();
        setSecurityMaterial(null);
        setState("idle");
      }
    },
    [cleanupPeerConnection, emitCallSummary, resetCallSessionState, syncSecurityMaterial],
  );

  const startCall = useCallback(async () => {
    try {
      setError(null);
      const socketReady = await ensureSignalSocketReady();
      if (!socketReady) {
        throw new Error("Call signaling is not connected yet");
      }

      isCallerRef.current = true;
      connectedAtMsRef.current = null;
      summarySentRef.current = false;
      const nextSecurityMaterial = createSecurityMaterialSeed();
      fallbackSecurityMaterialRef.current = nextSecurityMaterial;
      const peerConnection = await attachLocalTracks();
      const offer = await peerConnection.createOffer();

      await peerConnection.setLocalDescription(offer);
      localFingerprintRef.current = extractSdpFingerprint(offer.sdp);
      syncSecurityMaterial();
      sendSignal({
        type: "call.offer",
        sdp: offer.sdp,
        securityMaterial: nextSecurityMaterial,
      });
      setState("outgoing");
    } catch (nextError) {
      cleanupPeerConnection();
      resetCallSessionState();
      setState("error");
      setError(nextError instanceof Error ? nextError.message : "Failed to start call");
    }
  }, [
    attachLocalTracks,
    cleanupPeerConnection,
    ensureSignalSocketReady,
    resetCallSessionState,
    sendSignal,
    syncSecurityMaterial,
  ]);

  const acceptIncomingCall = useCallback(async () => {
    const pendingOffer = pendingOfferRef.current;
    if (!pendingOffer) return;

    try {
      setError(null);
      fallbackSecurityMaterialRef.current = pendingOffer.securityMaterial;
      const peerConnection = await attachLocalTracks();
      await peerConnection.setRemoteDescription({
        type: "offer",
        sdp: pendingOffer.sdp,
      });
      remoteFingerprintRef.current = extractSdpFingerprint(pendingOffer.sdp);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      localFingerprintRef.current = extractSdpFingerprint(answer.sdp);
      syncSecurityMaterial();
      sendSignal({
        type: "call.answer",
        sdp: answer.sdp,
        securityMaterial: fallbackSecurityMaterialRef.current,
      });
      pendingOfferRef.current = null;
      setState("connecting");
    } catch (nextError) {
      cleanupPeerConnection();
      setState("error");
      setError(nextError instanceof Error ? nextError.message : "Failed to accept call");
    }
  }, [attachLocalTracks, cleanupPeerConnection, sendSignal, syncSecurityMaterial]);

  const rejectIncomingCall = useCallback(() => {
    pendingOfferRef.current = null;
    fallbackSecurityMaterialRef.current = null;
    remoteFingerprintRef.current = null;
    localFingerprintRef.current = null;
    resetCallSessionState();
    setSecurityMaterial(null);
    sendSignal({
      type: "call.end",
      reason: "rejected",
    });
    setState("idle");
  }, [resetCallSessionState, sendSignal]);

  const endCall = useCallback(() => {
    emitCallSummary(
      connectedAtMsRef.current || stateRef.current === "active" ? "completed" : "canceled",
    );
    sendSignal({
      type: "call.end",
      reason: "ended",
    });
    cleanupPeerConnection();
    resetCallSessionState();
    setSecurityMaterial(null);
    setState("idle");
  }, [cleanupPeerConnection, emitCallSummary, resetCallSessionState, sendSignal]);

  const dismissError = useCallback(() => {
    setError(null);
    if (state === "error") {
      setSecurityMaterial(null);
      resetCallSessionState();
      setState("idle");
    }
  }, [resetCallSessionState, state]);

  useEffect(() => {
    if (state !== "incoming") {
      stopRingtone();
      return;
    }

    if (!ringtoneAudioRef.current) {
      const ringtoneAudio = new Audio("/assets/audio/ringtone.mp3");
      ringtoneAudio.loop = true;
      ringtoneAudio.preload = "auto";
      ringtoneAudioRef.current = ringtoneAudio;
    }

    const ringtoneAudio = ringtoneAudioRef.current;
    if (!ringtoneAudio) return;

    const playPromise = ringtoneAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      void playPromise.catch(() => undefined);
    }

    return () => {
      stopRingtone();
    };
  }, [state, stopRingtone]);

  useEffect(() => {
    if (!enabled || !conversationId) {
      isSignalSubscribedRef.current = false;
      pendingSignalsRef.current = [];
      stopRingtone();
      cleanupPeerConnection();
      resetCallSessionState();
      return;
    }

    const token = getCookie("accessToken");
    if (!token) {
      return;
    }

    const subscribeToCall = () =>
      apiWsSend({
        type: "call.subscribe",
        conversationId,
        token,
      })
        .then(() => {
          isSignalSubscribedRef.current = true;
          flushPendingSignals();
        })
        .catch(() => {
          isSignalSubscribedRef.current = false;
          setState("error");
          setError("Call signaling connection failed");
        });

    const unsubscribeFromEvents = apiWsSubscribe((payload) => {
      const signal = payload as CallSignalPayload;
      if (
        signal.conversationId &&
        signal.conversationId !== conversationId
      ) {
        return;
      }

      if (
        signal.type !== "call.offer" &&
        signal.type !== "call.answer" &&
        signal.type !== "call.ice" &&
        signal.type !== "call.end"
      ) {
        return;
      }

      void handleCallSignal(signal);
    });

    void subscribeToCall();
    const unsubscribeFromOpen = apiWsOnOpen(subscribeToCall);

    if (isSignalSubscribedRef.current) {
      flushPendingSignals();
    }

    return () => {
      unsubscribeFromEvents();
      unsubscribeFromOpen();
      apiWsSendIfOpen({ type: "call.unsubscribe" });
      isSignalSubscribedRef.current = false;
      pendingSignalsRef.current = [];
      stopRingtone();
      cleanupPeerConnection();
      resetCallSessionState();
      setSecurityMaterial(null);
      setState("idle");
    };
  }, [
    cleanupPeerConnection,
    conversationId,
    enabled,
    flushPendingSignals,
    handleCallSignal,
    resetCallSessionState,
    stopRingtone,
  ]);

  return {
    state,
    error,
    securityMaterial,
    startCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    dismissError,
    isIncoming: state === "incoming",
    isInCall:
      state === "outgoing" ||
      state === "connecting" ||
      state === "active",
  };
}
