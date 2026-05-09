"use client";

import type {
  ConversationResponseDto,
  ListMyConversationsResponseDto,
  UserResponseDto,
} from "@/api/generated";
import type { ChatMessageDto, ChatMessagesQueryData } from "@/hooks/use-chat";

export const CHAT_CACHE_SCHEMA_VERSION = 1;
export const CHAT_CACHE_DB_NAME = "orisign-chat-cache";

export interface ChatCacheRecord<T> {
  key: string;
  value: T;
  updatedAt: number;
  size: number;
}

export interface CachedConversationList {
  conversations: ConversationResponseDto[];
  ids: string[];
  lastSyncAt: number;
}

export interface CachedMessages {
  messages: ChatMessageDto[];
  ids: string[];
  lastSyncAt: number;
}

export interface CachedUsers {
  users: Record<string, UserResponseDto | null>;
  lastSyncAt: number;
}

export interface ChatCacheStats {
  totalBytes: number;
  conversationsBytes: number;
  messagesBytes: number;
  usersBytes: number;
  mediaBytes: number;
  otherBytes: number;
  records: number;
}

export type CacheableChatData =
  | CachedConversationList
  | CachedMessages
  | CachedUsers
  | ListMyConversationsResponseDto
  | ChatMessagesQueryData
  | Record<string, UserResponseDto | null>;
