"use client";

import { buildApiUrl } from "@/lib/app-config";
import { customFetch } from "@/lib/fetcher";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface BlockStatusResponse {
  blocked: boolean;
  blockedByTarget: boolean;
}

interface SetBlockPayload {
  targetUserId: string;
  blocked: boolean;
}

function getBlockStatusUrl() {
  return buildApiUrl("/messages/block/status");
}

function getSetBlockUrl() {
  return buildApiUrl("/messages/block");
}

export function getChatBlockStatusQueryKey(targetUserId: string) {
  return ["chat", "block-status", targetUserId] as const;
}

export function useChatBlockStatus(targetUserId?: string | null) {
  return useQuery<BlockStatusResponse>({
    queryKey: getChatBlockStatusQueryKey(targetUserId ?? ""),
    queryFn: async () =>
      customFetch<BlockStatusResponse>(getBlockStatusUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUserId,
        }),
      }),
    enabled: Boolean(targetUserId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useSetChatBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SetBlockPayload) =>
      customFetch<{ ok: boolean }>(getSetBlockUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    onSuccess: async (_result, payload) => {
      await queryClient.invalidateQueries({
        queryKey: getChatBlockStatusQueryKey(payload.targetUserId),
      });
    },
  });
}
