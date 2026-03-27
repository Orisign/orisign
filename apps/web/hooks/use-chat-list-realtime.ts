"use client";

import { getConversationsControllerMyQueryKey } from "@/api/generated";
import { buildWebSocketUrl } from "@/lib/app-config";
import {
  CHAT_QUERY_SCOPE,
  CHAT_REALTIME_RECONNECT_BASE_DELAY_MS,
  CHAT_REALTIME_RECONNECT_MAX_DELAY_MS,
} from "@/lib/chat.constants";
import { getCookie } from "@/lib/cookies";
import { parseJsonWithProtobufSupport } from "@/lib/protobuf";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

interface ChatListRealtimeEvent {
  type?: string;
  conversationId?: string;
  actorId?: string;
  reason?: string;
}

function getChatListRealtimeUrl(token: string) {
  return buildWebSocketUrl("/ws/chat-list", { token });
}

export function useChatListRealtime(currentUserId?: string) {
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<number | null>(null);
  const invalidateTimeoutRef = useRef<number | null>(null);
  const closedByUserRef = useRef(false);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    const token = getCookie("accessToken");
    if (!token || !currentUserId) return;

    closedByUserRef.current = false;
    reconnectAttemptRef.current = 0;
    let socket: WebSocket | null = null;

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current === null) return;
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    };

    const clearInvalidateTimeout = () => {
      if (invalidateTimeoutRef.current === null) return;
      window.clearTimeout(invalidateTimeoutRef.current);
      invalidateTimeoutRef.current = null;
    };

    const scheduleInvalidate = (conversationId?: string) => {
      clearInvalidateTimeout();
      invalidateTimeoutRef.current = window.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: getConversationsControllerMyQueryKey(),
        });

        if (conversationId) {
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

    const connect = () => {
      clearReconnectTimeout();
      socket = new WebSocket(getChatListRealtimeUrl(token));

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const payload =
            parseJsonWithProtobufSupport<ChatListRealtimeEvent>(event.data);

          if (payload.type !== "chat-list.invalidate") {
            return;
          }

          const reason = payload.reason ?? "";
          const actorId = payload.actorId ?? "";
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

          scheduleInvalidate(payload.conversationId);
        } catch {
          return;
        }
      };

      socket.onclose = () => {
        socket = null;
        if (closedByUserRef.current) return;

        reconnectAttemptRef.current += 1;
        const delayMs = Math.min(
          CHAT_REALTIME_RECONNECT_MAX_DELAY_MS,
          CHAT_REALTIME_RECONNECT_BASE_DELAY_MS *
            2 ** Math.max(0, reconnectAttemptRef.current - 1),
        );

        reconnectTimeoutRef.current = window.setTimeout(connect, delayMs);
      };
    };

    connect();

    return () => {
      closedByUserRef.current = true;
      clearReconnectTimeout();
      clearInvalidateTimeout();
      socket?.close();
    };
  }, [currentUserId, queryClient]);
}
