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
import { playChatSound } from "@/lib/chat-sound-manager";
import { parseJsonWithProtobufSupport } from "@/lib/protobuf";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  type ChatLastMessagePreviewData,
  type ChatReadCursorDto,
  type ChatReadStateQueryData,
  appendChatMessageToData,
  bumpConversationQueryData,
  bumpConversationInListData,
  type ChatMessagesQueryData,
  getChatLastMessagePreviewQueryKey,
  getChatReadStateQueryKey,
  getChatMessagesQueryKey,
  getConversationQueryKey,
  normalizeChatMessage,
  removeChatMessageFromData,
  upsertChatReadCursorInData,
} from "./use-chat";

interface ChatRealtimeEvent {
  type?: string;
  conversationId?: string;
  message?: unknown;
  messageId?: string;
  text?: string;
  editedAt?: number;
  deletedAt?: number;
  cursor?: Partial<ChatReadCursorDto> | null;
}

function getChatRealtimeUrl(conversationId: string, token: string) {
  return buildWebSocketUrl("/ws/chat", {
    conversationId,
    token,
  });
}

export function useChatRealtime(conversationId: string, currentUserId?: string) {
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<number | null>(null);
  const closedByUserRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const lastReadSignalByUserRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const token = getCookie("accessToken");

    if (!conversationId || !token) return;

    closedByUserRef.current = false;
    reconnectAttemptRef.current = 0;
    const currentReadState = queryClient.getQueryData<ChatReadStateQueryData>(
      getChatReadStateQueryKey(conversationId),
    );
    const baselineReadSignals = new Map<string, string>();
    (currentReadState?.cursors ?? []).forEach((cursor) => {
      baselineReadSignals.set(
        cursor.userId,
        `${cursor.userId}:${cursor.lastReadMessageId ?? ""}`,
      );
    });
    lastReadSignalByUserRef.current = baselineReadSignals;

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
            const cursorUserId = payload.cursor?.userId ?? "";
            const lastReadMessageId =
              typeof payload.cursor?.lastReadMessageId === "string"
                ? payload.cursor.lastReadMessageId
                : "";
            const cursorKey = `${cursorUserId}:${lastReadMessageId}`;
            const previousCursorKey = lastReadSignalByUserRef.current.get(cursorUserId);

            if (
              cursorKey &&
              previousCursorKey !== cursorKey &&
              cursorUserId !== currentUserId
            ) {
              lastReadSignalByUserRef.current.set(cursorUserId, cursorKey);
              playChatSound("read");
            }

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

          if (payload.type === "message.created" && payload.message) {
            const message = normalizeChatMessage(payload.message as Record<string, unknown>);
            if (!message) return;

            const hasMessageInCache = (
              queryClient.getQueryData<ChatMessagesQueryData>(
                getChatMessagesQueryKey(conversationId),
              )?.messages ?? []
            ).some((entry) => entry.id === message.id);

            if (!hasMessageInCache && message.authorId !== currentUserId) {
              playChatSound("receive");
            }

            queryClient.setQueryData<ChatMessagesQueryData>(
              getChatMessagesQueryKey(conversationId),
              (currentData) => appendChatMessageToData(currentData, message),
            );
            queryClient.setQueryData<ChatLastMessagePreviewData>(
              getChatLastMessagePreviewQueryKey(conversationId),
              { message },
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
            return;
          }

          if (payload.type === "message.updated" && payload.messageId) {
            const nextEditedAt =
              typeof payload.editedAt === "number" && Number.isFinite(payload.editedAt)
                ? payload.editedAt
                : Date.now();
            const nextText = typeof payload.text === "string" ? payload.text : "";

            queryClient.setQueryData<ChatMessagesQueryData>(
              getChatMessagesQueryKey(conversationId),
              (currentData) => {
                if (!currentData) return currentData;

                return {
                  messages: currentData.messages.map((message) =>
                    message.id === payload.messageId
                      ? {
                          ...message,
                          text: nextText,
                          editedAt: nextEditedAt,
                        }
                      : message,
                  ),
                };
              },
            );

            queryClient.setQueriesData<ListMyConversationsResponseDto>(
              { queryKey: getConversationsControllerMyQueryKey() },
              (currentData) =>
                bumpConversationInListData(
                  currentData,
                  conversationId,
                  nextEditedAt,
                ),
            );
            return;
          }

          if (payload.type === "message.deleted" && payload.messageId) {
            const nextTimestamp =
              typeof payload.deletedAt === "number" && Number.isFinite(payload.deletedAt)
                ? payload.deletedAt
                : Date.now();

            queryClient.setQueryData<ChatMessagesQueryData>(
              getChatMessagesQueryKey(conversationId),
              (currentData) =>
                removeChatMessageFromData(currentData, payload.messageId ?? ""),
            );

            queryClient.setQueriesData<ListMyConversationsResponseDto>(
              { queryKey: getConversationsControllerMyQueryKey() },
              (currentData) =>
                bumpConversationInListData(
                  currentData,
                  conversationId,
                  nextTimestamp,
                ),
            );
            return;
          }

          return;
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
  }, [conversationId, currentUserId, queryClient]);
}
