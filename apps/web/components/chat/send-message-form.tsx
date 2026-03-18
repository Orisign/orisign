"use client";
/* eslint-disable @next/next/no-img-element */

import {
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  SendMessageRequestDtoKind,
  getConversationsControllerMyQueryKey,
  useMessagesControllerEdit,
  useMessagesControllerSend,
} from "@/api/generated";
import {
  sendMessageSchema,
  TypeSendMessageSchema,
} from "@/schemas/chat/send-message.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Field,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  toast,
} from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { HiPaperAirplane } from "react-icons/hi2";
import { FiFileText, FiPaperclip, FiVideo, FiX } from "react-icons/fi";
import { TiMicrophone } from "react-icons/ti";
import { EmojiInput } from "@/components/ui/emoji-input";
import { useTranslations } from "next-intl";
import {
  type ChatMessagesQueryData,
  bumpConversationInListData,
  bumpConversationQueryData,
  getChatMessagesQueryKey,
  getConversationQueryKey,
} from "@/hooks/use-chat";
import { playChatSound } from "@/lib/chat-sound-manager";
import { cn } from "@/lib/utils";
import {
  replyPanelVariants,
  swapYVariants,
} from "@/lib/animations";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";
import { getMediaLabel } from "@/lib/chat";
import {
  deleteConversationMedia,
  uploadConversationMedia,
} from "@/lib/upload-conversation-media";
import { ApiError } from "@/lib/fetcher";

import { AnimatePresence, motion } from "motion/react";
import type { ChatEditTarget, ChatReplyTarget } from "./chat.types";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl: string | null;
  uploadedKey: string | null;
  mediaKind: "messages" | "voice" | "ring";
  progress: number;
  status: "pending" | "uploading" | "uploaded" | "error";
};

function createAttachmentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/");
}

function formatRecordDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function pickVoiceRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const preferredTypes = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm",
    "audio/ogg",
  ];

  return preferredTypes.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function pickRingRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const preferredTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=h264,opus",
    "video/webm",
  ];

  return preferredTypes.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function createRecordedFileFromBlob(
  blob: Blob,
  mode: "voice" | "ring",
) {
  const fallbackType = mode === "voice" ? "audio/webm" : "video/webm";
  const normalizedType = blob.type || fallbackType;

  const extension = normalizedType.includes("ogg")
    ? "ogg"
    : normalizedType.includes("mp4")
      ? (mode === "voice" ? "m4a" : "mp4")
      : "webm";

  const prefix = mode === "voice" ? "voice" : "ring";

  return new File(
    [blob],
    `${prefix}-${Date.now()}.${extension}`,
    { type: normalizedType },
  );
}


export function SendMessageForm({
  conversationId,
  isBlockedByCurrentUser = false,
  isBlockedByPeer = false,
  replyTarget,
  editTarget,
  onCancelReply,
  onCancelEdit,
  onTypingStateChange,
  onUploadingMediaStateChange,
}: {
  conversationId: string;
  isBlockedByCurrentUser?: boolean;
  isBlockedByPeer?: boolean;
  replyTarget: ChatReplyTarget | null;
  editTarget: ChatEditTarget | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onTypingStateChange?: (active: boolean) => void;
  onUploadingMediaStateChange?: (active: boolean) => void;
}) {
  const t = useTranslations("chat.sendMessageForm");
  const form = useForm<TypeSendMessageSchema>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: {
      text: "",
      replyToId: "",
    },
  });
  const queryClient = useQueryClient();
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const ringPreviewRef = useRef<HTMLVideoElement | null>(null);
  const attachmentsRef = useRef<PendingAttachment[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const activeRecordingModeRef = useRef<"voice" | "ring" | null>(null);
  const holdToRecordTimeoutRef = useRef<number | null>(null);
  const recordPointerStartYRef = useRef<number | null>(null);
  const isRecordLockCandidateRef = useRef(false);
  const recordActionInFlightRef = useRef(false);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingAnimationFrameRef = useRef<number | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const recordingAnalyserRef = useRef<AnalyserNode | null>(null);
  const recordProbeArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isUploadingRecordedMedia, setIsUploadingRecordedMedia] = useState(false);
  const [recordedMediaUploadProgress, setRecordedMediaUploadProgress] = useState<number | null>(null);
  const [recordMode, setRecordMode] = useState<"voice" | "ring">("voice");
  const [activeRecordingMode, setActiveRecordingMode] = useState<"voice" | "ring" | null>(null);
  const [recordGestureState, setRecordGestureState] = useState<
    "idle" | "holding" | "recording"
  >("idle");
  const [isRecordLocked, setIsRecordLocked] = useState(false);
  const [isRecordLockCandidate, setIsRecordLockCandidate] = useState(false);
  const [recordStartedAt, setRecordStartedAt] = useState<number | null>(null);
  const [recordElapsedSeconds, setRecordElapsedSeconds] = useState(0);
  const [recordLiveBars, setRecordLiveBars] = useState<number[]>(
    () => Array.from({ length: 24 }, () => 30),
  );

  const { mutateAsync: sendMessage, isPending: isSendingMessage } = useMessagesControllerSend({
    mutation: {
      onSuccess: async () => {
        form.reset();
        onCancelReply();
        onCancelEdit();
        setAttachments((currentAttachments) => {
          currentAttachments.forEach((attachment) => {
            if (attachment.previewUrl) {
              URL.revokeObjectURL(attachment.previewUrl);
            }
          });
          return [];
        });

        const nextTimestamp = Date.now();

        queryClient.setQueryData<GetConversationResponseDto>(
          getConversationQueryKey(conversationId),
          (currentData) => bumpConversationQueryData(currentData, nextTimestamp),
        );

        queryClient.setQueriesData<ListMyConversationsResponseDto>(
          { queryKey: getConversationsControllerMyQueryKey() },
          (currentData) =>
            bumpConversationInListData(currentData, conversationId, nextTimestamp),
        );
      },
      onError: (error) => {
        const errorMessage =
          error instanceof ApiError &&
          error.body &&
          typeof error.body === "object"
            ? String(
                (error.body as Record<string, unknown>).details ??
                  (error.body as Record<string, unknown>).message ??
                  "",
              )
            : (error instanceof Error ? error.message : "");
        const isBlockedError = errorMessage.toLowerCase().includes("block");

        toast({
          title: isBlockedError ? t("blockedByPeerHint") : t("sendError"),
          type: "error",
        });
      },
    },
  });
  const { mutate: editMessage } = useMessagesControllerEdit({
    mutation: {
      onSuccess: async (_data, variables) => {
        const nextTimestamp = Date.now();
        const nextText = variables.data.text.trim();
        const messageId = variables.data.messageId;

        queryClient.setQueryData<ChatMessagesQueryData>(
          getChatMessagesQueryKey(conversationId),
          (currentData) => {
            if (!currentData) return currentData;

            return {
              messages: currentData.messages.map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      text: nextText,
                      editedAt: nextTimestamp,
                    }
                  : message,
              ),
            };
          },
        );

        queryClient.setQueryData<GetConversationResponseDto>(
          getConversationQueryKey(conversationId),
          (currentData) => bumpConversationQueryData(currentData, nextTimestamp),
        );

        queryClient.setQueriesData<ListMyConversationsResponseDto>(
          { queryKey: getConversationsControllerMyQueryKey() },
          (currentData) =>
            bumpConversationInListData(currentData, conversationId, nextTimestamp),
        );

        form.reset({
          text: "",
          replyToId: "",
        });
        onCancelEdit();
      },
    },
  });

  const textValue = useWatch({
    control: form.control,
    name: "text",
    defaultValue: "",
  });

  const replyToIdValue = useWatch({
    control: form.control,
    name: "replyToId",
    defaultValue: "",
  });

  const isEditing = Boolean(editTarget);
  const sendShortcut = useGeneralSettingsStore((state) => state.sendShortcut);
  const isReplying = !isEditing && Boolean(replyTarget && replyToIdValue);
  const hasUploadingAttachments = attachments.some(
    (attachment) => attachment.status === "uploading",
  );
  const hasErroredAttachments = attachments.some(
    (attachment) => attachment.status === "error",
  );
  const hasAttachedMedia = attachments.length > 0;
  const isBusyComposer = isSendingMessage || isUploadingRecordedMedia;
  const isRecordHolding = recordGestureState === "holding";
  const isRecording = recordGestureState === "recording";
  const isVideoRecording = isRecording && activeRecordingMode === "ring";
  const isTypingStateActive =
    textValue.trim().length > 0 &&
    !isBlockedByCurrentUser &&
    !isBlockedByPeer &&
    !isBusyComposer &&
    !isRecording;
  const isUploadingMediaStateActive =
    (hasUploadingAttachments || isUploadingRecordedMedia) &&
    !isBlockedByCurrentUser &&
    !isBlockedByPeer;
  const canShowRecordControl =
    textValue.trim().length === 0 &&
    !isEditing &&
    !hasAttachedMedia &&
    !isBlockedByCurrentUser &&
    !isBlockedByPeer &&
    !hasUploadingAttachments &&
    !hasErroredAttachments &&
    !isUploadingRecordedMedia;
  const canSubmit =
    (textValue.trim().length > 0 || hasAttachedMedia || isEditing) &&
    !hasUploadingAttachments &&
    !isBlockedByCurrentUser &&
    !isBlockedByPeer &&
    !hasErroredAttachments &&
    !isBusyComposer;
  const inputFocusToken = isEditing
    ? `edit:${editTarget?.id ?? ""}`
    : (replyTarget?.id ?? null);
  const isLockZoneVisible = (isRecordHolding || isRecording) && !isRecordLocked;
  const recordBars = recordLiveBars.length > 0
    ? recordLiveBars
    : Array.from({ length: 24 }, () => 30);
  const deferredRecordBars = useDeferredValue(recordBars);

  useEffect(() => {
    onTypingStateChange?.(isTypingStateActive);
  }, [isTypingStateActive, onTypingStateChange]);

  useEffect(() => {
    onUploadingMediaStateChange?.(isUploadingMediaStateActive);
  }, [isUploadingMediaStateActive, onUploadingMediaStateChange]);

  useEffect(
    () => () => {
      onTypingStateChange?.(false);
      onUploadingMediaStateChange?.(false);
    },
    [onTypingStateChange, onUploadingMediaStateChange],
  );

  function resetRecordingVisuals() {
    setRecordLiveBars(Array.from({ length: 24 }, () => 30));
  }

  function stopRecordingVisualiser() {
    if (recordingAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(recordingAnimationFrameRef.current);
      recordingAnimationFrameRef.current = null;
    }

    if (recordingAudioContextRef.current) {
      void recordingAudioContextRef.current.close().catch(() => undefined);
      recordingAudioContextRef.current = null;
    }

    recordingAnalyserRef.current = null;
    recordProbeArrayRef.current = null;
    resetRecordingVisuals();
  }

  function startRecordingVisualiser(stream: MediaStream) {
    stopRecordingVisualiser();

    const AudioContextConstructor = window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) {
      return;
    }

    const context = new AudioContextConstructor();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);

    const probe = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    recordingAudioContextRef.current = context;
    recordingAnalyserRef.current = analyser;
    recordProbeArrayRef.current = probe;

    const tick = () => {
      const activeAnalyser = recordingAnalyserRef.current;
      const activeProbe = recordProbeArrayRef.current;

      if (!activeAnalyser || !activeProbe) {
        return;
      }

      activeAnalyser.getByteFrequencyData(activeProbe);

      const bars = Array.from({ length: 24 }, (_, index) => {
        const from = Math.floor((index / 24) * activeProbe.length);
        const to = Math.max(from + 1, Math.floor(((index + 1) / 24) * activeProbe.length));

        let max = 0;
        for (let probeIndex = from; probeIndex < to; probeIndex += 1) {
          max = Math.max(max, activeProbe[probeIndex] ?? 0);
        }

        return 22 + Math.round((max / 255) * 74);
      });

      setRecordLiveBars(bars);
      recordingAnimationFrameRef.current = window.requestAnimationFrame(tick);
    };

    recordingAnimationFrameRef.current = window.requestAnimationFrame(tick);
  }

  function resetRecordGestureState() {
    setRecordGestureState("idle");
    setIsRecordLocked(false);
    setIsRecordLockCandidate(false);
    recordPointerStartYRef.current = null;
    activeRecordingModeRef.current = null;
    setActiveRecordingMode(null);
    setRecordStartedAt(null);
    setRecordElapsedSeconds(0);
  }

  async function ensureVoiceRecorderStarted() {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast({
        title: t("recordUnsupported"),
        type: "error",
      });
      return false;
    }

    const activeRecorder = mediaRecorderRef.current;
    if (activeRecorder && activeRecorder.state !== "inactive") {
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      recordingStreamRef.current = stream;

      const recorderMimeType = pickVoiceRecorderMimeType();
      const recorder = recorderMimeType
        ? new MediaRecorder(stream, { mimeType: recorderMimeType })
        : new MediaRecorder(stream);

      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(160);
      activeRecordingModeRef.current = "voice";
      startRecordingVisualiser(stream);
      setActiveRecordingMode("voice");

      const startedAt = Date.now();
      setRecordStartedAt(startedAt);
      setRecordElapsedSeconds(0);

      return true;
    } catch {
      recordingStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
      recordingChunksRef.current = [];
      stopRecordingVisualiser();

      toast({
        title: t("recordPermissionError"),
        type: "error",
      });
      return false;
    }
  }

  function attachRingPreviewStream(stream: MediaStream | null) {
    const previewNode = ringPreviewRef.current;
    if (!previewNode) return;

    previewNode.srcObject = stream;
    if (stream) {
      void previewNode.play().catch(() => undefined);
    }
  }

  async function ensureRingRecorderStarted() {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast({
        title: t("recordUnsupported"),
        type: "error",
      });
      return false;
    }

    const activeRecorder = mediaRecorderRef.current;
    if (activeRecorder && activeRecorder.state !== "inactive") {
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
      });
      recordingStreamRef.current = stream;
      attachRingPreviewStream(stream);

      const recorderMimeType = pickRingRecorderMimeType();
      const recorder = recorderMimeType
        ? new MediaRecorder(stream, { mimeType: recorderMimeType })
        : new MediaRecorder(stream);

      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(160);
      activeRecordingModeRef.current = "ring";
      setActiveRecordingMode("ring");

      const startedAt = Date.now();
      setRecordStartedAt(startedAt);
      setRecordElapsedSeconds(0);
      setRecordLiveBars(Array.from({ length: 24 }, () => 30));

      return true;
    } catch {
      recordingStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
      activeRecordingModeRef.current = null;
      recordingChunksRef.current = [];
      attachRingPreviewStream(null);

      toast({
        title: t("recordPermissionError"),
        type: "error",
      });
      return false;
    }
  }

  async function stopActiveRecorder(discardRecording: boolean) {
    const recorder = mediaRecorderRef.current;
    const stream = recordingStreamRef.current;
    const stoppedMode = activeRecordingModeRef.current ?? activeRecordingMode;

    const blobPromise = recorder && recorder.state !== "inactive"
      ? new Promise<Blob | null>((resolve) => {
          recorder.addEventListener(
            "stop",
            () => {
              const chunks = [...recordingChunksRef.current];
              resolve(chunks.length > 0 ? new Blob(chunks, {
                type: recorder.mimeType || (stoppedMode === "ring" ? "video/webm" : "audio/webm"),
              }) : null);
            },
            { once: true },
          );
        })
      : Promise.resolve(
          recordingChunksRef.current.length > 0
            ? new Blob(recordingChunksRef.current, {
                type: recorder?.mimeType || (stoppedMode === "ring" ? "video/webm" : "audio/webm"),
              })
            : null,
        );

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    const blob = await blobPromise;

    stream?.getTracks().forEach((track) => {
      track.stop();
    });

    mediaRecorderRef.current = null;
    recordingStreamRef.current = null;
    activeRecordingModeRef.current = null;
    recordingChunksRef.current = [];
    attachRingPreviewStream(null);

    stopRecordingVisualiser();

    if (discardRecording || !blob || blob.size === 0) {
      return { file: null, mode: stoppedMode };
    }

    if (!stoppedMode) {
      return { file: null, mode: null };
    }

    return {
      file: createRecordedFileFromBlob(blob, stoppedMode),
      mode: stoppedMode,
    };
  }

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    form.setValue("replyToId", replyTarget?.id ?? "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [form, replyTarget]);

  useEffect(() => {
    if (!editTarget) return;

    form.setValue("replyToId", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue("text", editTarget.text ?? "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [editTarget, form]);

  useEffect(() => {
    return () => {
      if (holdToRecordTimeoutRef.current !== null) {
        window.clearTimeout(holdToRecordTimeoutRef.current);
        holdToRecordTimeoutRef.current = null;
      }
      recordPointerStartYRef.current = null;

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      recordingStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
      recordingChunksRef.current = [];
      attachRingPreviewStream(null);

      if (recordingAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(recordingAnimationFrameRef.current);
        recordingAnimationFrameRef.current = null;
      }

      if (recordingAudioContextRef.current) {
        void recordingAudioContextRef.current.close().catch(() => undefined);
        recordingAudioContextRef.current = null;
      }

      recordingAnalyserRef.current = null;
      recordProbeArrayRef.current = null;
      setActiveRecordingMode(null);
    };
  }, []);

  useEffect(() => {
    if (!isRecording || !recordStartedAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setRecordElapsedSeconds(Math.floor((Date.now() - recordStartedAt) / 1000));
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [isRecording, recordStartedAt]);

  useEffect(() => {
    if (!isVideoRecording) {
      attachRingPreviewStream(null);
      return;
    }

    if (recordingStreamRef.current) {
      attachRingPreviewStream(recordingStreamRef.current);
    }
  }, [isVideoRecording]);

  useEffect(() => {
    isRecordLockCandidateRef.current = isRecordLockCandidate;
  }, [isRecordLockCandidate]);

  async function handleRecordGestureCancel() {
    if (recordActionInFlightRef.current) return;

    clearHoldToRecordTimeout();

    recordActionInFlightRef.current = true;
    try {
      await stopActiveRecorder(true);
    } finally {
      resetRecordGestureState();
      recordActionInFlightRef.current = false;
    }
  }

  async function sendRecordedMedia(file: File, mode: "voice" | "ring") {
    if (!conversationId || isBlockedByCurrentUser || isBlockedByPeer || isBusyComposer) return;

    let uploadedKey: string | null = null;
    try {
      setIsUploadingRecordedMedia(true);
      setRecordedMediaUploadProgress(0);

      const uploaded = await uploadConversationMedia(
        file,
        (progress) => {
          setRecordedMediaUploadProgress(progress);
        },
        {
          mediaKind: mode,
          conversationId,
        },
      );
      uploadedKey = uploaded.key;

      playChatSound("send");

      await sendMessage({
        data: {
          conversationId,
          kind: SendMessageRequestDtoKind.NUMBER_2,
          text: undefined,
          replyToId: form.getValues("replyToId") || undefined,
          mediaKeys: [uploaded.key],
        },
      });
    } catch {
      if (uploadedKey) {
        await deleteConversationMedia(uploadedKey).catch(() => undefined);
      }
      toast({
        title: t("sendError"),
        type: "error",
      });
    } finally {
      setIsUploadingRecordedMedia(false);
      setRecordedMediaUploadProgress(null);
    }
  }

  async function handleRecordGestureFinish() {
    if (recordActionInFlightRef.current) return;

    clearHoldToRecordTimeout();

    recordActionInFlightRef.current = true;
    try {
      const { file, mode } = await stopActiveRecorder(false);
      resetRecordGestureState();

      if (!file || !mode) {
        return;
      }

      const minSize = mode === "ring" ? 8_000 : 3_500;
      if (file.size < minSize) {
        toast({
          title: t("recordingTooShort"),
          type: "error",
        });
        return;
      }

      await sendRecordedMedia(file, mode);
    } finally {
      recordActionInFlightRef.current = false;
    }
  }

  function clearHoldToRecordTimeout() {
    if (holdToRecordTimeoutRef.current !== null) {
      window.clearTimeout(holdToRecordTimeoutRef.current);
      holdToRecordTimeoutRef.current = null;
    }
  }

  function lockRecordingImmediately() {
    if (isRecordLocked) {
      return;
    }

    recordPointerStartYRef.current = null;
    setIsRecordLockCandidate(false);
    setIsRecordLocked(true);
    toast({
      title: t("recordingPinned"),
      type: "info",
    });
  }

  function handleRecordGestureStart(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!canShowRecordControl || isBusyComposer || recordGestureState !== "idle") return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    setIsRecordLocked(false);
    setRecordGestureState("holding");
    setIsRecordLockCandidate(false);
    recordPointerStartYRef.current = event.clientY;
    clearHoldToRecordTimeout();

    holdToRecordTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        const recorderStarted = recordMode === "ring"
          ? await ensureRingRecorderStarted()
          : await ensureVoiceRecorderStarted();
        holdToRecordTimeoutRef.current = null;

        if (!recorderStarted) {
          resetRecordGestureState();
          return;
        }

        setRecordGestureState("recording");
        if (isRecordLockCandidateRef.current) {
          lockRecordingImmediately();
        }
      })();
    }, 170);
  }

  function handleRecordGestureMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!isLockZoneVisible || isRecordLocked) return;
    if (recordPointerStartYRef.current === null) return;

    const deltaY = event.clientY - recordPointerStartYRef.current;
    const shouldLock = deltaY <= -96;
    setIsRecordLockCandidate(shouldLock);

    if (shouldLock && recordGestureState === "recording") {
      lockRecordingImmediately();
    }
  }

  function handleRecordGestureRelease() {
    clearHoldToRecordTimeout();

    if (recordGestureState === "holding") {
      recordPointerStartYRef.current = null;
      setIsRecordLockCandidate(false);
      setRecordGestureState("idle");
      setRecordMode((currentValue) =>
        currentValue === "voice" ? "ring" : "voice"
      );
      return;
    }

    if (recordGestureState !== "recording") {
      recordPointerStartYRef.current = null;
      setIsRecordLockCandidate(false);
      return;
    }

    if (isRecordLockCandidate) {
      lockRecordingImmediately();
      return;
    }

    recordPointerStartYRef.current = null;
    setIsRecordLockCandidate(false);
    if (!isRecordLocked) {
      void handleRecordGestureFinish();
    }
  }

  function handleRecordGesturePointerCancel() {
    clearHoldToRecordTimeout();
    recordPointerStartYRef.current = null;
    setIsRecordLockCandidate(false);

    if (recordGestureState === "recording" && !isRecordLocked) {
      void handleRecordGestureCancel();
      return;
    }

    if (recordGestureState === "holding") {
      setRecordGestureState("idle");
    }
  }

  const finishRecordGestureFromEffect = useEffectEvent(() => {
    void handleRecordGestureFinish();
  });

  useEffect(() => {
    if (!isVideoRecording || !recordStartedAt) {
      return;
    }

    const elapsed = Date.now() - recordStartedAt;
    const remaining = Math.max(0, 60_000 - elapsed);

    if (remaining === 0) {
      const immediateTimeout = window.setTimeout(() => {
        finishRecordGestureFromEffect();
      }, 0);
      return () => {
        window.clearTimeout(immediateTimeout);
      };
    }

    const timeout = window.setTimeout(() => {
      finishRecordGestureFromEffect();
    }, remaining);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isVideoRecording, recordStartedAt]);

  async function onSubmit(data: TypeSendMessageSchema) {
    const text = data.text.trim();

    if (!conversationId || isBlockedByCurrentUser || isBlockedByPeer) return;
    if (isBusyComposer) return;
    if (hasUploadingAttachments || hasErroredAttachments) return;
    if (!isEditing && text.length === 0 && !hasAttachedMedia) return;

    if (isEditing && editTarget?.id) {
      editMessage({
        data: {
          messageId: editTarget.id,
          text,
          conversationId,
        },
      });
      return;
    }

    let uploadedMediaKeys: string[] = [];

    try {
      if (hasAttachedMedia) {
        uploadedMediaKeys = await uploadPendingAttachments(attachments);
      }

      playChatSound("send");

      await sendMessage({
        data: {
          conversationId,
          kind: uploadedMediaKeys.length > 0
            ? SendMessageRequestDtoKind.NUMBER_2
            : SendMessageRequestDtoKind.NUMBER_1,
          text: text || undefined,
          replyToId: data.replyToId || undefined,
          mediaKeys: uploadedMediaKeys.length > 0 ? uploadedMediaKeys : undefined,
        },
      });
    } catch {
      if (uploadedMediaKeys.length > 0) {
        await Promise.allSettled(
          uploadedMediaKeys.map(async (key) => {
            await deleteConversationMedia(key);
          }),
        );

        setAttachments((currentAttachments) =>
          currentAttachments.map((attachment) =>
            attachment.uploadedKey && uploadedMediaKeys.includes(attachment.uploadedKey)
              ? {
                  ...attachment,
                  status: "pending",
                  progress: 0,
                  uploadedKey: null,
                }
              : attachment,
          ),
        );
      }
    }
  }

  function handleCancelReply() {
    form.setValue("replyToId", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    onCancelReply();
  }

  function handleCancelEdit() {
    form.reset({
      text: "",
      replyToId: "",
    });
    onCancelEdit();
  }

  async function uploadAttachment(attachment: PendingAttachment): Promise<string> {
    if (attachment.uploadedKey) {
      return attachment.uploadedKey;
    }

    const attachmentId = attachment.id;

    try {
      setAttachments((currentAttachments) =>
        currentAttachments.map((currentAttachment) =>
          currentAttachment.id === attachmentId
            ? {
                ...currentAttachment,
                progress: 0,
                status: "uploading",
              }
            : currentAttachment,
        ),
      );

      const uploaded = await uploadConversationMedia(attachment.file, (progress) => {
        setAttachments((currentAttachments) =>
          currentAttachments.map((currentAttachment) =>
            currentAttachment.id === attachmentId
              ? { ...currentAttachment, progress, status: "uploading" }
              : currentAttachment,
          ),
        );
      }, {
        mediaKind: attachment.mediaKind,
        conversationId: attachment.mediaKind === "messages" ? undefined : conversationId,
      });

      setAttachments((currentAttachments) =>
        currentAttachments.map((currentAttachment) =>
          currentAttachment.id === attachmentId
            ? {
                ...currentAttachment,
                progress: 100,
                status: "uploaded",
                uploadedKey: uploaded.key,
              }
            : currentAttachment,
        ),
      );

      return uploaded.key;
    } catch {
      setAttachments((currentAttachments) =>
        currentAttachments.map((currentAttachment) =>
          currentAttachment.id === attachmentId
            ? { ...currentAttachment, status: "error" }
            : currentAttachment,
        ),
      );
      throw new Error("Attachment upload failed");
    }
  }

  async function uploadPendingAttachments(sourceAttachments: PendingAttachment[]) {
    const snapshot = [...sourceAttachments];
    const uploadedKeys: string[] = [];

    for (const attachment of snapshot) {
      const uploadedKey = await uploadAttachment(attachment);
      uploadedKeys.push(uploadedKey);
    }

    return uploadedKeys;
  }

  function handleSelectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const nextAttachments: PendingAttachment[] = files.map((file) => ({
      id: createAttachmentId(),
      file,
      previewUrl: isImageFile(file) || isVideoFile(file) ? URL.createObjectURL(file) : null,
      uploadedKey: null,
      mediaKind: "messages",
      progress: 0,
      status: "pending",
    }));

    setAttachments((currentAttachments) => [...currentAttachments, ...nextAttachments]);

    event.currentTarget.value = "";
  }

  function handleRemoveAttachment(attachmentId: string) {
    setAttachments((currentAttachments) => {
      const attachment = currentAttachments.find((entry) => entry.id === attachmentId);
      if (!attachment) {
        return currentAttachments;
      }

      if (attachment?.uploadedKey) {
        void deleteConversationMedia(attachment.uploadedKey);
      }
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }

      return currentAttachments.filter((entry) => entry.id !== attachmentId);
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex items-end justify-center gap-2"
    >
      <div className="flex-1">
        {attachments.length > 0 ? (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {attachments.map((attachment) => {
              return (
                <div
                  key={attachment.id}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-background/85"
                >
                  {attachment.previewUrl && isImageFile(attachment.file) ? (
                    <img
                      src={attachment.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}

                  {attachment.previewUrl && isVideoFile(attachment.file) ? (
                    <video
                      src={attachment.previewUrl}
                      muted
                      preload="metadata"
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : null}

                  {!attachment.previewUrl ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1.5 text-center">
                      {attachment.file.type.startsWith("video/") ? (
                        <FiVideo className="size-5 text-muted-foreground" />
                      ) : (
                        <FiFileText className="size-5 text-muted-foreground" />
                      )}
                      <p className="line-clamp-2 text-[10px] font-medium leading-tight text-muted-foreground">
                        {getMediaLabel(attachment.file.name)}
                      </p>
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-1 top-1 size-6 rounded-full"
                    onClick={() => handleRemoveAttachment(attachment.id)}
                    disabled={attachment.status === "uploading" || isSendingMessage}
                  >
                    <FiX className="size-3.5" />
                  </Button>

                  <div className="absolute inset-x-1.5 bottom-1.5 overflow-hidden rounded-full bg-background/70">
                    <div
                      className={cn(
                        "h-1.5 transition-[width] duration-150",
                        attachment.status === "error" ? "bg-destructive" : "bg-primary",
                      )}
                      style={{
                        width: `${attachment.status === "error" ? 100 : attachment.progress}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {isReplying ? (
            <motion.div
              layout
              layoutId="composer-reply-panel"
              variants={replyPanelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="rounded-t-[20px] rounded-b-none border-2 border-border/60 border-b-0 bg-secondary/85 px-3 py-2.5"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-0.5 shrink-0 bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold leading-none text-primary">
                    {replyTarget?.authorName}
                  </p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-[14px] leading-[1.15] text-muted-foreground">
                    {replyTarget?.text || t("replyFallback")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 rounded-full"
                  onClick={handleCancelReply}
                >
                  <FiX className="size-4" />
                </Button>
              </div>
            </motion.div>
          ) : null}

          {isEditing ? (
            <motion.div
              layout
              layoutId="composer-reply-panel"
              variants={replyPanelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="rounded-t-[20px] rounded-b-none border-2 border-border/60 border-b-0 bg-secondary/85 px-3 py-2.5"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-0.5 shrink-0 bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold leading-none text-primary">
                    {t("editingLabel")}
                  </p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-[14px] leading-[1.15] text-muted-foreground">
                    {editTarget?.text || t("replyFallback")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 rounded-full"
                  onClick={handleCancelEdit}
                >
                  <FiX className="size-4" />
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div>
          {isRecording ? (
            <div className="flex min-h-14 items-center gap-3 rounded-[1.2rem] border border-border/70 bg-background/85 px-3">
              {activeRecordingMode === "voice" ? (
                <div className="flex h-8 items-end gap-1">
                  {deferredRecordBars.map((size, index) => {
                    return (
                      <span
                        key={`rec-bar-${index}`}
                        className="w-[2px] rounded-full bg-primary/85 transition-[height] duration-100 ease-linear"
                        style={{ height: `${size}%` }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="inline-flex items-center rounded-full border border-primary/45 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                  {t("recordingRingLabel")}
                </div>
              )}
              <div className="ml-auto flex items-center gap-2 text-xs font-medium tabular-nums text-muted-foreground">
                {isRecordLocked ? (
                  <span className="inline-flex items-center rounded-full border border-primary/50 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {t("recordingPinned")}
                  </span>
                ) : null}
                <span>{formatRecordDuration(recordElapsedSeconds)}</span>
                {isVideoRecording ? (
                  <span className="text-[11px] text-muted-foreground/85">
                    {t("recordingRingLimit")}
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full [&_svg]:size-4"
                  onClick={() => {
                    void handleRecordGestureCancel();
                  }}
                  disabled={isBusyComposer}
                >
                  <FiX />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  className="size-8 rounded-full [&_svg]:size-4"
                  onClick={() => {
                    void handleRecordGestureFinish();
                  }}
                  disabled={isBusyComposer}
                >
                  <HiPaperAirplane />
                </Button>
              </div>
            </div>
          ) : (
            <Controller
              control={form.control}
              name="text"
              render={({ field }) => (
                <Field className="flex-1">
                  <EmojiInput
                    placeholder={t("placeholder")}
                    className={cn(
                      "max-w-none border-border bg-sidebar",
                      (isReplying || isEditing) && "rounded-t-none border-t-0",
                    )}
                    disabled={isBlockedByCurrentUser || isBlockedByPeer}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    showEmojiPicker
                    autoGrow
                    focusToken={inputFocusToken}
                    onSubmit={() => {
                      void form.handleSubmit(onSubmit)();
                    }}
                    submitOnEnter={sendShortcut === "enter"}
                    onKeyDown={(event) => {
                      if (
                        sendShortcut === "ctrl-enter" &&
                        event.key === "Enter" &&
                        event.ctrlKey
                      ) {
                        event.preventDefault();
                        void form.handleSubmit(onSubmit)();
                      }
                    }}
                    rightSlot={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-full [&_svg]:size-5"
                        onClick={() => attachmentInputRef.current?.click()}
                        disabled={
                          isEditing ||
                          isBlockedByCurrentUser ||
                          isBlockedByPeer ||
                          isBusyComposer
                        }
                      >
                        <FiPaperclip />
                      </Button>
                    }
                  />
                </Field>
              )}
            />
          )}
        </div>

        {isBlockedByCurrentUser ? (
          <p className="px-2 pt-1 text-xs text-destructive/90">{t("blockedHint")}</p>
        ) : null}

        {isBlockedByPeer ? (
          <p className="px-2 pt-1 text-xs text-destructive/90">{t("blockedByPeerHint")}</p>
        ) : null}

        {isUploadingRecordedMedia ? (
          <p className="px-2 pt-1 text-xs font-medium text-primary">
            {t("recordUploading", {
              progress: recordedMediaUploadProgress ?? 0,
            })}
          </p>
        ) : null}
      </div>

      <input
        ref={attachmentInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleSelectFiles}
      />

      {canShowRecordControl && !isRecordLocked ? (
        <TooltipProvider delayDuration={160}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                className={cn(
                  "size-12 shrink-0 rounded-full self-end [&_svg]:size-6",
                  (isRecordHolding || isLockZoneVisible) && "bg-primary/90",
                )}
                onPointerDown={handleRecordGestureStart}
                onPointerMove={handleRecordGestureMove}
                onPointerUp={handleRecordGestureRelease}
                onPointerCancel={handleRecordGesturePointerCancel}
                disabled={isBusyComposer}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {recordMode === "ring" ? (
                    <motion.div
                      key={"record-ring"}
                      variants={swapYVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <FiVideo />
                    </motion.div>
                  ) : (
                    <motion.div
                      key={"record-voice"}
                      variants={swapYVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <TiMicrophone />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {recordMode === "ring"
                ? t("recordButtonHintRing")
                : t("recordButtonHintVoice")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}

      {!canShowRecordControl ? (
        <Button
          type="submit"
          className="size-12 shrink-0 rounded-full self-end [&_svg]:size-6"
          disabled={!canSubmit}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={"text"}
              variants={swapYVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <HiPaperAirplane />
            </motion.div>
          </AnimatePresence>
        </Button>
      ) : null}

      <AnimatePresence>
        {isLockZoneVisible ? (
          <motion.div
            className="pointer-events-none fixed inset-x-0 top-4 z-[135] flex justify-center"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className={cn(
                "inline-flex min-w-52 items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold",
                isRecordLockCandidate
                  ? "border-primary bg-primary/18 text-primary"
                  : "border-border/65 bg-background/92 text-muted-foreground",
              )}
            >
              {isRecordLockCandidate ? t("releaseToPin") : t("dragToPin")}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isVideoRecording ? (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[125] flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative size-[min(22rem,72vw)] overflow-hidden rounded-full border border-white/15 bg-black/75 shadow-[0_20px_50px_rgb(0_0_0_/_0.45)]">
              <video
                ref={ringPreviewRef}
                muted
                playsInline
                autoPlay
                className="size-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/25 via-transparent to-black/45" />
              <div className="absolute inset-x-0 top-0 flex justify-center p-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white">
                  <span className="size-1.5 rounded-full bg-red-400" />
                  {formatRecordDuration(recordElapsedSeconds)}
                </span>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </form>
  );
}
