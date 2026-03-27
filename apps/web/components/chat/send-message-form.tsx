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
  toast,
} from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { HiPaperAirplane } from "react-icons/hi2";
import { FaTrash } from "react-icons/fa";
import { FiFileText, FiPaperclip, FiVideo, FiX } from "react-icons/fi";
import { TiMicrophone } from "react-icons/ti";
import { EmojiInput } from "@/components/ui/emoji-input";
import { useLocale, useTranslations } from "next-intl";
import {
  type ChatMessagesFilter,
  type ChatMessagesQueryData,
  bumpConversationInListData,
  bumpConversationQueryData,
  getChatMessagesQueryKey,
  getConversationQueryKey,
} from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import {
  composerActionButtonVariants,
  composerAttachmentItemVariants,
  composerAttachmentsVariants,
  composerBlockedOverlayVariants,
  composerInputRowVariants,
  composerRecordingRowVariants,
  replyKeyboardVariants,
  replyPanelVariants,
} from "@/lib/animations";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";
import { getMediaLabel } from "@/lib/chat";
import { CHAT_FORCE_SCROLL_BOTTOM_EVENT } from "@/lib/chat.constants";
import {
  deleteConversationMedia,
  uploadConversationMedia,
} from "@/lib/upload-conversation-media";
import { EASING, SPRING, TIMING } from "@/lib/animation-config";
import { ApiError } from "@/lib/fetcher";
import {
  type ChatReplyMarkupCarrier,
  type ChatReplyKeyboardMarkup,
} from "@/lib/bot-reply-markup";
import type { ChatEditTarget, ChatReplyTarget } from "./chat.types";
import { ChatReplyKeyboard } from "./chat-reply-keyboard";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl: string | null;
  uploadedKey: string | null;
  mediaKind: "messages" | "voice" | "ring";
  progress: number;
  status: "pending" | "uploading" | "uploaded" | "error";
};

type ActiveBotReplyKeyboard = {
  message: ChatReplyMarkupCarrier;
  markup: ChatReplyKeyboardMarkup;
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
  botReplyKeyboard = null,
  botInputPlaceholder = "",
  replyTarget,
  implicitReplyTarget = null,
  hideReplyPanel = false,
  editTarget,
  onCancelReply,
  onCancelEdit,
  onTypingStateChange,
  onUploadingMediaStateChange,
  messageFilter,
}: {
  conversationId: string;
  isBlockedByCurrentUser?: boolean;
  isBlockedByPeer?: boolean;
  botReplyKeyboard?: ActiveBotReplyKeyboard | null;
  botInputPlaceholder?: string;
  replyTarget: ChatReplyTarget | null;
  implicitReplyTarget?: ChatReplyTarget | null;
  hideReplyPanel?: boolean;
  editTarget: ChatEditTarget | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onTypingStateChange?: (active: boolean) => void;
  onUploadingMediaStateChange?: (active: boolean) => void;
  messageFilter?: ChatMessagesFilter;
}) {
  const t = useTranslations("chat.sendMessageForm");
  const locale = useLocale();
  const prefersReducedMotion = useReducedMotion();
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
  const recordActionInFlightRef = useRef(false);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingAnimationFrameRef = useRef<number | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const recordingAnalyserRef = useRef<AnalyserNode | null>(null);
  const recordProbeArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isUploadingRecordedMedia, setIsUploadingRecordedMedia] = useState(false);
  const [recordedMediaUploadProgress, setRecordedMediaUploadProgress] = useState<number | null>(null);
  const [recordMode] = useState<"voice" | "ring">("voice");
  const [activeRecordingMode, setActiveRecordingMode] = useState<"voice" | "ring" | null>(null);
  const [recordGestureState, setRecordGestureState] = useState<"idle" | "recording">("idle");
  const [recordStartedAt, setRecordStartedAt] = useState<number | null>(null);
  const [recordElapsedSeconds, setRecordElapsedSeconds] = useState(0);
  const [recordLiveBars, setRecordLiveBars] = useState<number[]>(
    () => Array.from({ length: 24 }, () => 30),
  );
  const [dismissedBotKeyboardMessageId, setDismissedBotKeyboardMessageId] = useState("");
  const botKeyboardSessionRef = useRef({
    conversationId: "",
    initialized: false,
    messageId: "",
  });

  const { mutateAsync: sendMessage, isPending: isSendingMessage } = useMessagesControllerSend({
    mutation: {
      onSuccess: async () => {
        const nextTimestamp = Date.now();

        form.reset({
          text: "",
          replyToId: implicitReplyTarget?.id ?? "",
        });
        onCancelReply();
        onCancelEdit();
        if (activeReplyKeyboardMarkup?.oneTimeKeyboard && botReplyKeyboard) {
          setDismissedBotKeyboardMessageId(botReplyKeyboard.message.id);
        }
        setAttachments((currentAttachments) => {
          currentAttachments.forEach((attachment) => {
            if (attachment.previewUrl) {
              URL.revokeObjectURL(attachment.previewUrl);
            }
          });
          return [];
        });

        queueMicrotask(() => {
          queryClient.setQueryData<GetConversationResponseDto>(
            getConversationQueryKey(conversationId),
            (currentData) => bumpConversationQueryData(currentData, nextTimestamp),
          );

          queryClient.setQueriesData<ListMyConversationsResponseDto>(
            { queryKey: getConversationsControllerMyQueryKey() },
            (currentData) =>
              bumpConversationInListData(currentData, conversationId, nextTimestamp),
          );
        });

        window.requestAnimationFrame(() => {
          window.dispatchEvent(
            new CustomEvent(CHAT_FORCE_SCROLL_BOTTOM_EVENT, {
              detail: { conversationId },
            }),
          );
        });
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
          getChatMessagesQueryKey(conversationId, messageFilter),
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
          replyToId: implicitReplyTarget?.id ?? "",
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
  const isReplying =
    !isEditing &&
    !hideReplyPanel &&
    Boolean(replyTarget && replyToIdValue);
  const hasUploadingAttachments = attachments.some(
    (attachment) => attachment.status === "uploading",
  );
  const hasErroredAttachments = attachments.some(
    (attachment) => attachment.status === "error",
  );
  const hasAttachedMedia = attachments.length > 0;
  const isBusyComposer = isSendingMessage || isUploadingRecordedMedia;
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
  const recordBars = recordLiveBars.length > 0
    ? recordLiveBars
    : Array.from({ length: 24 }, () => 30);
  const deferredRecordBars = recordBars;
  const activeReplyKeyboardMarkup =
    botReplyKeyboard &&
    botReplyKeyboard.message.id !== dismissedBotKeyboardMessageId
      ? botReplyKeyboard.markup
      : null;
  const shouldShowReplyKeyboard = Boolean(activeReplyKeyboardMarkup && !isRecording);
  const showUploadRow = isUploadingRecordedMedia && !isRecording;
  const hasBlockedOverlay = isBlockedByCurrentUser || isBlockedByPeer;

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

  const handleBotReplyKeyboardPressStable = useCallback((text: string) => {
    void handleBotReplyKeyboardPress(text);
  }, [handleBotReplyKeyboardPress]);

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
    if (editTarget) {
      return;
    }

    form.setValue("replyToId", replyTarget?.id ?? implicitReplyTarget?.id ?? "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [editTarget, form, implicitReplyTarget?.id, replyTarget?.id]);

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
    const session = botKeyboardSessionRef.current;

    if (session.conversationId !== conversationId) {
      session.conversationId = conversationId;
      session.initialized = false;
      session.messageId = "";
    }

    if (!botReplyKeyboard) {
      session.initialized = true;
      session.messageId = "";
      setDismissedBotKeyboardMessageId("");
      return;
    }

    const nextMessageId = botReplyKeyboard.message.id;

    if (!session.initialized) {
      session.initialized = true;
      session.messageId = nextMessageId;
      setDismissedBotKeyboardMessageId(nextMessageId);
      return;
    }

    if (session.messageId !== nextMessageId) {
      session.messageId = nextMessageId;
      setDismissedBotKeyboardMessageId("");
    }
  }, [botReplyKeyboard, conversationId]);

  async function sendTextMessage(options: {
    text: string;
    replyToId?: string;
  }) {
    const trimmedText = options.text.trim();
    if (!trimmedText || !conversationId) {
      return;
    }

      await sendMessage({
        data: {
          conversationId,
          kind: SendMessageRequestDtoKind.TEXT,
          text: trimmedText,
          replyToId: options.replyToId || undefined,
          locale,
        },
      });
  }

  async function handleRecordGestureCancel() {
    if (recordActionInFlightRef.current) return;

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

        await sendMessage({
          data: {
            conversationId,
            kind: SendMessageRequestDtoKind.MEDIA,
            text: undefined,
            replyToId: form.getValues("replyToId") || undefined,
            mediaKeys: [uploaded.key],
            locale,
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

  async function handleRecordGestureStart() {
    if (!canShowRecordControl || isBusyComposer || recordGestureState !== "idle") return;

    const recorderStarted = recordMode === "ring"
      ? await ensureRingRecorderStarted()
      : await ensureVoiceRecorderStarted();

    if (!recorderStarted) {
      resetRecordGestureState();
      return;
    }

    setRecordGestureState("recording");
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

        await sendMessage({
          data: {
            conversationId,
            kind: uploadedMediaKeys.length > 0
              ? SendMessageRequestDtoKind.MEDIA
              : SendMessageRequestDtoKind.TEXT,
            text: text || undefined,
            replyToId: data.replyToId || undefined,
            mediaKeys: uploadedMediaKeys.length > 0 ? uploadedMediaKeys : undefined,
            locale,
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

  async function handleBotReplyKeyboardPress(text: string) {
    if (!conversationId || isBlockedByCurrentUser || isBlockedByPeer) return;
    if (isBusyComposer || hasUploadingAttachments || hasErroredAttachments || isEditing) return;

    const shouldDismissOneTimeKeyboard = Boolean(
      activeReplyKeyboardMarkup?.oneTimeKeyboard && botReplyKeyboard,
    );
    const keyboardMessageId = botReplyKeyboard?.message.id ?? "";

    try {
      if (shouldDismissOneTimeKeyboard && keyboardMessageId) {
        setDismissedBotKeyboardMessageId(keyboardMessageId);
      }

      await sendTextMessage({
        text,
        replyToId: form.getValues("replyToId") || undefined,
      });
    } catch {
      if (shouldDismissOneTimeKeyboard) {
        setDismissedBotKeyboardMessageId("");
      }

      toast({
        title: t("sendError"),
        type: "error",
      });
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
      replyToId: implicitReplyTarget?.id ?? "",
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
      className="flex items-start justify-center gap-2"
    >
      <div className="flex-1">
        <div className="flex items-end gap-2">
          <motion.div
            layout
            transition={prefersReducedMotion ? { duration: 0 } : SPRING.input}
            className={cn(
              "chat-composer-surface relative flex-1 overflow-hidden border-2 border-border/60 bg-sidebar",
              shouldShowReplyKeyboard
                ? "rounded-t-[20px] rounded-b-none border-b-0"
                : "rounded-[20px]",
            )}
          >
          <AnimatePresence initial={false}>
            {hasAttachedMedia ? (
              <motion.div
                key="composer-attachments"
                layout
                variants={composerAttachmentsVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{ overflow: "hidden" }}
                className="border-b border-border/40 px-3 py-3"
              >
                <motion.div
                  layout
                  className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  <AnimatePresence initial={false}>
                    {attachments.map((attachment) => (
                      <motion.div
                        key={attachment.id}
                        layout
                        initial="hidden"
                        animate={attachment.status === "error" ? "error" : "visible"}
                        exit="exit"
                        variants={{
                          ...composerAttachmentItemVariants,
                          error: {
                            opacity: 1,
                            scale: 1,
                            x: [0, -4, 4, -2, 2, 0],
                            transition: {
                              duration: prefersReducedMotion ? 0 : 0.3,
                              ease: EASING.easeOut,
                            },
                          },
                        }}
                        className={cn(
                          "relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border bg-background/85",
                          attachment.status === "error"
                            ? "border-destructive/70"
                            : "border-border/60",
                        )}
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
                              "h-1.5 transition-[width,background-color] ease-out",
                              attachment.status === "error" ? "bg-destructive" : "bg-primary",
                            )}
                            style={{
                              width: `${attachment.status === "error" ? 100 : attachment.progress}%`,
                              transitionDuration: prefersReducedMotion ? "0ms" : "300ms",
                            }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            {isReplying ? (
              <motion.div
                key="composer-reply-panel"
                layout
                variants={replyPanelVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{ overflow: "hidden" }}
                className="border-b border-border/40"
              >
                <div className="flex items-start gap-3 px-3 py-2.5">
                  <div className="mt-0.5 h-9 w-0.5 shrink-0 bg-primary" />
                  <div className="min-w-0 flex-1">
                    <motion.p
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: TIMING.fast, ease: EASING.spring, delay: 0.06 }}
                      className="truncate text-[12px] font-semibold leading-none text-primary"
                    >
                      {replyTarget?.authorName}
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: TIMING.fast, ease: EASING.spring, delay: 0.1 }}
                      className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-[14px] leading-[1.15] text-muted-foreground"
                    >
                      {replyTarget?.text || t("replyFallback")}
                    </motion.p>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: TIMING.fast, ease: EASING.spring, delay: 0.12 }}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 rounded-full"
                      onClick={handleCancelReply}
                    >
                      <FiX className="size-4" />
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            ) : isEditing ? (
              <motion.div
                key="composer-edit-panel"
                layout
                variants={replyPanelVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{ overflow: "hidden" }}
                className="border-b border-border/40"
              >
                <div className="flex items-start gap-3 px-3 py-2.5">
                  <motion.div
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: -90 }}
                    transition={prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: TIMING.normal, ease: EASING.spring }}
                    className="mt-0.5 flex h-9 w-5 shrink-0 items-start justify-center text-primary"
                  >
                    <FiFileText className="size-4" />
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <motion.p
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: TIMING.fast, ease: EASING.spring, delay: 0.06 }}
                      className="truncate text-[12px] font-semibold leading-none text-primary"
                    >
                      {t("editingLabel")}
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: TIMING.fast, ease: EASING.spring, delay: 0.1 }}
                      className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-[14px] leading-[1.15] text-muted-foreground"
                    >
                      {editTarget?.text || t("replyFallback")}
                    </motion.p>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: TIMING.fast, ease: EASING.spring, delay: 0.12 }}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 rounded-full"
                      onClick={handleCancelEdit}
                    >
                      <FiX className="size-4" />
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <motion.div
            layout
            transition={prefersReducedMotion ? { duration: 0 } : SPRING.input}
            className="relative"
          >
            <AnimatePresence initial={false}>
              {hasBlockedOverlay ? (
                <motion.div
                  key="composer-blocked-overlay"
                  variants={composerBlockedOverlayVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-sidebar/65 backdrop-blur-[2px]"
                >
                  <span className="rounded-full border border-destructive/20 bg-background/90 px-3 py-1.5 text-xs font-semibold text-destructive/90">
                    {isBlockedByCurrentUser ? t("blockedHint") : t("blockedByPeerHint")}
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence mode="wait" initial={false}>
              {isRecording ? (
                <motion.div
                  key="composer-recording-row"
                  layout
                  variants={composerRecordingRowVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="relative flex min-h-14 items-center gap-3 px-3 py-2"
                >
                  <span className="min-w-12 text-xs font-medium tabular-nums text-muted-foreground">
                    {formatRecordDuration(recordElapsedSeconds)}
                  </span>

                  <div className="min-w-0 flex-1">
                    {activeRecordingMode === "voice" ? (
                      <div className="flex h-9 w-full items-center justify-between gap-0.5">
                        {deferredRecordBars.map((size, index) => (
                          <span
                            key={`rec-bar-${index}`}
                            className="flex h-full flex-1 items-center justify-center"
                          >
                            <span
                              className="block w-[3.5px] rounded-full bg-primary/85"
                              style={{
                                height: `${Math.max(size, 12)}%`,
                                transition: prefersReducedMotion
                                  ? "none"
                                  : `height ${Math.round(TIMING.instant * 1000)}ms linear`,
                              }}
                            />
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center rounded-full border border-primary/45 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                          {t("recordingRingLabel")}
                        </div>
                        <span className="text-[11px] text-muted-foreground/85">
                          {t("recordingRingLimit")}
                        </span>
                      </div>
                    )}
                  </div>

                </motion.div>
              ) : showUploadRow ? (
                <motion.div
                  key="composer-upload-row"
                  layout
                  variants={composerRecordingRowVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex min-h-14 items-center px-3 py-2"
                >
                  <div className="w-full overflow-hidden rounded-full bg-muted/80">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-[width] ease-out"
                      style={{
                        width: `${Math.max(6, recordedMediaUploadProgress ?? 0)}%`,
                        transitionDuration: prefersReducedMotion ? "0ms" : "300ms",
                      }}
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="composer-main-row"
                  layout
                  variants={composerInputRowVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="input-wrapper"
                >
                  <Controller
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                      <Field className="flex-1">
                        <EmojiInput
                          placeholder={botInputPlaceholder || t("placeholder")}
                          className="max-w-none rounded-none border-0 bg-transparent shadow-none"
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
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        <motion.div
          layout
          transition={prefersReducedMotion ? { duration: 0 } : SPRING.input}
          className="shrink-0 self-center"
        >
          <AnimatePresence mode="wait" initial={false}>
            {showUploadRow ? (
              <motion.div
                key="composer-upload-button"
                layout
                variants={composerActionButtonVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Button
                  type="button"
                  className="size-12 shrink-0 rounded-full [&_svg]:size-6"
                  disabled
                >
                  <HiPaperAirplane />
                </Button>
              </motion.div>
            ) : isRecording ? (
              <motion.div
                key="composer-record-actions"
                layout
                variants={composerActionButtonVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex items-center gap-2"
              >
                <Button
                  type="button"
                  size="icon"
                  className="size-12 shrink-0 rounded-full bg-muted text-destructive hover:bg-muted/90 [&_svg]:size-5"
                  onClick={() => {
                    void handleRecordGestureCancel();
                  }}
                  disabled={isBusyComposer}
                >
                  <FaTrash />
                </Button>
                <Button
                  type="button"
                  className="size-12 shrink-0 rounded-full [&_svg]:size-6"
                  onClick={() => {
                    void handleRecordGestureFinish();
                  }}
                  disabled={isBusyComposer}
                >
                  <HiPaperAirplane />
                </Button>
              </motion.div>
            ) : canShowRecordControl ? (
              <motion.div
                key="composer-record-button"
                layout
                variants={composerActionButtonVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Button
                  type="button"
                  className="size-12 shrink-0 rounded-full [&_svg]:size-6"
                  onClick={() => {
                    void handleRecordGestureStart();
                  }}
                  disabled={isBusyComposer}
                >
                  {recordMode === "ring" ? <FiVideo /> : <TiMicrophone />}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="composer-send-button"
                layout
                variants={composerActionButtonVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Button
                  type="submit"
                  className="size-12 shrink-0 rounded-full [&_svg]:size-6"
                  disabled={!canSubmit}
                >
                  <HiPaperAirplane />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence initial={false}>
        {shouldShowReplyKeyboard && botReplyKeyboard ? (
          <motion.div
            key="composer-reply-keyboard"
            variants={replyKeyboardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ overflow: "hidden" }}
            className="rounded-b-[20px] border-2 border-border/60 border-t-0 bg-sidebar"
          >
            <div className="border-t border-border/40">
              <ChatReplyKeyboard
                markup={botReplyKeyboard.markup}
                disabled={isBusyComposer || isBlockedByCurrentUser || isBlockedByPeer}
                onPressText={handleBotReplyKeyboardPressStable}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>

      <input
        ref={attachmentInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleSelectFiles}
      />

      {isVideoRecording ? (
          <div className="pointer-events-none fixed inset-0 z-[125] flex items-center justify-center">
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
          </div>
        ) : null}
    </form>
  );
}
