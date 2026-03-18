"use client";

import { buildApiUrl } from "@/lib/app-config";
import { customFetch } from "@/lib/fetcher";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface SearchHistoryEntry {
  id: string;
  userId: string;
  conversationId: string;
  createdAt: number;
  updatedAt: number;
}

interface SearchHistoryListResponseDto {
  entries: Array<{
    id: string;
    userId: string;
    query: string;
    createdAt: number;
    updatedAt: number;
  }>;
}

interface SearchHistorySingleResponseDto {
  entry: SearchHistoryEntry;
}

export const SEARCH_HISTORY_QUERY_KEY = ["users", "search-history"] as const;

async function fetchSearchHistory(limit = 20) {
  const normalizedLimit = Number.isFinite(limit)
    ? Math.min(50, Math.max(1, Math.trunc(limit)))
    : 20;
  const url = new URL(buildApiUrl("/users/search-history"));
  url.searchParams.set("limit", String(normalizedLimit));

  const response = await customFetch<SearchHistoryListResponseDto>(
    url.toString(),
  );

  return {
    entries: (response.entries ?? [])
      .filter((entry) => Boolean(entry?.id && entry?.query))
      .map((entry) => ({
        id: entry.id,
        userId: entry.userId,
        conversationId: entry.query,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })),
  };
}

async function upsertSearchHistory(conversationId: string) {
  return await customFetch<SearchHistorySingleResponseDto>(
    buildApiUrl("/users/search-history"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: conversationId }),
    },
  );
}

async function deleteSearchHistoryEntry(entryId: string) {
  return await customFetch<{ ok: boolean }>(
    buildApiUrl(`/users/search-history/${encodeURIComponent(entryId)}`),
    {
      method: "DELETE",
    },
  );
}

async function clearSearchHistory() {
  return await customFetch<{ ok: boolean }>(buildApiUrl("/users/search-history"), {
    method: "DELETE",
  });
}

export function useSearchHistory(limit = 20, enabled = true) {
  return useQuery({
    queryKey: [...SEARCH_HISTORY_QUERY_KEY, limit] as const,
    queryFn: () => fetchSearchHistory(limit),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useUpsertSearchHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => upsertSearchHistory(conversationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: SEARCH_HISTORY_QUERY_KEY,
      });
    },
  });
}

export function useDeleteSearchHistoryEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entryId: string) => deleteSearchHistoryEntry(entryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: SEARCH_HISTORY_QUERY_KEY,
      });
    },
  });
}

export function useClearSearchHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearSearchHistory,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: SEARCH_HISTORY_QUERY_KEY,
      });
    },
  });
}
