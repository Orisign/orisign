"use client";

import type {
  ConversationResponseDto,
  ListMyConversationsResponseDto,
  UserResponseDto,
} from "@/api/generated";
import type { ChatMessagesFilter, ChatMessagesQueryData } from "@/hooks/use-chat";
import { resolveChatMediaKind } from "@/lib/chat";
import {
  readRecord,
  readRecordsByPrefix,
  deleteRecordsByPrefix,
  deleteRecordsOlderThan,
  writeRecord,
} from "./chat-cache-db";
import { clearMemoryPrefix, readMemory, writeMemory } from "./chat-cache-memory";
import type {
  CachedConversationList,
  CachedMessages,
  CachedUsers,
  ChatCacheStats,
} from "./chat-cache-types";

const AUTH_STORE_KEY = "auth-store";
const ROOT_PREFIX = "u:";

function readStoredAuthUserId() {
  if (typeof window === "undefined") return "";

  try {
    const raw = window.localStorage.getItem(AUTH_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) as { state?: { user?: { id?: string } } } : null;
    return parsed?.state?.user?.id ?? "";
  } catch {
    return "";
  }
}

export function getCacheUserId(userId?: string | null) {
  return userId?.trim() || readStoredAuthUserId();
}

function userPrefix(userId: string) {
  return `${ROOT_PREFIX}${userId}:`;
}

function listKey(userId: string) {
  return `${userPrefix(userId)}conversations:my`;
}

function filterKey(filter?: ChatMessagesFilter) {
  return [
    filter?.replyToId?.trim() ?? "",
    filter?.messageId?.trim() ?? "",
    filter?.discussionChannelId?.trim() ?? "",
  ].join("|");
}

function messagesKey(userId: string, conversationId: string, filter?: ChatMessagesFilter) {
  return `${userPrefix(userId)}messages:${conversationId}:${filterKey(filter)}`;
}

function mediaKey(userId: string, key: string) {
  return `${userPrefix(userId)}media:${key}`;
}

function usersKey(userId: string, ids: string[]) {
  return `${userPrefix(userId)}users:${[...new Set(ids)].sort().join(",")}`;
}

function statsFor(records: Awaited<ReturnType<typeof readRecordsByPrefix>>) {
  const stats: ChatCacheStats = {
    totalBytes: 0,
    conversationsBytes: 0,
    messagesBytes: 0,
    usersBytes: 0,
    mediaBytes: 0,
    otherBytes: 0,
    records: records.length,
  };

  for (const record of records) {
    const size = record.size || 0;
    stats.totalBytes += size;

    if (record.key.includes(":conversations:")) stats.conversationsBytes += size;
    else if (record.key.includes(":messages:")) stats.messagesBytes += size;
    else if (record.key.includes(":users:")) stats.usersBytes += size;
    else if (record.key.includes(":media:")) stats.mediaBytes += size;
    else stats.otherBytes += size;
  }

  return stats;
}

export async function readCachedConversations(userId?: string | null) {
  const id = getCacheUserId(userId);
  if (!id) return null;

  const key = listKey(id);
  const memory = readMemory<CachedConversationList>(key);
  if (memory) return { conversations: memory.conversations };

  const cached = await readRecord<CachedConversationList>(key);
  if (!cached) return null;

  writeMemory(key, cached);
  return { conversations: cached.conversations };
}

export async function writeCachedConversations(
  data: ListMyConversationsResponseDto,
  userId?: string | null,
) {
  const id = getCacheUserId(userId);
  if (!id) return;

  const value: CachedConversationList = {
    conversations: data.conversations,
    ids: data.conversations.map((item) => item.id),
    lastSyncAt: Date.now(),
  };
  const key = listKey(id);

  writeMemory(key, value);
  await writeRecord(key, value);
}

export async function readCachedMessages(
  conversationId: string,
  filter?: ChatMessagesFilter,
  userId?: string | null,
) {
  const id = getCacheUserId(userId);
  if (!id || !conversationId) return null;

  const key = messagesKey(id, conversationId, filter);
  const memory = readMemory<CachedMessages>(key);
  if (memory) return { messages: memory.messages };

  const cached = await readRecord<CachedMessages>(key);
  if (!cached) return null;

  writeMemory(key, cached);
  return { messages: cached.messages };
}

export async function writeCachedMessages(
  conversationId: string,
  data: ChatMessagesQueryData,
  filter?: ChatMessagesFilter,
  userId?: string | null,
) {
  const id = getCacheUserId(userId);
  if (!id || !conversationId) return;

  const value: CachedMessages = {
    messages: data.messages,
    ids: data.messages.map((message) => message.id),
    lastSyncAt: Date.now(),
  };
  const key = messagesKey(id, conversationId, filter);

  writeMemory(key, value);
  await writeRecord(key, value);
  await Promise.all(
    data.messages.flatMap((message) =>
      message.mediaKeys.filter(Boolean).map((key) =>
        writeRecord(mediaKey(id, key), {
          key,
          kind: resolveChatMediaKind(key),
          messageId: message.id,
          conversationId: message.conversationId,
          updatedAt: Date.now(),
        }),
      ),
    ),
  );
}

export async function readCachedUsers(ids: string[], userId?: string | null) {
  const id = getCacheUserId(userId);
  const uniqueIds = [...new Set(ids.filter(Boolean))].sort();
  if (!id || uniqueIds.length === 0) return null;

  const key = usersKey(id, uniqueIds);
  const memory = readMemory<CachedUsers>(key);
  if (memory) return memory.users;

  const cached = await readRecord<CachedUsers>(key);
  if (!cached) return null;

  writeMemory(key, cached);
  return cached.users;
}

export async function writeCachedUsers(
  users: Record<string, UserResponseDto | null>,
  userId?: string | null,
) {
  const id = getCacheUserId(userId);
  const userIds = Object.keys(users).filter(Boolean);
  if (!id || userIds.length === 0) return;

  const value: CachedUsers = {
    users,
    lastSyncAt: Date.now(),
  };
  const key = usersKey(id, userIds);

  writeMemory(key, value);
  await writeRecord(key, value);
}

export async function getChatCacheStats(userId?: string | null) {
  const id = getCacheUserId(userId);
  if (!id) return statsFor([]);

  return statsFor(await readRecordsByPrefix(userPrefix(id)));
}

export async function clearCacheForUser(userId?: string | null) {
  const id = getCacheUserId(userId);
  if (!id) return;

  const prefix = userPrefix(id);
  clearMemoryPrefix(prefix);
  await deleteRecordsByPrefix(prefix);
}

export async function pruneCacheForUser(maxAgeDays: number, userId?: string | null) {
  const id = getCacheUserId(userId);
  if (!id || !Number.isFinite(maxAgeDays) || maxAgeDays <= 0) return;

  await deleteRecordsOlderThan(userPrefix(id), maxAgeDays * 24 * 60 * 60 * 1000);
}

export function sortConversations(conversations: ConversationResponseDto[]) {
  return [...conversations].sort(
    (left, right) =>
      (right.updatedAt || right.createdAt) - (left.updatedAt || left.createdAt),
  );
}
