"use client";

import {
  type ConversationResponseDto,
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  type RealtimeMessageDtoKind,
  type UserResponseDto,
  RealtimeMessageDtoKind as RealtimeMessageKind,
  conversationsControllerGet,
  getMessagesControllerListUrl,
  usersControllerGet,
} from "@/api/generated";
import {
  decodeConversationLocator,
  isUsernameConversationLocator,
  normalizeConversationUsername,
} from "@/lib/chat-routes";
import { buildApiUrl } from "@/lib/app-config";
import {
  parseChatReplyMarkup,
  resolveActiveConversationInputMarkup,
  type ActiveConversationInputMarkup,
  type ChatReplyMarkup,
} from "@/lib/bot-reply-markup";
import {
  CHAT_MESSAGES_INITIAL_OFFSET,
  CHAT_MESSAGES_PAGE_SIZE,
  CHAT_QUERY_SCOPE,
} from "@/lib/chat.constants";
import { customFetch } from "@/lib/fetcher";
import { coerceProtobufNumber } from "@/lib/protobuf";
import { useQuery } from "@tanstack/react-query";

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  authorId: string;
  kind: RealtimeMessageDtoKind;
  text: string;
  replyToId: string;
  mediaKeys: string[];
  createdAt: number;
  editedAt: number;
  deletedAt: number;
  entitiesJson: string;
  replyMarkupJson: string;
  attachmentsJson: string;
  sourceBotId: string;
  metadataJson: string;
  replyMarkup: ChatReplyMarkup | null;
}

interface RawListMessagesResponseDto {
  messages: Array<Partial<ChatMessageDto> | null | undefined>;
}

interface FetchChatMessagesPageParams {
  conversationId: string;
  limit: number;
  offset: number;
  replyToId?: string;
  messageId?: string;
  discussionChannelId?: string;
}

export interface ChatMessagesFilter {
  replyToId?: string;
  messageId?: string;
  discussionChannelId?: string;
}

export interface ChatMessagesQueryData {
  messages: ChatMessageDto[];
}

export interface ChatLastMessagePreviewData {
  message: ChatMessageDto | null;
}

export interface ChatReadCursorDto {
  userId: string;
  lastReadMessageId: string;
  lastReadAt: number;
}

interface RawGetChatReadStateResponseDto {
  cursors: Array<Partial<ChatReadCursorDto> | null | undefined>;
}

export interface ChatReadStateQueryData {
  cursors: ChatReadCursorDto[];
}

export interface ChatUnreadCountQueryData {
  count: number;
}

interface UseConversationQueryResult {
  conversation: ConversationResponseDto | null;
}

export const CHAT_MESSAGE_KIND = {
  UNSPECIFIED: RealtimeMessageKind.MESSAGE_KIND_UNSPECIFIED,
  TEXT: RealtimeMessageKind.TEXT,
  MEDIA: RealtimeMessageKind.MEDIA,
  SYSTEM: RealtimeMessageKind.SYSTEM,
} as const;

export function getConversationQueryKey(conversationId: string) {
  return ["conversation", conversationId] as const;
}

export function useConversationQuery(conversationId: string) {
  return useQuery<UseConversationQueryResult>({
    queryKey: getConversationQueryKey(conversationId),
    queryFn: () => conversationsControllerGet({ conversationId }),
    enabled: Boolean(conversationId),
    refetchOnWindowFocus: false,
  });
}

export function getConversationUsernameQueryKey(username: string) {
  return ["conversation-by-username", normalizeConversationUsername(username)] as const;
}

export function useConversationUsernameQuery(username: string) {
  const normalizedUsername = normalizeConversationUsername(username);

  return useQuery<UseConversationQueryResult>({
    queryKey: getConversationUsernameQueryKey(normalizedUsername),
    queryFn: () => conversationsControllerGet({ username: normalizedUsername }),
    enabled: Boolean(normalizedUsername),
    refetchOnWindowFocus: false,
  });
}

export function getRouteUserQueryKey(locator: string) {
  const normalizedLocator = decodeConversationLocator(locator);
  const normalizedUsername = isUsernameConversationLocator(normalizedLocator)
    ? normalizeConversationUsername(normalizedLocator)
    : "";

  return [
    "route-user",
    normalizedUsername ? "username" : "id",
    normalizedUsername || normalizedLocator,
  ] as const;
}

export function useRouteUserQuery(locator: string, enabled = true) {
  const normalizedLocator = decodeConversationLocator(locator);
  const normalizedUsername = isUsernameConversationLocator(normalizedLocator)
    ? normalizeConversationUsername(normalizedLocator)
    : "";
  const normalizedUserId = normalizedUsername ? "" : normalizedLocator;

  return useQuery<{ user: UserResponseDto | null }>({
    queryKey: getRouteUserQueryKey(normalizedLocator),
    queryFn: () =>
      usersControllerGet(
        normalizedUsername
          ? { username: normalizedUsername }
          : { id: normalizedUserId },
      ),
    enabled: enabled && Boolean(normalizedUsername || normalizedUserId),
    refetchOnWindowFocus: false,
  });
}

function normalizeChatMessagesFilter(filter?: ChatMessagesFilter) {
  return {
    replyToId: filter?.replyToId?.trim() ?? "",
    messageId: filter?.messageId?.trim() ?? "",
    discussionChannelId: filter?.discussionChannelId?.trim() ?? "",
  };
}

export function getChatMessagesQueryKey(
  conversationId: string,
  filter?: ChatMessagesFilter,
) {
  const normalizedFilter = normalizeChatMessagesFilter(filter);

  return [
    CHAT_QUERY_SCOPE,
    "messages",
    conversationId,
    normalizedFilter.replyToId,
    normalizedFilter.messageId,
    normalizedFilter.discussionChannelId,
  ] as const;
}

function toFiniteNumber(value: unknown) {
  return coerceProtobufNumber(value) ?? 0;
}

function getMessagesReadStateUrl() {
  return buildApiUrl("/messages/read-state");
}

function getMessagesUnreadCountUrl() {
  return buildApiUrl("/messages/unread-count");
}

function normalizeChatReadCursor(
  cursor: Partial<ChatReadCursorDto> | null | undefined,
): ChatReadCursorDto | null {
  if (!cursor?.userId) {
    return null;
  }

  return {
    userId: cursor.userId,
    lastReadMessageId:
      typeof cursor.lastReadMessageId === "string" ? cursor.lastReadMessageId : "",
    lastReadAt: toFiniteNumber(cursor.lastReadAt),
  };
}

export function normalizeChatMessage(
  message: Partial<ChatMessageDto> | null | undefined,
): ChatMessageDto | null {
  if (!message?.id || !message.conversationId || !message.authorId) {
    return null;
  }

  const deletedAt = toFiniteNumber(message.deletedAt);

  if (deletedAt > 0) {
    return null;
  }

  return {
    id: message.id,
    conversationId: message.conversationId,
    authorId: message.authorId,
    kind:
      typeof message.kind === "string"
        ? (message.kind as RealtimeMessageDtoKind)
        : CHAT_MESSAGE_KIND.UNSPECIFIED,
    text: typeof message.text === "string" ? message.text : "",
    replyToId: typeof message.replyToId === "string" ? message.replyToId : "",
    mediaKeys: Array.isArray(message.mediaKeys) ? message.mediaKeys.filter(Boolean) : [],
    createdAt: toFiniteNumber(message.createdAt),
    editedAt: toFiniteNumber(message.editedAt),
    deletedAt,
    entitiesJson: typeof message.entitiesJson === "string" ? message.entitiesJson : "",
    replyMarkupJson:
      typeof message.replyMarkupJson === "string" ? message.replyMarkupJson : "",
    attachmentsJson:
      typeof message.attachmentsJson === "string" ? message.attachmentsJson : "",
    sourceBotId: typeof message.sourceBotId === "string" ? message.sourceBotId : "",
    metadataJson: typeof message.metadataJson === "string" ? message.metadataJson : "",
    replyMarkup: parseChatReplyMarkup(
      typeof message.replyMarkupJson === "string" ? message.replyMarkupJson : "",
    ),
  };
}

export function appendChatMessageToData(
  data: ChatMessagesQueryData | undefined,
  message: ChatMessageDto,
): ChatMessagesQueryData {
  const currentMessages = data?.messages ?? [];
  const withoutCurrent = currentMessages.filter((entry) => entry.id !== message.id);

  return {
    messages: [...withoutCurrent, message].sort((left, right) => left.createdAt - right.createdAt),
  };
}

export function prependChatMessagesToData(
  data: ChatMessagesQueryData | undefined,
  messages: ChatMessageDto[],
): ChatMessagesQueryData {
  const currentMessages = data?.messages ?? [];
  const currentIds = new Set(currentMessages.map((message) => message.id));
  const uniquePrepended = messages.filter((message) => !currentIds.has(message.id));

  return {
    messages: [...uniquePrepended, ...currentMessages],
  };
}

export function getChatReadStateQueryKey(conversationId: string) {
  return [CHAT_QUERY_SCOPE, "read-state", conversationId] as const;
}

export function upsertChatReadCursorInData(
  data: ChatReadStateQueryData | undefined,
  cursor: ChatReadCursorDto,
): ChatReadStateQueryData {
  const cursors = data?.cursors ?? [];
  const nextCursors = cursors.filter((entry) => entry.userId !== cursor.userId);
  nextCursors.push(cursor);

  return {
    cursors: nextCursors.sort((left, right) => left.userId.localeCompare(right.userId)),
  };
}

export function removeChatMessageFromData(
  data: ChatMessagesQueryData | undefined,
  messageId: string,
): ChatMessagesQueryData | undefined {
  if (!data) return data;

  return {
    messages: data.messages.filter((entry) => entry.id !== messageId),
  };
}

export function bumpConversationInListData(
  data: ListMyConversationsResponseDto | undefined,
  conversationId: string,
  updatedAt: number,
) {
  if (!data) return data;

  const conversations = [...(data.conversations ?? [])];
  const conversationIndex = conversations.findIndex(
    (conversation) => conversation.id === conversationId,
  );

  if (conversationIndex < 0) return data;

  const [conversation] = conversations.splice(conversationIndex, 1);
  conversations.unshift({
    ...conversation,
    updatedAt,
  });

  return {
    ...data,
    conversations,
  };
}

export function bumpConversationQueryData(
  data: GetConversationResponseDto | undefined,
  updatedAt: number,
) {
  if (!data?.conversation) return data;

  return {
    ...data,
    conversation: {
      ...data.conversation,
      updatedAt,
    },
  };
}

export async function fetchChatMessagesPage({
  conversationId,
  limit,
  offset,
  replyToId,
  messageId,
  discussionChannelId,
}: FetchChatMessagesPageParams): Promise<ChatMessageDto[]> {
  const response = await customFetch<RawListMessagesResponseDto>(
    getMessagesControllerListUrl(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId,
        limit,
        offset,
        replyToId: replyToId?.trim() || undefined,
        messageId: messageId?.trim() || undefined,
        discussionChannelId: discussionChannelId?.trim() || undefined,
      }),
    },
  );

  return [...(response.messages ?? [])]
    .map(normalizeChatMessage)
    .filter((message): message is ChatMessageDto => message !== null)
    .reverse();
}

export function useChatMessages(
  conversationId: string,
  filter?: ChatMessagesFilter,
) {
  const normalizedFilter = normalizeChatMessagesFilter(filter);

  return useQuery<ChatMessagesQueryData>({
    queryKey: getChatMessagesQueryKey(conversationId, normalizedFilter),
    queryFn: async () => {
      const messages = await fetchChatMessagesPage({
        conversationId,
        limit: CHAT_MESSAGES_PAGE_SIZE,
        offset: CHAT_MESSAGES_INITIAL_OFFSET,
        replyToId: normalizedFilter.replyToId,
        messageId: normalizedFilter.messageId,
        discussionChannelId: normalizedFilter.discussionChannelId,
      });

      return {
        messages,
      };
    },
    enabled: Boolean(conversationId),
    initialData: conversationId ? undefined : { messages: [] },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useChatInputMarkup(
  conversationId: string,
  filter?: ChatMessagesFilter,
) {
  const normalizedFilter = normalizeChatMessagesFilter(filter);

  return useQuery<
    ChatMessagesQueryData,
    Error,
    ActiveConversationInputMarkup<ChatMessageDto> | null
  >({
    queryKey: getChatMessagesQueryKey(conversationId, normalizedFilter),
    queryFn: async () => {
      const messages = await fetchChatMessagesPage({
        conversationId,
        limit: CHAT_MESSAGES_PAGE_SIZE,
        offset: CHAT_MESSAGES_INITIAL_OFFSET,
        replyToId: normalizedFilter.replyToId,
        messageId: normalizedFilter.messageId,
        discussionChannelId: normalizedFilter.discussionChannelId,
      });

      return {
        messages,
      };
    },
    select: (data) => resolveActiveConversationInputMarkup(data.messages),
    enabled: Boolean(conversationId),
    initialData: conversationId ? undefined : { messages: [] },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function getChatLastMessagePreviewQueryKey(conversationId: string) {
  return [CHAT_QUERY_SCOPE, "messages", "last-preview", conversationId] as const;
}

export function useChatLastMessagePreview(conversationId: string) {
  return useQuery<ChatLastMessagePreviewData>({
    queryKey: getChatLastMessagePreviewQueryKey(conversationId),
    queryFn: async () => {
      const response = await customFetch<RawListMessagesResponseDto>(
        getMessagesControllerListUrl(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId,
            limit: 1,
            offset: CHAT_MESSAGES_INITIAL_OFFSET,
          }),
        },
      );

      const message =
        [...(response.messages ?? [])]
          .map(normalizeChatMessage)
          .filter((entry): entry is ChatMessageDto => entry !== null)
          .at(0) ?? null;

      return { message };
    },
    enabled: Boolean(conversationId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useChatReadState(conversationId: string) {
  return useQuery<ChatReadStateQueryData>({
    queryKey: getChatReadStateQueryKey(conversationId),
    queryFn: async () => {
      const response = await customFetch<RawGetChatReadStateResponseDto>(
        getMessagesReadStateUrl(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId,
          }),
        },
      );

      return {
        cursors: [...(response.cursors ?? [])]
          .map(normalizeChatReadCursor)
          .filter((cursor): cursor is ChatReadCursorDto => cursor !== null),
      };
    },
    enabled: Boolean(conversationId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function getChatUnreadCountQueryKey(conversationId: string) {
  return [CHAT_QUERY_SCOPE, "unread-count", conversationId] as const;
}

export function useChatUnreadCount(conversationId: string) {
  return useQuery<ChatUnreadCountQueryData>({
    queryKey: getChatUnreadCountQueryKey(conversationId),
    queryFn: async () => {
      const response = await customFetch<{ count?: unknown }>(
        getMessagesUnreadCountUrl(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId,
          }),
        },
      );

      return {
        count: Math.max(0, Math.trunc(toFiniteNumber(response.count))),
      };
    },
    enabled: Boolean(conversationId),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function getChatAuthorsQueryKey(authorIds: string[]) {
  return [CHAT_QUERY_SCOPE, "authors", authorIds] as const;
}

export function useChatAuthors(authorIds: string[]) {
  const uniqueAuthorIds = [...new Set(authorIds.filter(Boolean))].sort();

  return useQuery<Record<string, UserResponseDto | null>>({
    queryKey: getChatAuthorsQueryKey(uniqueAuthorIds),
    queryFn: async () => {
      const entries = await Promise.all(
        uniqueAuthorIds.map(async (authorId) => {
          try {
            const response = await usersControllerGet({ id: authorId });
            return [authorId, response.user ?? null] as const;
          } catch {
            return [authorId, null] as const;
          }
        }),
      );

      return Object.fromEntries(entries);
    },
    enabled: uniqueAuthorIds.length > 0,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
}
