"use client";
/* eslint-disable @next/next/no-img-element */

import {
  type ConversationResponseDto,
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  type SendMessageRequestDto,
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { HiPaperAirplane } from "react-icons/hi2";
import { FaTrash } from "react-icons/fa";
import {
  FiEdit3,
  FiFileText,
  FiMusic,
  FiPaperclip,
  FiPenTool,
  FiRotateCcw,
  FiRotateCw,
  FiType,
  FiVideo,
  FiX,
} from "react-icons/fi";
import { TiMicrophone } from "react-icons/ti";
import { EmojiInput } from "@/components/ui/emoji-input";
import { useLocale, useTranslations } from "next-intl";
import {
  type ChatMessagesFilter,
  type ChatMessagesQueryData,
  type ChatMessageDto,
  type ChatLastMessagePreviewData,
  appendChatMessageToData,
  bumpConversationInListData,
  bumpConversationQueryData,
  getChatLastMessagePreviewQueryKey,
  getChatMessagesQueryKey,
  getConversationQueryKey,
  normalizeChatMessage,
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
import {
  sendDirectMessage,
  upsertConversationInListData,
} from "@/lib/direct-chat";
import type { ChatEditTarget, ChatReplyTarget } from "./chat.types";
import { ChatReplyKeyboard } from "./chat-reply-keyboard";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl: string | null;
  uploadedKey: string | null;
  mediaKind: "messages" | "voice" | "ring" | "music";
  imageRotation: number;
  imageStrokes: ImageDrawStroke[];
  imageTexts: ImageTextOverlay[];
  progress: number;
  status: "pending" | "uploading" | "uploaded" | "error";
};

type ImageEditorTool = "draw" | "text";

type ImageDrawPoint = {
  x: number;
  y: number;
};

type ImageDrawStroke = {
  id: string;
  color: string;
  size: number;
  createdAt: number;
  points: ImageDrawPoint[];
};

type ImageTextOverlay = {
  id: string;
  text: string;
  color: string;
  size: number;
  createdAt: number;
  x: number;
  y: number;
  width: number;
};

type ImageTextInteraction =
  | {
      mode: "move";
      id: string;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
      originWidth: number;
    }
  | {
      mode: "resize";
      id: string;
      edge: "left" | "right";
      startX: number;
      originX: number;
      originWidth: number;
    };

type HsvColor = {
  h: number;
  s: number;
  v: number;
};

type PendingAttachmentMetadata = {
  key: string;
  kind: PendingAttachment["mediaKind"] | "file" | "image" | "video";
  fileName: string;
  mimeType: string;
  size: number;
};

type ActiveBotReplyKeyboard = {
  message: ChatReplyMarkupCarrier;
  markup: ChatReplyKeyboardMarkup;
};

const IMAGE_EDITOR_COLORS = [
  "hsl(var(--foreground))",
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--accent-foreground))",
  "hsl(var(--secondary-foreground))",
];
const IMAGE_TEXT_PLACEMENT_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M7 5h14M14 5v18' stroke='white' stroke-width='5' stroke-linecap='round'/%3E%3Cpath d='M7 5h14M14 5v18' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E\") 14 14, text";

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hsvToHex({ h, s, v }: HsvColor) {
  const normalizedHue = ((h % 360) + 360) % 360;
  const saturation = clampNumber(s, 0, 100) / 100;
  const value = clampNumber(v, 0, 100) / 100;
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((normalizedHue / 60) % 2) - 1));
  const match = value - chroma;
  const [red, green, blue] =
    normalizedHue < 60 ? [chroma, x, 0]
      : normalizedHue < 120 ? [x, chroma, 0]
        : normalizedHue < 180 ? [0, chroma, x]
          : normalizedHue < 240 ? [0, x, chroma]
            : normalizedHue < 300 ? [x, 0, chroma]
              : [chroma, 0, x];

  return `#${
    [red, green, blue]
      .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0"))
      .join("")
  }`;
}

function hexToHsv(hex: string): HsvColor | null {
  const normalizedHex = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalizedHex)) {
    return null;
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const hue = delta === 0
    ? 0
    : max === red
      ? 60 * (((green - blue) / delta) % 6)
      : max === green
        ? 60 * ((blue - red) / delta + 2)
        : 60 * ((red - green) / delta + 4);

  return {
    h: Math.round((hue + 360) % 360),
    s: max === 0 ? 0 : Math.round((delta / max) * 100),
    v: Math.round(max * 100),
  };
}

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

function isAudioFile(file: File) {
  const normalizedName = file.name.toLowerCase();
  return (
    file.type.startsWith("audio/") ||
    [".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".opus", ".flac"].some(
      (extension) => normalizedName.endsWith(extension),
    )
  );
}

function getAttachmentMetadataKind(attachment: PendingAttachment) {
  if (attachment.mediaKind !== "messages") {
    return attachment.mediaKind;
  }

  if (isImageFile(attachment.file)) {
    return "image";
  }

  if (isVideoFile(attachment.file)) {
    return "video";
  }

  if (isAudioFile(attachment.file)) {
    return "music";
  }

  return "file";
}

function buildPendingAttachmentMetadata(
  attachment: PendingAttachment,
  key: string,
): PendingAttachmentMetadata {
  return {
    key,
    kind: getAttachmentMetadataKind(attachment),
    fileName: attachment.file.name,
    mimeType: attachment.file.type,
    size: attachment.file.size,
  };
}

function createPendingAttachment(file: File): PendingAttachment {
  return {
    id: createAttachmentId(),
    file,
    previewUrl: isImageFile(file) || isVideoFile(file) ? URL.createObjectURL(file) : null,
    uploadedKey: null,
    mediaKind: isAudioFile(file) ? "music" : "messages",
    imageRotation: 0,
    imageStrokes: [],
    imageTexts: [],
    progress: 0,
    status: "pending",
  };
}

function hasDraggedFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

async function createEditedImageFile(attachment: PendingAttachment) {
  if (
    !isImageFile(attachment.file) ||
    (
      attachment.imageRotation % 360 === 0 &&
      attachment.imageStrokes.length === 0 &&
      attachment.imageTexts.length === 0
    )
  ) {
    return attachment.file;
  }

  const sourceUrl = attachment.previewUrl ?? URL.createObjectURL(attachment.file);
  const shouldRevokeSourceUrl = !attachment.previewUrl;

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = reject;
      nextImage.src = sourceUrl;
    });
    const normalizedRotation = ((attachment.imageRotation % 360) + 360) % 360;
    const swapsDimensions = normalizedRotation === 90 || normalizedRotation === 270;
    const canvas = document.createElement("canvas");
    canvas.width = swapsDimensions ? image.naturalHeight : image.naturalWidth;
    canvas.height = swapsDimensions ? image.naturalWidth : image.naturalHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return attachment.file;
    }

    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((normalizedRotation * Math.PI) / 180);
    context.drawImage(
      image,
      -image.naturalWidth / 2,
      -image.naturalHeight / 2,
      image.naturalWidth,
      image.naturalHeight,
    );
    context.restore();

    const annotationScaleX = canvas.width;
    const annotationScaleY = canvas.height;

    for (const stroke of attachment.imageStrokes) {
      if (stroke.points.length < 2) continue;

      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = stroke.color;
      context.lineWidth = Math.max(2, stroke.size);
      context.beginPath();
      stroke.points.forEach((point, index) => {
        const x = point.x * annotationScaleX;
        const y = point.y * annotationScaleY;
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.stroke();
      context.restore();
    }

    for (const textLayer of attachment.imageTexts) {
      const text = textLayer.text.trim();
      if (!text) continue;

      context.save();
      context.font = `700 ${textLayer.size}px Inter, system-ui, sans-serif`;
      context.textAlign = "left";
      context.textBaseline = "top";
      context.lineWidth = Math.max(4, textLayer.size * 0.12);
      context.strokeStyle = "rgba(0, 0, 0, 0.55)";
      context.fillStyle = textLayer.color;
      const x = textLayer.x * annotationScaleX;
      const y = textLayer.y * annotationScaleY;
      const maxWidth = Math.max(24, textLayer.width * annotationScaleX);
      context.strokeText(text, x, y, maxWidth);
      context.fillText(text, x, y, maxWidth);
      context.restore();
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, attachment.file.type || "image/png", 0.92);
    });

    if (!blob) {
      return attachment.file;
    }

    return new File([blob], attachment.file.name, {
      type: blob.type || attachment.file.type,
      lastModified: Date.now(),
    });
  } finally {
    if (shouldRevokeSourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
  }
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
  directPeerUserId = "",
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
  onConversationResolved,
  messageFilter,
}: {
  conversationId: string;
  directPeerUserId?: string;
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
  onConversationResolved?: (conversation: ConversationResponseDto) => void;
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
  const imageEditorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageTextInteractionRef = useRef<ImageTextInteraction | null>(null);
  const activeDrawStrokeIdRef = useRef<string | null>(null);
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
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [imageEditorTool, setImageEditorTool] = useState<ImageEditorTool>("draw");
  const [imageEditorColor, setImageEditorColor] = useState(IMAGE_EDITOR_COLORS[0]);
  const [imageEditorCustomColor, setImageEditorCustomColor] = useState("#ff3366");
  const [imageEditorBrushSize, setImageEditorBrushSize] = useState(8);
  const [activeImageTextId, setActiveImageTextId] = useState<string | null>(null);
  const [isImageTextPlacementArmed, setIsImageTextPlacementArmed] = useState(false);
  const [imageEditorCanvasScale, setImageEditorCanvasScale] = useState(1);
  const [imageEditorCanvasSize, setImageEditorCanvasSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
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
  const showSendError = useCallback(
    (error: unknown) => {
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
    [t],
  );

  const { mutateAsync: sendMessage, isPending: isSendingMessage } = useMessagesControllerSend({
    mutation: {
      onSuccess: async (response) => {
        const nextTimestamp = Date.now();
        const responseBody = response as unknown as {
          message?: Partial<ChatMessageDto> | null;
        };
        const sentMessage = normalizeChatMessage(responseBody.message);
        const resolvedTimestamp = sentMessage?.createdAt || nextTimestamp;

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
          if (sentMessage) {
            queryClient.setQueryData<ChatMessagesQueryData>(
              getChatMessagesQueryKey(conversationId, messageFilter),
              (currentData) => appendChatMessageToData(currentData, sentMessage),
            );
            queryClient.setQueryData<ChatLastMessagePreviewData>(
              getChatLastMessagePreviewQueryKey(conversationId),
              { message: sentMessage },
            );
          }

          queryClient.setQueryData<GetConversationResponseDto>(
            getConversationQueryKey(conversationId),
            (currentData) => bumpConversationQueryData(currentData, resolvedTimestamp),
          );

          queryClient.setQueriesData<ListMyConversationsResponseDto>(
            { queryKey: getConversationsControllerMyQueryKey() },
            (currentData) =>
              bumpConversationInListData(currentData, conversationId, resolvedTimestamp),
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
      onError: showSendError,
    },
  });
  const { mutateAsync: sendDirectMessageMutation, isPending: isSendingDirectMessage } =
    useMutation({
      mutationFn: sendDirectMessage,
      onSuccess: async (response) => {
        const conversation = response.conversation ?? null;
        const resolvedConversationId = conversation?.id?.trim() ?? "";
        if (!conversation || !resolvedConversationId) {
          return;
        }

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

        onConversationResolved?.(conversation);

        queueMicrotask(() => {
          queryClient.setQueryData<GetConversationResponseDto>(
            getConversationQueryKey(resolvedConversationId),
            {
              conversation: {
                ...conversation,
                updatedAt: Math.max(conversation.updatedAt ?? 0, nextTimestamp),
              },
            },
          );

          queryClient.setQueriesData<ListMyConversationsResponseDto>(
            { queryKey: getConversationsControllerMyQueryKey() },
            (currentData) =>
              upsertConversationInListData(currentData, conversation, nextTimestamp),
          );
          void queryClient.invalidateQueries({
            queryKey: getConversationsControllerMyQueryKey(),
          });
        });

        window.requestAnimationFrame(() => {
          window.dispatchEvent(
            new CustomEvent(CHAT_FORCE_SCROLL_BOTTOM_EVENT, {
              detail: { conversationId: resolvedConversationId },
            }),
          );
        });
      },
      onError: showSendError,
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
  const hasSendTarget = Boolean(conversationId || directPeerUserId);
  const isBusyComposer =
    isSendingMessage || isSendingDirectMessage || isUploadingRecordedMedia;
  const isRecording = recordGestureState === "recording";
  const isVideoRecording = isRecording && activeRecordingMode === "ring";
  const isTypingStateActive =
    Boolean(conversationId) &&
    textValue.trim().length > 0 &&
    !isBlockedByCurrentUser &&
    !isBlockedByPeer &&
    !isBusyComposer &&
    !isRecording;
  const isUploadingMediaStateActive =
    Boolean(conversationId) &&
    (hasUploadingAttachments || isUploadingRecordedMedia) &&
    !isBlockedByCurrentUser &&
    !isBlockedByPeer;
  const canShowRecordControl =
    Boolean(conversationId) &&
    textValue.trim().length === 0 &&
    !isEditing &&
    !hasAttachedMedia &&
    !isBlockedByCurrentUser &&
    !isBlockedByPeer &&
    !hasUploadingAttachments &&
    !hasErroredAttachments &&
    !isUploadingRecordedMedia;
  const canSubmit =
    hasSendTarget &&
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
  const editingAttachment = attachments.find(
    (attachment) => attachment.id === editingAttachmentId,
  );

  const renderImageEditorCanvas = useCallback(async (attachment: PendingAttachment) => {
    const canvas = imageEditorCanvasRef.current;
    if (!canvas || !attachment.previewUrl) return;

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = reject;
      nextImage.src = attachment.previewUrl ?? "";
    });

    const normalizedRotation = ((attachment.imageRotation % 360) + 360) % 360;
    const swapsDimensions = normalizedRotation === 90 || normalizedRotation === 270;
    const width = swapsDimensions ? image.naturalHeight : image.naturalWidth;
    const height = swapsDimensions ? image.naturalWidth : image.naturalHeight;
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    setImageEditorCanvasSize({
      width: canvas.width,
      height: canvas.height,
    });

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    window.requestAnimationFrame(() => {
      const rect = canvas.getBoundingClientRect();
      setImageEditorCanvasScale(canvas.width > 0 ? rect.width / canvas.width : 1);
    });
    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((normalizedRotation * Math.PI) / 180);
    context.drawImage(
      image,
      -(image.naturalWidth * scale) / 2,
      -(image.naturalHeight * scale) / 2,
      image.naturalWidth * scale,
      image.naturalHeight * scale,
    );
    context.restore();

    for (const stroke of attachment.imageStrokes) {
      if (stroke.points.length < 2) continue;
      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.size * scale;
      context.beginPath();
      stroke.points.forEach((point, index) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
      context.restore();
    }

  }, []);

  useEffect(() => {
    if (!editingAttachment?.previewUrl || !isImageFile(editingAttachment.file)) {
      return;
    }

    void renderImageEditorCanvas(editingAttachment);
  }, [editingAttachment, renderImageEditorCanvas]);

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
    if (!hasSendTarget || isBlockedByCurrentUser || isBlockedByPeer || isEditing) {
      return;
    }

    let dragDepth = 0;

    const handleDragEnter = (event: DragEvent) => {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
      dragDepth += 1;
      setIsDraggingFiles(true);
    };

    const handleDragOver = (event: DragEvent) => {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
      setIsDraggingFiles(true);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!hasDraggedFiles(event)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        setIsDraggingFiles(false);
      }
    };

    const handleDrop = (event: DragEvent) => {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault();
      dragDepth = 0;
      setIsDraggingFiles(false);
      addPendingFiles(Array.from(event.dataTransfer?.files ?? []));
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [hasSendTarget, isBlockedByCurrentUser, isBlockedByPeer, isEditing]);

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

  async function sendMessagePayload(
    payload: Omit<SendMessageRequestDto, "conversationId">,
  ) {
    if (conversationId) {
      await sendMessage({
        data: {
          conversationId,
          ...payload,
        },
      });
      return;
    }

    if (!directPeerUserId) {
      return;
    }

    const response = await sendDirectMessageMutation({
      targetUserId: directPeerUserId,
      ...payload,
    });

    if (!response.conversation?.id) {
      throw new Error("Direct conversation was not created");
    }
  }

  async function sendTextMessage(options: {
    text: string;
    replyToId?: string;
  }) {
    const trimmedText = options.text.trim();
    if (!trimmedText || !hasSendTarget) {
      return;
    }

    await sendMessagePayload({
      kind: SendMessageRequestDtoKind.TEXT,
      text: trimmedText,
      replyToId: options.replyToId || undefined,
      locale,
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

    if (!hasSendTarget || isBlockedByCurrentUser || isBlockedByPeer) return;
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
    let uploadedAttachmentMetadata: PendingAttachmentMetadata[] = [];

    try {
      if (hasAttachedMedia) {
        const uploadResult = await uploadPendingAttachments(attachments);
        uploadedMediaKeys = uploadResult.keys;
        uploadedAttachmentMetadata = uploadResult.metadata;
      }

      await sendMessagePayload({
        kind: uploadedMediaKeys.length > 0
          ? SendMessageRequestDtoKind.MEDIA
          : SendMessageRequestDtoKind.TEXT,
        text: text || undefined,
        replyToId: data.replyToId || undefined,
        mediaKeys: uploadedMediaKeys.length > 0 ? uploadedMediaKeys : undefined,
        attachmentsJson: uploadedAttachmentMetadata.length > 0
          ? JSON.stringify(uploadedAttachmentMetadata)
          : undefined,
        locale,
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
    if (!hasSendTarget || isBlockedByCurrentUser || isBlockedByPeer) return;
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

      const uploadMediaKind = attachment.mediaKind === "music" && !conversationId
        ? "messages"
        : attachment.mediaKind;

      const fileToUpload = await createEditedImageFile(attachment);
      const uploaded = await uploadConversationMedia(fileToUpload, (progress) => {
        setAttachments((currentAttachments) =>
          currentAttachments.map((currentAttachment) =>
            currentAttachment.id === attachmentId
              ? { ...currentAttachment, progress, status: "uploading" }
              : currentAttachment,
          ),
        );
      }, {
        mediaKind: uploadMediaKind,
        conversationId: uploadMediaKind === "messages" ? undefined : conversationId,
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
    const keys: string[] = [];
    const metadata: PendingAttachmentMetadata[] = [];

    for (const attachment of snapshot) {
      const uploadedKey = await uploadAttachment(attachment);
      keys.push(uploadedKey);
      metadata.push(buildPendingAttachmentMetadata(attachment, uploadedKey));
    }

    return { keys, metadata };
  }

  function addPendingFiles(files: File[]) {
    if (files.length === 0) return;

    const nextAttachments = files.map(createPendingAttachment);

    setAttachments((currentAttachments) => [...currentAttachments, ...nextAttachments]);
  }

  function handleSelectFiles(event: ChangeEvent<HTMLInputElement>) {
    addPendingFiles(Array.from(event.target.files ?? []));

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

  function updateImageAttachment(
    attachmentId: string,
    patch: Partial<
      Pick<PendingAttachment, "imageRotation" | "imageStrokes" | "imageTexts">
    >,
  ) {
    setAttachments((currentAttachments) =>
      currentAttachments.map((attachment) =>
        attachment.id === attachmentId
          ? {
              ...attachment,
              ...patch,
            }
          : attachment,
      ),
    );
  }

  function getImageEditorCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || canvas.width === 0 || canvas.height === 0) {
      return { x: 0, y: 0 };
    }

    const bitmapX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const bitmapY = (event.clientY - rect.top) * (canvas.height / rect.height);

    return {
      x: Math.min(1, Math.max(0, bitmapX / canvas.width)),
      y: Math.min(1, Math.max(0, bitmapY / canvas.height)),
    };
  }

  function getImageEditorPointFromCanvasRect(clientX: number, clientY: number) {
    const canvas = imageEditorCanvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect || rect.width === 0 || rect.height === 0 || canvas.width === 0 || canvas.height === 0) {
      return { x: 0, y: 0 };
    }

    const bitmapX = (clientX - rect.left) * (canvas.width / rect.width);
    const bitmapY = (clientY - rect.top) * (canvas.height / rect.height);

    return {
      x: Math.min(1, Math.max(0, bitmapX / canvas.width)),
      y: Math.min(1, Math.max(0, bitmapY / canvas.height)),
    };
  }

  function updateImageTextOverlay(
    attachmentId: string,
    textId: string,
    patch: Partial<Pick<ImageTextOverlay, "text" | "color" | "x" | "y" | "width">>,
  ) {
    setAttachments((currentAttachments) =>
      currentAttachments.map((attachment) =>
        attachment.id === attachmentId
          ? {
              ...attachment,
              imageTexts: attachment.imageTexts.map((textLayer) =>
                textLayer.id === textId
                  ? {
                      ...textLayer,
                      ...patch,
                    }
                  : textLayer,
              ),
            }
          : attachment,
      ),
    );
  }

  function applyImageEditorColor(color: string) {
    setImageEditorColor(color);
    if (editingAttachment && activeImageTextId) {
      updateImageTextOverlay(editingAttachment.id, activeImageTextId, {
        color,
      });
    }
  }

  function handleImageTextLayerCreate(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      !editingAttachment ||
      imageEditorTool !== "text" ||
      !isImageTextPlacementArmed ||
      event.target !== event.currentTarget
    ) {
      return;
    }

    const point = getImageEditorPointFromCanvasRect(event.clientX, event.clientY);
    const textId = createAttachmentId();
    updateImageAttachment(editingAttachment.id, {
      imageTexts: [
        ...editingAttachment.imageTexts,
        {
          id: textId,
          text: "",
          color: imageEditorColor,
          size: 42,
          createdAt: Date.now(),
          x: point.x,
          y: point.y,
          width: 0.28,
        },
      ],
    });
    setActiveImageTextId(textId);
    setIsImageTextPlacementArmed(false);
  }

  function handleImageCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!editingAttachment) return;

    const point = getImageEditorCanvasPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (imageEditorTool === "text") {
      return;
    }

    const strokeId = createAttachmentId();
    activeDrawStrokeIdRef.current = strokeId;
    updateImageAttachment(editingAttachment.id, {
      imageStrokes: [
        ...editingAttachment.imageStrokes,
        {
          id: strokeId,
          color: imageEditorColor,
          size: imageEditorBrushSize,
          createdAt: Date.now(),
          points: [point],
        },
      ],
    });
  }

  function handleImageCanvasPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!editingAttachment || imageEditorTool !== "draw") return;

    const activeStrokeId = activeDrawStrokeIdRef.current;
    if (!activeStrokeId) return;

    const point = getImageEditorCanvasPoint(event);
    setAttachments((currentAttachments) =>
      currentAttachments.map((attachment) =>
        attachment.id === editingAttachment.id
          ? {
              ...attachment,
              imageStrokes: attachment.imageStrokes.map((stroke) =>
                stroke.id === activeStrokeId
                  ? {
                      ...stroke,
                      points: [...stroke.points, point],
                    }
                  : stroke,
              ),
            }
          : attachment,
      ),
    );
  }

  function handleImageCanvasPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    activeDrawStrokeIdRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleImageTextMoveStart(
    event: ReactPointerEvent<HTMLDivElement>,
    textLayer: ImageTextOverlay,
  ) {
    if (!editingAttachment) return;

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveImageTextId(textLayer.id);
    imageTextInteractionRef.current = {
      mode: "move",
      id: textLayer.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: textLayer.x,
      originY: textLayer.y,
      originWidth: textLayer.width,
    };
  }

  function handleImageTextResizeStart(
    event: ReactPointerEvent<HTMLButtonElement>,
    textLayer: ImageTextOverlay,
    edge: "left" | "right",
  ) {
    if (!editingAttachment) return;

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveImageTextId(textLayer.id);
    imageTextInteractionRef.current = {
      mode: "resize",
      id: textLayer.id,
      edge,
      startX: event.clientX,
      originX: textLayer.x,
      originWidth: textLayer.width,
    };
  }

  function handleImageTextPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (!editingAttachment) return;

    const interaction = imageTextInteractionRef.current;
    const canvasRect = imageEditorCanvasRef.current?.getBoundingClientRect();
    if (!interaction || !canvasRect || canvasRect.width === 0 || canvasRect.height === 0) {
      return;
    }

    const deltaX = (event.clientX - interaction.startX) / canvasRect.width;

    if (interaction.mode === "move") {
      const deltaY = (event.clientY - interaction.startY) / canvasRect.height;
      const maxX = Math.max(0, 1 - interaction.originWidth);
      updateImageTextOverlay(editingAttachment.id, interaction.id, {
        x: Math.min(maxX, Math.max(0, interaction.originX + deltaX)),
        y: Math.min(0.95, Math.max(0, interaction.originY + deltaY)),
      });
      return;
    }

    if (interaction.edge === "right") {
      updateImageTextOverlay(editingAttachment.id, interaction.id, {
        width: Math.min(0.9, Math.max(0.12, interaction.originWidth + deltaX)),
      });
      return;
    }

    const nextWidth = Math.min(0.9, Math.max(0.12, interaction.originWidth - deltaX));
    const widthDelta = interaction.originWidth - nextWidth;
    updateImageTextOverlay(editingAttachment.id, interaction.id, {
      x: Math.min(0.95, Math.max(0, interaction.originX + widthDelta)),
      width: nextWidth,
    });
  }

  function handleImageTextPointerUp(event: ReactPointerEvent<HTMLElement>) {
    imageTextInteractionRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function undoLastImageEdit(attachment: PendingAttachment) {
    const lastStroke = attachment.imageStrokes.at(-1);
    const lastText = attachment.imageTexts.at(-1);

    if (lastStroke && (!lastText || lastStroke.createdAt >= lastText.createdAt)) {
      updateImageAttachment(attachment.id, {
        imageStrokes: attachment.imageStrokes.slice(0, -1),
      });
      return;
    }

    if (attachment.imageTexts.length > 0) {
      if (activeImageTextId === lastText?.id) {
        setActiveImageTextId(null);
      }
      updateImageAttachment(attachment.id, {
        imageTexts: attachment.imageTexts.slice(0, -1),
      });
    }
  }

  function clearImageEdits(attachment: PendingAttachment) {
    setActiveImageTextId(null);
    updateImageAttachment(attachment.id, {
      imageStrokes: [],
      imageTexts: [],
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex min-w-0 items-start justify-center gap-2"
    >
      <AnimatePresence>
        {isDraggingFiles ? (
          <motion.div
            key="chat-file-drop-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center bg-background/45 backdrop-blur-[2px]"
          >
            <div className="rounded-2xl border border-primary/35 bg-sidebar/95 px-6 py-5 text-center shadow-2xl">
              <FiPaperclip className="mx-auto size-8 text-primary" />
              <p className="mt-2 text-sm font-semibold">{t("dropFilesTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("dropFilesSubtitle")}</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-end gap-2">
          <motion.div
            layout
            transition={prefersReducedMotion ? { duration: 0 } : SPRING.input}
            className={cn(
              "chat-composer-surface relative min-w-0 flex-1 overflow-hidden border-2 border-border/60 bg-sidebar",
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
                          isImageFile(attachment.file) && "cursor-pointer",
                          attachment.status === "error"
                            ? "border-destructive/70"
                            : "border-border/60",
                        )}
                        onClick={() => {
                          if (isImageFile(attachment.file)) {
                            setEditingAttachmentId(attachment.id);
                          }
                        }}
                      >
                        {attachment.previewUrl && isImageFile(attachment.file) ? (
                          <img
                            src={attachment.previewUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            style={{
                              transform: `rotate(${attachment.imageRotation}deg)`,
                            }}
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
                            {isAudioFile(attachment.file) ? (
                              <FiMusic className="size-5 text-muted-foreground" />
                            ) : attachment.file.type.startsWith("video/") ? (
                              <FiVideo className="size-5 text-muted-foreground" />
                            ) : (
                              <FiFileText className="size-5 text-muted-foreground" />
                            )}
                            <p className="line-clamp-2 text-[10px] font-medium leading-tight text-muted-foreground">
                              {getMediaLabel(attachment.file.name)}
                            </p>
                          </div>
                        ) : null}

                        <button
                          type="button"
                          className="absolute right-1 top-1 z-30 flex size-7 items-center justify-center rounded-full border border-border bg-popover text-popover-foreground shadow-lg transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemoveAttachment(attachment.id);
                          }}
                          disabled={attachment.status === "uploading"}
                          aria-label={t("removeAttachment")}
                        >
                          <FiX className="size-4" />
                        </button>

                        {isImageFile(attachment.file) ? (
                          <span className="absolute left-1 top-1 z-10 rounded-full bg-background/80 p-1 text-foreground shadow-sm">
                            <FiEdit3 className="size-3.5" />
                          </span>
                        ) : null}

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
                  className="input-wrapper min-w-0"
                >
                  <Controller
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                      <Field className="min-w-0 flex-1">
                        <EmojiInput
                          placeholder={botInputPlaceholder || t("placeholder")}
                          className="max-w-full rounded-none border-0 bg-transparent shadow-none"
                          disabled={!hasSendTarget || isBlockedByCurrentUser || isBlockedByPeer}
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
                                !hasSendTarget ||
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
          className="mb-1 shrink-0 self-end"
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

      <AnimatePresence>
        {editingAttachment?.previewUrl && isImageFile(editingAttachment.file) ? (
          <motion.div
            key="attachment-image-editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-background/95 text-foreground"
            onClick={() => setEditingAttachmentId(null)}
          >
            <motion.div
              initial={{ y: 18, scale: 0.985 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 14, scale: 0.985 }}
              className="relative flex h-[min(92vh,48rem)] w-[min(94vw,60rem)] flex-col overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur-md">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-full bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setEditingAttachmentId(null)}
                  aria-label={t("editorCancel")}
                >
                  <FiX className="size-5" />
                </Button>

                <div className="flex items-center gap-1 rounded-full border border-border bg-muted p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-full text-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() =>
                      updateImageAttachment(editingAttachment.id, {
                        imageRotation: editingAttachment.imageRotation - 90,
                      })
                    }
                    title={t("rotateLeft")}
                  >
                    <FiRotateCcw className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-full text-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() =>
                      updateImageAttachment(editingAttachment.id, {
                        imageRotation: editingAttachment.imageRotation + 90,
                      })
                    }
                    title={t("rotateRight")}
                  >
                    <FiRotateCw className="size-4" />
                  </Button>
                </div>

                <Button
                  type="button"
                  className="h-10 rounded-full px-5 font-semibold"
                  onClick={() => setEditingAttachmentId(null)}
                >
                  {t("editorApply")}
                </Button>
              </div>

              <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-44 pt-16 sm:px-8">
                <div className="relative inline-flex max-h-full max-w-full">
                  <canvas
                    ref={imageEditorCanvasRef}
                    className={cn(
                      "h-auto max-h-full max-w-full touch-none rounded-lg shadow-xl",
                      imageEditorTool === "draw" ? "cursor-crosshair" : "pointer-events-none",
                    )}
                    style={imageEditorCanvasSize
                      ? {
                          aspectRatio: `${imageEditorCanvasSize.width} / ${imageEditorCanvasSize.height}`,
                          width: imageEditorCanvasSize.width,
                          height: imageEditorCanvasSize.height,
                        }
                      : undefined}
                    onPointerDown={handleImageCanvasPointerDown}
                    onPointerMove={handleImageCanvasPointerMove}
                    onPointerUp={handleImageCanvasPointerUp}
                    onPointerCancel={handleImageCanvasPointerUp}
                  />
                  <div
                    className={cn(
                      "absolute inset-0 rounded-lg",
                      isImageTextPlacementArmed ? "pointer-events-auto" : "pointer-events-none",
                    )}
                    style={isImageTextPlacementArmed ? { cursor: IMAGE_TEXT_PLACEMENT_CURSOR } : undefined}
                    onPointerDown={handleImageTextLayerCreate}
                  >
                    {editingAttachment.imageTexts.map((textLayer) => {
                      const isActiveText = activeImageTextId === textLayer.id;
                      const fontSize = Math.max(14, textLayer.size * imageEditorCanvasScale);

                      return (
                        <div
                          key={textLayer.id}
                          className={cn(
                            "pointer-events-auto absolute touch-none rounded-md border px-1.5 py-1 transition-colors",
                            isActiveText
                              ? "border-primary bg-background/20"
                              : "border-transparent bg-transparent hover:border-border",
                          )}
                          style={{
                            left: `${textLayer.x * 100}%`,
                            top: `${textLayer.y * 100}%`,
                            width: `${textLayer.width * 100}%`,
                            color: textLayer.color,
                          }}
                          onPointerDown={(event) => handleImageTextMoveStart(event, textLayer)}
                          onPointerMove={handleImageTextPointerMove}
                          onPointerUp={handleImageTextPointerUp}
                          onPointerCancel={handleImageTextPointerUp}
                        >
                          <input
                            value={textLayer.text}
                            autoFocus={isActiveText}
                            onFocus={() => setActiveImageTextId(textLayer.id)}
                            onPointerDown={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              updateImageTextOverlay(editingAttachment.id, textLayer.id, {
                                text: event.target.value,
                              })
                            }
                            placeholder={t("textOnImagePlaceholder")}
                            className="w-full bg-transparent font-bold leading-tight text-current outline-none placeholder:text-muted-foreground"
                            style={{
                              fontSize,
                              textShadow: "0 2px 6px hsl(var(--background) / 0.65)",
                            }}
                          />
                          {isActiveText ? (
                            <>
                              <button
                                type="button"
                                className="absolute -left-2 top-1/2 size-4 -translate-y-1/2 rounded-full border border-border bg-popover"
                                onPointerDown={(event) =>
                                  handleImageTextResizeStart(event, textLayer, "left")
                                }
                                onPointerMove={handleImageTextPointerMove}
                                onPointerUp={handleImageTextPointerUp}
                                onPointerCancel={handleImageTextPointerUp}
                                aria-label={t("resizeText")}
                              />
                              <button
                                type="button"
                                className="absolute -right-2 top-1/2 size-4 -translate-y-1/2 rounded-full border border-border bg-popover"
                                onPointerDown={(event) =>
                                  handleImageTextResizeStart(event, textLayer, "right")
                                }
                                onPointerMove={handleImageTextPointerMove}
                                onPointerUp={handleImageTextPointerUp}
                                onPointerCancel={handleImageTextPointerUp}
                                aria-label={t("resizeText")}
                              />
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 pb-4 pt-4 backdrop-blur-md">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-[1.35rem] border border-border bg-popover p-3 shadow-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex rounded-full bg-muted p-1">
                      <button
                        type="button"
                        className={cn(
                          "flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                          imageEditorTool === "draw" && "bg-background text-foreground",
                        )}
                        onClick={() => {
                          setImageEditorTool("draw");
                          setIsImageTextPlacementArmed(false);
                          setActiveImageTextId(null);
                          imageTextInteractionRef.current = null;
                        }}
                      >
                        <FiPenTool className="size-4" />
                        {t("drawTool")}
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                          imageEditorTool === "text" && isImageTextPlacementArmed &&
                            "bg-background text-foreground",
                        )}
                        onClick={() => {
                          setImageEditorTool("text");
                          setIsImageTextPlacementArmed(true);
                        }}
                      >
                        <FiType className="size-4" />
                        {t("textTool")}
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        onClick={() => undoLastImageEdit(editingAttachment)}
                        title={t("undoEdit")}
                        disabled={
                          editingAttachment.imageStrokes.length === 0 &&
                          editingAttachment.imageTexts.length === 0
                        }
                      >
                        <FiRotateCcw className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        onClick={() => clearImageEdits(editingAttachment)}
                        title={t("clearEdits")}
                        disabled={
                          editingAttachment.imageStrokes.length === 0 &&
                          editingAttachment.imageTexts.length === 0
                        }
                      >
                        <FaTrash className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {IMAGE_EDITOR_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          "size-8 rounded-full border-2 border-border shadow transition-transform hover:scale-105",
                          imageEditorColor === color && "border-foreground ring-2 ring-primary",
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => applyImageEditorColor(color)}
                        aria-label={color}
                      />
                    ))}

                    <label
                      className={cn(
                        "relative flex size-8 items-center justify-center overflow-hidden rounded-full border-2 border-border shadow transition-transform hover:scale-105",
                        imageEditorColor === imageEditorCustomColor &&
                          "border-foreground ring-2 ring-primary",
                      )}
                      style={{ backgroundColor: imageEditorCustomColor }}
                      title={t("customColor")}
                    >
                      <input
                        type="color"
                        value={imageEditorCustomColor}
                        onChange={(event) => {
                          const color = event.target.value;
                          setImageEditorCustomColor(color);
                          applyImageEditorColor(color);
                        }}
                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                        aria-label={t("customColor")}
                      />
                    </label>

                    {imageEditorTool === "draw" ? (
                      <label className="ml-auto flex min-w-44 items-center gap-3 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                        {t("brushSize")}
                        <input
                          type="range"
                          min={3}
                          max={28}
                          value={imageEditorBrushSize}
                          onChange={(event) => setImageEditorBrushSize(Number(event.target.value))}
                          className="w-24 accent-primary"
                        />
                      </label>
                    ) : (
                      <div className="ml-auto flex min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-3 py-2">
                        <FiType className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
                          {t(isImageTextPlacementArmed ? "placeTextHint" : "armTextHint")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isVideoRecording ? (
          <div className="pointer-events-none fixed inset-0 z-[125] flex items-center justify-center">
            <div className="relative size-[min(22rem,72vw)] overflow-hidden rounded-full border border-border bg-card shadow-2xl">
              <video
                ref={ringPreviewRef}
                muted
                playsInline
                autoPlay
                className="size-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-background/20" />
              <div className="absolute inset-x-0 top-0 flex justify-center p-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-popover/90 px-2.5 py-1 text-[11px] font-semibold text-popover-foreground">
                  <span className="size-1.5 rounded-full bg-destructive" />
                  {formatRecordDuration(recordElapsedSeconds)}
                </span>
              </div>
            </div>
          </div>
        ) : null}
    </form>
  );
}
