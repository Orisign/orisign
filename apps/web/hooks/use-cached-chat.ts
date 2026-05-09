"use client";

import {
  type ListMyConversationsResponseDto,
  getConversationsControllerMyQueryKey,
  useConversationsControllerMy,
} from "@/api/generated";
import {
  type ChatMessagesQueryData,
  type ChatMessagesFilter,
  getChatMessagesQueryKey,
} from "@/hooks/use-chat";
import {
  readCachedConversations,
  writeCachedConversations,
  writeCachedMessages,
  writeCachedUsers,
} from "@/lib/cache/chat-cache-service";
import { CHAT_QUERY_SCOPE } from "@/lib/chat.constants";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function useCachedConversations() {
  const queryClient = useQueryClient();
  const [cachedData, setCachedData] = useState<ListMyConversationsResponseDto | null>(null);
  const query = useConversationsControllerMy();

  useEffect(() => {
    let isMounted = true;

    void readCachedConversations().then((data) => {
      if (!isMounted || !data) return;
      setCachedData(data);
      queryClient.setQueryData(getConversationsControllerMyQueryKey(), data);
    });

    return () => {
      isMounted = false;
    };
  }, [queryClient]);

  useEffect(() => {
    if (query.data) {
      void writeCachedConversations(query.data);
    }
  }, [query.data]);

  return {
    ...query,
    data: query.data ?? cachedData ?? undefined,
    isLoading: query.isLoading && !cachedData,
  };
}

export function useCachedQueryPersistence(userId?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    return queryClient.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      const data = event.query.state.data;

      if (!data || !Array.isArray(key)) return;

      if (key[0] === "/conversations/my") {
        void writeCachedConversations(data as ListMyConversationsResponseDto, userId);
        return;
      }

      if (key[0] === CHAT_QUERY_SCOPE && key[1] === "messages" && typeof key[2] === "string") {
        if (key[2] === "last-preview") return;

        const filter: ChatMessagesFilter = {
          replyToId: typeof key[3] === "string" ? key[3] : "",
          messageId: typeof key[4] === "string" ? key[4] : "",
          discussionChannelId: typeof key[5] === "string" ? key[5] : "",
        };
        void writeCachedMessages(key[2], data as ChatMessagesQueryData, filter, userId);
        return;
      }

      if (key[0] === CHAT_QUERY_SCOPE && key[1] === "authors") {
        void writeCachedUsers(data as Record<string, never>, userId);
      }
    });
  }, [queryClient, userId]);
}
