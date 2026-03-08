"use client";

import {
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  getConversationsControllerMyQueryKey,
} from "@/api/generated";
import { getCookie } from "@/lib/cookies";
import { buildWebSocketUrl } from "@/lib/app-config";
import {
  CHAT_REALTIME_RECONNECT_BASE_DELAY_MS,
  CHAT_REALTIME_RECONNECT_MAX_DELAY_MS,
} from "@/lib/chat.constants";
import { parseJsonWithProtobufSupport } from "@/lib/protobuf";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  type ChatReadCursorDto,
  type ChatReadStateQueryData,
  appendChatMessageToData,
  bumpConversationQueryData,
  bumpConversationInListData,
  type ChatMessagesQueryData,
  getChatReadStateQueryKey,
  getChatMessagesQueryKey,
  getConversationQueryKey,
  normalizeChatMessage,
  upsertChatReadCursorInData,
} from "./use-chat";

interface ChatRealtimeEvent {
  type?: string;
  conversationId?: string;
  message?: unknown;
  cursor?: Partial<ChatReadCursorDto> | null;
}

function getChatRealtimeUrl(conversationId: string, token: string) {
  return buildWebSocketUrl("/ws/chat", {
    conversationId,
    token,
  });
}

export function useChatRealtime(conversationId: string) {
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<number | null>(null);
  const closedByUserRef = useRef(false);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    const token = getCookie("accessToken");

    if (!conversationId || !token) return;

    closedByUserRef.current = false;
    reconnectAttemptRef.current = 0;

    let socket: WebSocket | null = null;

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current === null) return;
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    };

    const connect = () => {
      clearReconnectTimeout();

      socket = new WebSocket(getChatRealtimeUrl(conversationId, token));

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const payload = parseJsonWithProtobufSupport<ChatRealtimeEvent>(event.data);

          if (payload.conversationId && payload.conversationId !== conversationId) {
            return;
          }

          if (payload.type === "message.read" && payload.cursor?.userId) {
            queryClient.setQueryData<ChatReadStateQueryData>(
              getChatReadStateQueryKey(conversationId),
              (currentData) =>
                upsertChatReadCursorInData(currentData, {
                  userId: payload.cursor?.userId ?? "",
                  lastReadMessageId: payload.cursor?.lastReadMessageId ?? "",
                  lastReadAt: payload.cursor?.lastReadAt ?? 0,
                }),
            );
            return;
          }

          if (payload.type !== "message.created" || !payload.message) {
            return;
          }

          const message = normalizeChatMessage(payload.message as Record<string, unknown>);
          if (!message) return;

          queryClient.setQueryData<ChatMessagesQueryData>(
            getChatMessagesQueryKey(conversationId),
            (currentData) => appendChatMessageToData(currentData, message),
          );

          queryClient.setQueryData<GetConversationResponseDto>(
            getConversationQueryKey(conversationId),
            (currentData) => bumpConversationQueryData(currentData, message.createdAt),
          );

          queryClient.setQueriesData<ListMyConversationsResponseDto>(
            { queryKey: getConversationsControllerMyQueryKey() },
            (currentData) =>
              bumpConversationInListData(
                currentData,
                message.conversationId,
                message.createdAt,
              ),
          );
        } catch {
          return;
        }
      };

      socket.onclose = () => {
        socket = null;

        if (closedByUserRef.current) {
          return;
        }

        reconnectAttemptRef.current += 1;
        const delayMs = Math.min(
          CHAT_REALTIME_RECONNECT_MAX_DELAY_MS,
          CHAT_REALTIME_RECONNECT_BASE_DELAY_MS * reconnectAttemptRef.current,
        );

        reconnectTimeoutRef.current = window.setTimeout(connect, delayMs);
      };
    };

    connect();

    return () => {
      closedByUserRef.current = true;
      clearReconnectTimeout();
      socket?.close();
    };
  }, [conversationId, queryClient]);
}
