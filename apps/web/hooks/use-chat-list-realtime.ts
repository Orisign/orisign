"use client";

import {
  type ListMyConversationsResponseDto,
  getConversationsControllerMyQueryKey,
} from "@/api/generated";
import {
  apiWsOnOpen,
  apiWsSend,
  apiWsSendIfOpen,
  apiWsSubscribe,
} from "@/lib/api-ws";
import { bumpConversationInListData } from "@/hooks/use-chat";
import { CHAT_QUERY_SCOPE } from "@/lib/chat.constants";
import { getCookie } from "@/lib/cookies";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

interface ChatListRealtimeEvent {
  type?: string;
  conversationId?: string;
  actorId?: string;
  reason?: string;
}

export function useChatListRealtime(currentUserId?: string) {
  const queryClient = useQueryClient();
  const flushRef = useRef<number | null>(null);

  useEffect(() => {
    const token = getCookie("accessToken");
    if (!token || !currentUserId) return;

    const clearFlush = () => {
      if (flushRef.current === null) return;
      window.clearTimeout(flushRef.current);
      flushRef.current = null;
    };

    const flush = (conversationId?: string) => {
      clearFlush();
      flushRef.current = window.setTimeout(() => {
        if (conversationId) {
          queryClient.setQueriesData<ListMyConversationsResponseDto>(
            { queryKey: getConversationsControllerMyQueryKey() },
            (currentData) =>
              bumpConversationInListData(currentData, conversationId, Date.now()),
          );
        }

        void queryClient.invalidateQueries({
          queryKey: getConversationsControllerMyQueryKey(),
        });

        if (conversationId) {
          void queryClient.invalidateQueries({
            queryKey: [CHAT_QUERY_SCOPE, "messages", conversationId],
          });
          void queryClient.invalidateQueries({
            queryKey: [CHAT_QUERY_SCOPE, "messages", "last-preview", conversationId],
          });
          void queryClient.invalidateQueries({
            queryKey: [CHAT_QUERY_SCOPE, "unread-count", conversationId],
          });
        } else {
          void queryClient.invalidateQueries({
            queryKey: [CHAT_QUERY_SCOPE, "messages", "last-preview"],
          });
          void queryClient.invalidateQueries({
            queryKey: [CHAT_QUERY_SCOPE, "unread-count"],
          });
        }

        void queryClient.invalidateQueries({
          queryKey: [CHAT_QUERY_SCOPE, "authors"],
        });
      }, 120);
    };

    const subscribeToChatList = () =>
      apiWsSend({
        type: "chat-list.subscribe",
        token,
      }).catch(() => undefined);

    const unsubscribeFromEvents = apiWsSubscribe((payload) => {
      const event = payload as ChatListRealtimeEvent;

      if (event.type !== "chat-list.invalidate") {
        return;
      }

      const reason = event.reason ?? "";
      const actorId = event.actorId ?? "";
      const isOwnMessageMutation =
        actorId &&
        actorId === currentUserId &&
        (reason === "message.sent" ||
          reason === "message.edited" ||
          reason === "message.deleted" ||
          reason === "message.read");

      if (isOwnMessageMutation) {
        return;
      }

      flush(event.conversationId);
    });
    void subscribeToChatList();
    const unsubscribeFromOpen = apiWsOnOpen(subscribeToChatList);

    return () => {
      unsubscribeFromEvents();
      unsubscribeFromOpen();
      clearFlush();
      apiWsSendIfOpen({ type: "chat-list.unsubscribe" });
    };
  }, [currentUserId, queryClient]);
}
