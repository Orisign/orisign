import type { ConversationResponseDto } from "@/api/generated";

const AVATAR_GRADIENTS = [
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-green-600",
  "from-amber-500 to-orange-600",
  "from-fuchsia-500 to-pink-600",
  "from-indigo-500 to-violet-600",
] as const;

export function getAvatarGradient(seed: string) {
  const hash = Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export function normalizeTimestamp(value: number | null | undefined) {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return null;
  if ((value ?? 0) > 1_000_000_000_000) return value as number;
  if ((value ?? 0) > 1_000_000_000) return (value as number) * 1000;
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

export function formatTimestampTime(value: number | null | undefined, locale = "ru-RU") {
  const normalized = normalizeTimestamp(value);
  if (!normalized) return "";

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(normalized));
}

export function formatConversationTime(
  conversation: ConversationResponseDto,
  locale = "ru-RU",
) {
  return formatTimestampTime(conversation.updatedAt || conversation.createdAt, locale);
}
