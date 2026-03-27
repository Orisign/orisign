import type { ChatMessageDto } from "@/hooks/use-chat";
import type { ConversationResponseDto, UserResponseDto } from "@/api/generated";
import type { TimeFormatMode } from "@/store/settings/general-settings.store";
import { buildStorageFileUrl } from "./app-config";
import { coerceProtobufNumber } from "./protobuf";
import { formatCallDurationLabel, parseCallLogMessageText } from "./call-log-message";
import { stripMessageFormatting } from "./chat-message-format";

const CHAT_VISUAL_PALETTE = [
  {
    avatarGradientClassName: "from-sky-500 to-blue-600",
    avatarClassName: "bg-linear-to-br from-sky-500 to-blue-600",
    nameClassName: "text-sky-400",
  },
  {
    avatarGradientClassName: "from-emerald-500 to-green-600",
    avatarClassName: "bg-linear-to-br from-emerald-500 to-green-600",
    nameClassName: "text-emerald-400",
  },
  {
    avatarGradientClassName: "from-amber-500 to-orange-600",
    avatarClassName: "bg-linear-to-br from-amber-500 to-orange-600",
    nameClassName: "text-amber-400",
  },
  {
    avatarGradientClassName: "from-fuchsia-500 to-pink-600",
    avatarClassName: "bg-linear-to-br from-fuchsia-500 to-pink-600",
    nameClassName: "text-pink-400",
  },
  {
    avatarGradientClassName: "from-violet-500 to-indigo-600",
    avatarClassName: "bg-linear-to-br from-violet-500 to-indigo-600",
    nameClassName: "text-violet-400",
  },
  {
    avatarGradientClassName: "from-cyan-500 to-sky-600",
    avatarClassName: "bg-linear-to-br from-cyan-500 to-sky-600",
    nameClassName: "text-cyan-400",
  },
  {
    avatarGradientClassName: "from-lime-500 to-emerald-600",
    avatarClassName: "bg-linear-to-br from-lime-500 to-emerald-600",
    nameClassName: "text-lime-400",
  },
] as const;

function hashSeed(seed: string) {
  return Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

export function getAvatarGradient(seed: string) {
  const hash = hashSeed(seed);
  return CHAT_VISUAL_PALETTE[hash % CHAT_VISUAL_PALETTE.length].avatarGradientClassName;
}

export function getConversationParticipantVisual(
  conversationId: string | null | undefined,
  userId: string | null | undefined,
) {
  const seed = `${conversationId ?? "chat"}:${userId ?? "user"}`;
  const hash = hashSeed(seed);

  return CHAT_VISUAL_PALETTE[hash % CHAT_VISUAL_PALETTE.length];
}

export function normalizeTimestamp(value: unknown) {
  const numericValue = coerceProtobufNumber(value);

  if (!Number.isFinite(numericValue) || (numericValue ?? 0) <= 0) return null;
  if ((numericValue ?? 0) > 1_000_000_000_000) return numericValue as number;
  if ((numericValue ?? 0) > 1_000_000_000) return (numericValue as number) * 1000;
  return null;
}

export function getConversationTitle(conversation: ConversationResponseDto) {
  return conversation.title || conversation.username || "Без названия";
}

export function getConversationSubtitle(conversation: ConversationResponseDto) {
  return conversation.about || (conversation.username ? `@${conversation.username}` : "Нет сообщений");
}

export function getConversationInitial(conversation: ConversationResponseDto) {
  return getConversationTitle(conversation)[0]?.toUpperCase() ?? "#";
}

interface TimeFormatOptions {
  timeFormat?: TimeFormatMode;
}

function resolveHour12Value(timeFormat: TimeFormatMode | undefined) {
  if (timeFormat === "12h") return true;
  if (timeFormat === "24h") return false;
  return undefined;
}

export function formatTimestampTime(
  value: number | null | undefined,
  locale = "ru-RU",
  options: TimeFormatOptions = {},
) {
  const normalized = normalizeTimestamp(value);
  if (!normalized) return "";

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: resolveHour12Value(options.timeFormat),
  }).format(new Date(normalized));
}

export function formatConversationTime(
  conversation: ConversationResponseDto,
  locale = "ru-RU",
  options: TimeFormatOptions = {},
) {
  return formatTimestampTime(
    conversation.updatedAt || conversation.createdAt,
    locale,
    options,
  );
}

export function resolveStorageFileUrl(value: string | null | undefined) {
  return buildStorageFileUrl(value);
}

export function getUserDisplayName(
  user: Pick<UserResponseDto, "firstName" | "lastName" | "username"> | null | undefined,
  fallback = "",
) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

  if (fullName) return fullName;
  if (user?.username) return `@${user.username}`;

  return fallback;
}

export function getUserInitial(
  user: Pick<UserResponseDto, "firstName" | "lastName" | "username"> | null | undefined,
  fallback = "#",
) {
  const displayName = getUserDisplayName(user, fallback).replace(/^@/, "");
  return displayName[0]?.toUpperCase() ?? fallback[0]?.toUpperCase() ?? "#";
}

export function getUserAvatarUrl(
  user: Pick<UserResponseDto, "avatars"> | null | undefined,
) {
  return resolveStorageFileUrl(user?.avatars?.at(-1));
}

export function isSameCalendarDay(
  left: number | null | undefined,
  right: number | null | undefined,
) {
  const normalizedLeft = normalizeTimestamp(left);
  const normalizedRight = normalizeTimestamp(right);

  if (!normalizedLeft || !normalizedRight) return false;

  const leftDate = new Date(normalizedLeft);
  const rightDate = new Date(normalizedRight);

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

export function formatChatDayLabel(
  value: number | null | undefined,
  locale: string,
  labels: {
    today: string;
    yesterday: string;
  },
) {
  const normalized = normalizeTimestamp(value);
  if (!normalized) return "";

  const targetDate = new Date(normalized);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );

  const diffDays = Math.round(
    (startOfToday.getTime() - startOfTarget.getTime()) / 86_400_000,
  );

  if (diffDays === 0) return labels.today;
  if (diffDays === 1) return labels.yesterday;

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    ...(targetDate.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  }).format(targetDate);
}

const IMAGE_MEDIA_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".bmp",
  ".svg",
] as const;

const VIDEO_MEDIA_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".mkv",
] as const;

const AUDIO_MEDIA_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".webm",
  ".opus",
] as const;

export const CHAT_MEDIA_KIND = {
  IMAGE: "image",
  VIDEO: "video",
  VOICE: "voice",
  RING: "ring",
  FILE: "file",
} as const;

export type ChatMediaKind = (typeof CHAT_MEDIA_KIND)[keyof typeof CHAT_MEDIA_KIND];

export const CHAT_CONVERSATION_TYPE = {
  DM: "DM",
  GROUP: "GROUP",
  CHANNEL: "CHANNEL",
  SUPERGROUP: "SUPERGROUP",
} as const;

function toConversationType(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function isDirectConversation(conversation: ConversationResponseDto | null | undefined) {
  return toConversationType(conversation?.type) === CHAT_CONVERSATION_TYPE.DM;
}

export function isBotProjectionUserId(userId: string | null | undefined) {
  return typeof userId === "string" && userId.startsWith("botusr_");
}

export function getConversationAvatarUrl(
  conversation: ConversationResponseDto | null | undefined,
) {
  const avatarKey = (conversation as { avatarKey?: string } | null | undefined)?.avatarKey;
  return resolveStorageFileUrl(avatarKey);
}

export function isImageMediaKey(value: string | null | undefined) {
  if (!value) return false;

  const normalized = value.toLowerCase().split("?")[0];
  return IMAGE_MEDIA_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

export function isVideoMediaKey(value: string | null | undefined) {
  if (!value) return false;

  const normalized = value.toLowerCase().split("?")[0];
  return VIDEO_MEDIA_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

export function isAudioMediaKey(value: string | null | undefined) {
  if (!value) return false;

  const normalized = value.toLowerCase().split("?")[0];
  return AUDIO_MEDIA_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

export function isVoiceMediaKey(value: string | null | undefined) {
  if (!value) return false;

  const normalized = value.toLowerCase().split("?")[0];
  return (
    normalized.includes("media/voice/") ||
    normalized.includes("/media/voice/") ||
    normalized.includes("\\media\\voice\\")
  );
}

export function isRingMediaKey(value: string | null | undefined) {
  if (!value) return false;

  const normalized = value.toLowerCase().split("?")[0];
  return (
    normalized.includes("media/ring/") ||
    normalized.includes("/media/ring/") ||
    normalized.includes("\\media\\ring\\")
  );
}

export function resolveChatMediaKind(value: string | null | undefined): ChatMediaKind {
  if (!value) return CHAT_MEDIA_KIND.FILE;
  if (isVoiceMediaKey(value)) return CHAT_MEDIA_KIND.VOICE;
  if (isRingMediaKey(value)) return CHAT_MEDIA_KIND.RING;
  if (isImageMediaKey(value)) return CHAT_MEDIA_KIND.IMAGE;
  if (isVideoMediaKey(value)) return CHAT_MEDIA_KIND.VIDEO;
  if (isAudioMediaKey(value)) return CHAT_MEDIA_KIND.VOICE;
  return CHAT_MEDIA_KIND.FILE;
}

export function getMediaLabel(value: string | null | undefined) {
  if (!value) return "";

  return value.split(/[\\/]/).at(-1)?.split("?")[0] ?? value;
}

export function formatChatListMessagePreview(
  message: Pick<ChatMessageDto, "text" | "mediaKeys"> | null | undefined,
  options: {
    prefixLabel?: string;
    callLabels: {
      title: string;
      separator: string;
      status: {
        completed: string;
        declined: string;
        canceled: string;
        failed: string;
      };
    };
    mediaLabels: {
      photo: string;
      file: string;
      attachment: string;
    };
  },
) {
  if (!message) {
    return "";
  }

  const trimmedText = stripMessageFormatting(message.text).replace(/\s+/g, " ").trim();
  const callLogPayload = parseCallLogMessageText(trimmedText);
  if (callLogPayload) {
    const statusLabel = options.callLabels.status[callLogPayload.status];
    const durationLabel = formatCallDurationLabel(callLogPayload.durationSeconds);
    const parts = [options.callLabels.title, durationLabel, statusLabel].filter(Boolean);
    const summary = parts.join(` ${options.callLabels.separator} `);

    return options.prefixLabel ? `${options.prefixLabel} ${summary}` : summary;
  }

  const firstMediaKey = message.mediaKeys.at(0);
  let basePreview = trimmedText;

  if (!basePreview && firstMediaKey) {
    if (isImageMediaKey(firstMediaKey)) {
      basePreview = options.mediaLabels.photo;
    } else if (getMediaLabel(firstMediaKey)) {
      basePreview = options.mediaLabels.file;
    } else {
      basePreview = options.mediaLabels.attachment;
    }
  }

  if (!basePreview) {
    return "";
  }

  return options.prefixLabel ? `${options.prefixLabel} ${basePreview}` : basePreview;
}
