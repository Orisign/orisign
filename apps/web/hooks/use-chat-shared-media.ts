"use client";

import { buildApiUrl } from "@/lib/app-config";
import { customFetch } from "@/lib/fetcher";
import { coerceProtobufNumber } from "@/lib/protobuf";
import { useInfiniteQuery } from "@tanstack/react-query";

export const CHAT_SHARED_MEDIA_FILTER = {
  MEDIA: "media",
  FILES: "files",
  LINKS: "links",
  VOICE: "voice",
} as const;

export type ChatSharedMediaFilter =
  (typeof CHAT_SHARED_MEDIA_FILTER)[keyof typeof CHAT_SHARED_MEDIA_FILTER];

export const CHAT_SHARED_MEDIA_PAGE_SIZE = 48;

interface RawSharedMediaItem {
  messageId?: string;
  conversationId?: string;
  authorId?: string;
  text?: string;
  mediaKeys?: string[];
  createdAt?: unknown;
}

interface RawListSharedMediaResponse {
  items?: RawSharedMediaItem[];
}

export interface ChatSharedMediaItem {
  messageId: string;
  conversationId: string;
  authorId: string;
  text: string;
  mediaKeys: string[];
  createdAt: number;
}

interface FetchSharedMediaPageParams {
  conversationId: string;
  filter: ChatSharedMediaFilter;
  limit: number;
  offset: number;
}

function getMessagesSharedMediaUrl() {
  return buildApiUrl("/messages/shared-media");
}

function normalizeSharedMediaItem(item: RawSharedMediaItem): ChatSharedMediaItem | null {
  if (!item.messageId || !item.conversationId || !item.authorId) {
    return null;
  }

  return {
    messageId: item.messageId,
    conversationId: item.conversationId,
    authorId: item.authorId,
    text: typeof item.text === "string" ? item.text : "",
    mediaKeys: Array.isArray(item.mediaKeys) ? item.mediaKeys.filter(Boolean) : [],
    createdAt: Math.max(0, Math.trunc(coerceProtobufNumber(item.createdAt) ?? 0)),
  };
}

async function fetchSharedMediaPage({
  conversationId,
  filter,
  limit,
  offset,
}: FetchSharedMediaPageParams) {
  const response = await customFetch<RawListSharedMediaResponse>(
    getMessagesSharedMediaUrl(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId,
        filter,
        limit,
        offset,
      }),
    },
  );

  const items = [...(response.items ?? [])]
    .map(normalizeSharedMediaItem)
    .filter((item): item is ChatSharedMediaItem => item !== null);

  return {
    items,
    nextOffset: offset + items.length,
    hasMore: items.length >= limit,
  };
}

export function getChatSharedMediaQueryKey(
  conversationId: string,
  filter: ChatSharedMediaFilter,
  pageSize: number,
) {
  return ["chat", "shared-media", conversationId, filter, pageSize] as const;
}

export function useChatSharedMedia(
  conversationId: string,
  filter: ChatSharedMediaFilter,
  pageSize = CHAT_SHARED_MEDIA_PAGE_SIZE,
  enabled = true,
) {
  const normalizedPageSize = Number.isFinite(pageSize)
    ? Math.min(100, Math.max(10, Math.trunc(pageSize)))
    : CHAT_SHARED_MEDIA_PAGE_SIZE;

  return useInfiniteQuery({
    queryKey: getChatSharedMediaQueryKey(conversationId, filter, normalizedPageSize),
    queryFn: ({ pageParam }) =>
      fetchSharedMediaPage({
        conversationId,
        filter,
        limit: normalizedPageSize,
        offset: typeof pageParam === "number" ? pageParam : 0,
      }),
    enabled: Boolean(conversationId) && enabled,
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextOffset : undefined,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
