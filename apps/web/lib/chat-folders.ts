import type { ConversationResponseDto } from "@/api/generated";
import { CHAT_CONVERSATION_TYPE } from "@/lib/chat";

export type IncludedChatType =
  | "contacts"
  | "nonContacts"
  | "groups"
  | "channels"
  | "bots";

export type ExcludedChatType = "muted" | "archived" | "read";
export const CHAT_FOLDER_DRAFT_ID = "__draft__";
export const CHAT_FOLDER_ALL_TAB_ID = "__all__";

export interface ChatFolder {
  id: string;
  userId: string;
  name: string;
  includedChatIds: string[];
  excludedChatIds: string[];
  includedTypes: IncludedChatType[];
  excludedTypes: ExcludedChatType[];
  inviteLink?: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateChatFolderPayload {
  name: string;
  includedChatIds?: string[];
  excludedChatIds?: string[];
  includedTypes?: IncludedChatType[];
  excludedTypes?: ExcludedChatType[];
  inviteLink?: string;
  sortOrder?: number;
}

export interface UpdateChatFolderPayload {
  name?: string;
  includedChatIds?: string[];
  excludedChatIds?: string[];
  includedTypes?: IncludedChatType[];
  excludedTypes?: ExcludedChatType[];
  inviteLink?: string;
  sortOrder?: number;
}

export function normalizeChatFolderName(value: string, fallback: string) {
  const normalized = value.trim();
  return normalized || fallback;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function normalizeChatFolder(input: unknown): ChatFolder {
  const source = (input ?? {}) as Record<string, unknown>;
  const now = Date.now();

  const includedChatIds = readStringArray(
    source.includedChatIds ?? source.included_chat_ids,
  );
  const excludedChatIds = readStringArray(
    source.excludedChatIds ?? source.excluded_chat_ids,
  );
  const includedTypes = readStringArray(
    source.includedTypes ?? source.included_types,
  ) as IncludedChatType[];
  const excludedTypes = readStringArray(
    source.excludedTypes ?? source.excluded_types,
  ) as ExcludedChatType[];

  return {
    id: readString(source.id),
    userId: readString(source.userId ?? source.user_id),
    name: readString(source.name, "New folder"),
    includedChatIds,
    excludedChatIds,
    includedTypes,
    excludedTypes,
    inviteLink: readString(source.inviteLink ?? source.invite_link) || undefined,
    sortOrder: readNumber(source.sortOrder ?? source.sort_order, 0),
    createdAt: readNumber(source.createdAt ?? source.created_at, now),
    updatedAt: readNumber(source.updatedAt ?? source.updated_at, now),
  };
}

function toConversationType(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function isDirectConversation(conversation: ConversationResponseDto) {
  return toConversationType(conversation.type) === CHAT_CONVERSATION_TYPE.DM;
}

function isGroupConversation(conversation: ConversationResponseDto) {
  return toConversationType(conversation.type) === CHAT_CONVERSATION_TYPE.GROUP;
}

function isChannelConversation(conversation: ConversationResponseDto) {
  return toConversationType(conversation.type) === CHAT_CONVERSATION_TYPE.CHANNEL;
}

function isBotConversation(conversation: ConversationResponseDto) {
  if (!isDirectConversation(conversation)) {
    return false;
  }

  const username = (conversation.username ?? "").trim().toLowerCase();
  const title = (conversation.title ?? "").trim().toLowerCase();

  if (username.endsWith("bot")) {
    return true;
  }

  return /\bbot\b/.test(title);
}

function matchesIncludedType(
  conversation: ConversationResponseDto,
  type: IncludedChatType,
) {
  switch (type) {
    case "groups":
      return isGroupConversation(conversation);
    case "channels":
      return isChannelConversation(conversation);
    case "bots":
      return isBotConversation(conversation);
    case "contacts":
      return isDirectConversation(conversation) && !isBotConversation(conversation);
    case "nonContacts":
      return false;
    default:
      return false;
  }
}

function matchesExcludedType(
  conversation: ConversationResponseDto,
  type: ExcludedChatType,
) {
  switch (type) {
    case "muted":
    case "archived":
    case "read":
      // These flags are not exposed in ConversationResponseDto yet.
      return false;
    default:
      return false;
  }
}

export function filterConversationsByChatFolder(
  conversations: ConversationResponseDto[],
  folder: ChatFolder | null | undefined,
) {
  if (!folder) {
    return conversations;
  }

  const includedChatIds = new Set(folder.includedChatIds ?? []);
  const excludedChatIds = new Set(folder.excludedChatIds ?? []);
  const includedTypes = folder.includedTypes ?? [];
  const excludedTypes = folder.excludedTypes ?? [];
  const hasIncludeRules = includedChatIds.size > 0 || includedTypes.length > 0;

  return conversations.filter((conversation) => {
    const includedById = includedChatIds.has(conversation.id);
    const includedByType = includedTypes.some((type) =>
      matchesIncludedType(conversation, type),
    );
    const shouldInclude = hasIncludeRules ? includedById || includedByType : true;

    if (!shouldInclude) {
      return false;
    }

    if (excludedChatIds.has(conversation.id)) {
      return false;
    }

    const excludedByType = excludedTypes.some((type) =>
      matchesExcludedType(conversation, type),
    );

    return !excludedByType;
  });
}
