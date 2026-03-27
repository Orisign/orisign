"use client";

import {
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  getConversationsControllerMyQueryKey,
} from "@/api/generated";
import { getCookie } from "@/lib/cookies";
import { buildWebSocketUrl } from "@/lib/app-config";
import { parseChatReplyMarkup } from "@/lib/bot-reply-markup";
import {
  CHAT_REALTIME_RECONNECT_BASE_DELAY_MS,
  CHAT_REALTIME_RECONNECT_MAX_DELAY_MS,
} from "@/lib/chat.constants";
import { playChatSound } from "@/lib/chat-sound-manager";
import { parseJsonWithProtobufSupport } from "@/lib/protobuf";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ChatMessagesFilter,
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
  userId?: string;
  online?: boolean;
  active?: boolean;
  at?: number;
  lastSeenAt?: number;
  message?: unknown;
  messageId?: string;
  text?: string;
  replyMarkupJson?: string;
  editedAt?: number;
  deletedAt?: number;
  cursor?: Partial<ChatReadCursorDto> | null;
}

export interface ChatPeerRealtimeState {
  isOnline: boolean;
  lastSeenAt: number | null;
  isTyping: boolean;
  isUploadingMedia: boolean;
}

type ChatGroupActivityType = "typing" | "uploadingMedia";

export interface ChatGroupRealtimeState {
  activeUserId: string | null;
  activity: ChatGroupActivityType | null;
}

interface ChatGroupUserActivity {
  typingActive: boolean;
  typingUpdatedAt: number;
  uploadingActive: boolean;
  uploadingUpdatedAt: number;
}

const DEFAULT_CHAT_PEER_STATE: ChatPeerRealtimeState = {
  isOnline: false,
  lastSeenAt: null,
  isTyping: false,
  isUploadingMedia: false,
};

const DEFAULT_CHAT_GROUP_STATE: ChatGroupRealtimeState = {
  activeUserId: null,
  activity: null,
};

function getChatRealtimeUrl(conversationId: string, token: string) {
  return buildWebSocketUrl("/ws/chat", {
    conversationId,
    token,
  });
}

export function useChatRealtime(
  conversationId: string,
  currentUserId?: string,
  peerUserId?: string | null,
  messageFilter?: ChatMessagesFilter,
) {
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<number | null>(null);
  const closedByUserRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const lastReadSignalByUserRef = useRef<Map<string, string>>(new Map());
  const socketRef = useRef<WebSocket | null>(null);
  const typingStateRef = useRef(false);
  const mediaUploadingStateRef = useRef(false);
  const groupActivityByUserRef = useRef<Map<string, ChatGroupUserActivity>>(new Map());
  const [peerState, setPeerState] = useState<ChatPeerRealtimeState>(
    DEFAULT_CHAT_PEER_STATE,
  );
  const [groupState, setGroupState] = useState<ChatGroupRealtimeState>(
    DEFAULT_CHAT_GROUP_STATE,
  );
  const messagesQueryKey = useMemo(
    () => getChatMessagesQueryKey(conversationId, messageFilter),
    [conversationId, messageFilter],
  );

  const recomputeGroupState = useCallback(() => {
    let nextActiveUserId: string | null = null;
    let nextActivity: ChatGroupActivityType | null = null;
    let latestUpdatedAt = 0;

    groupActivityByUserRef.current.forEach((activity, userId) => {
      if (
        activity.uploadingActive &&
        activity.uploadingUpdatedAt >= latestUpdatedAt
      ) {
        nextActiveUserId = userId;
        nextActivity = "uploadingMedia";
        latestUpdatedAt = activity.uploadingUpdatedAt;
      }

      if (activity.typingActive && activity.typingUpdatedAt >= latestUpdatedAt) {
        nextActiveUserId = userId;
        nextActivity = "typing";
        latestUpdatedAt = activity.typingUpdatedAt;
      }
    });

    setGroupState((currentState) => {
      if (
        currentState.activeUserId === nextActiveUserId &&
        currentState.activity === nextActivity
      ) {
        return currentState;
      }

      return {
        activeUserId: nextActiveUserId,
        activity: nextActivity,
      };
    });
  }, []);

  const setGroupUserActivity = useCallback(
    (
      userId: string,
      activityType: ChatGroupActivityType,
      active: boolean,
      updatedAt: number,
    ) => {
      if (!userId || userId === currentUserId) {
        return;
      }

      const currentActivity = groupActivityByUserRef.current.get(userId) ?? {
        typingActive: false,
        typingUpdatedAt: 0,
        uploadingActive: false,
        uploadingUpdatedAt: 0,
      };

      const nextActivity: ChatGroupUserActivity =
        activityType === "typing"
          ? {
              ...currentActivity,
              typingActive: active,
              typingUpdatedAt: updatedAt,
            }
          : {
              ...currentActivity,
              uploadingActive: active,
              uploadingUpdatedAt: updatedAt,
            };

      if (!nextActivity.typingActive && !nextActivity.uploadingActive) {
        groupActivityByUserRef.current.delete(userId);
      } else {
        groupActivityByUserRef.current.set(userId, nextActivity);
      }

      recomputeGroupState();
    },
    [currentUserId, recomputeGroupState],
  );

  const clearGroupUserActivity = useCallback(
    (userId: string) => {
      if (!userId) {
        return;
      }

      if (!groupActivityByUserRef.current.has(userId)) {
        return;
      }

      groupActivityByUserRef.current.delete(userId);
      recomputeGroupState();
    },
    [recomputeGroupState],
  );

  const resetGroupActivityState = useCallback(() => {
    groupActivityByUserRef.current.clear();
    setGroupState({ ...DEFAULT_CHAT_GROUP_STATE });
  }, []);

  const sendStatusSignal = useCallback(
    (type: "status.typing" | "status.media-upload", active: boolean) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      socket.send(
        JSON.stringify({
          type,
          conversationId,
          active,
        }),
      );
    },
    [conversationId],
  );

  const setTypingActive = useCallback(
    (active: boolean) => {
      const nextActive = Boolean(active);
      if (typingStateRef.current === nextActive) {
        return;
      }

      typingStateRef.current = nextActive;
      sendStatusSignal("status.typing", nextActive);
    },
    [sendStatusSignal],
  );

  const setMediaUploadingActive = useCallback(
    (active: boolean) => {
      const nextActive = Boolean(active);
      if (mediaUploadingStateRef.current === nextActive) {
        return;
      }

      mediaUploadingStateRef.current = nextActive;
      sendStatusSignal("status.media-upload", nextActive);
    },
    [sendStatusSignal],
  );

  useEffect(() => {
    const token = getCookie("accessToken");

    const resetPeerStateFrame = window.requestAnimationFrame(() => {
      setPeerState({ ...DEFAULT_CHAT_PEER_STATE });
    });
    const resetGroupStateFrame = window.requestAnimationFrame(() => {
      resetGroupActivityState();
    });

    if (!conversationId || !token) {
      return () => {
        window.cancelAnimationFrame(resetPeerStateFrame);
        window.cancelAnimationFrame(resetGroupStateFrame);
      };
    }

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
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;

        if (typingStateRef.current) {
          socket?.send(
            JSON.stringify({
              type: "status.typing",
              conversationId,
              active: true,
            }),
          );
        }

        if (mediaUploadingStateRef.current) {
          socket?.send(
            JSON.stringify({
              type: "status.media-upload",
              conversationId,
              active: true,
            }),
          );
        }
      };

      socket.onmessage = (event) => {
        try {
          const payload = parseJsonWithProtobufSupport<ChatRealtimeEvent>(event.data);

          if (payload.conversationId && payload.conversationId !== conversationId) {
            return;
          }

          if (payload.type === "status.presence" && payload.userId) {
            if (payload.userId !== currentUserId && peerUserId && payload.userId === peerUserId) {
              const isOnline = Boolean(payload.online);
              const lastSeenAtValue =
                typeof payload.lastSeenAt === "number" &&
                Number.isFinite(payload.lastSeenAt)
                  ? payload.lastSeenAt
                  : Date.now();

              setPeerState((currentState) => ({
                ...currentState,
                isOnline,
                lastSeenAt: isOnline ? currentState.lastSeenAt : lastSeenAtValue,
                isTyping: isOnline ? currentState.isTyping : false,
                isUploadingMedia: isOnline ? currentState.isUploadingMedia : false,
              }));
            }

            if (!peerUserId && !payload.online && payload.userId !== currentUserId) {
              clearGroupUserActivity(payload.userId);
            }

            return;
          }

          if (payload.type === "status.typing" && payload.userId) {
            if (payload.userId !== currentUserId && peerUserId && payload.userId === peerUserId) {
              setPeerState((currentState) => ({
                ...currentState,
                isTyping: Boolean(payload.active),
              }));
            }

            if (!peerUserId && payload.userId !== currentUserId) {
              const updatedAt =
                typeof payload.at === "number" && Number.isFinite(payload.at)
                  ? payload.at
                  : Date.now();

              setGroupUserActivity(
                payload.userId,
                "typing",
                Boolean(payload.active),
                updatedAt,
              );
            }

            return;
          }

          if (payload.type === "status.media-upload" && payload.userId) {
            if (payload.userId !== currentUserId && peerUserId && payload.userId === peerUserId) {
              setPeerState((currentState) => ({
                ...currentState,
                isUploadingMedia: Boolean(payload.active),
              }));
            }

            if (!peerUserId && payload.userId !== currentUserId) {
              const updatedAt =
                typeof payload.at === "number" && Number.isFinite(payload.at)
                  ? payload.at
                  : Date.now();

              setGroupUserActivity(
                payload.userId,
                "uploadingMedia",
                Boolean(payload.active),
                updatedAt,
              );
            }

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
                messagesQueryKey,
              )?.messages ?? []
            ).some((entry) => entry.id === message.id);

            if (!hasMessageInCache && message.authorId !== currentUserId) {
              playChatSound("receive");
            }

            const filterReplyToId = messageFilter?.replyToId?.trim() ?? "";
            const filterMessageId = messageFilter?.messageId?.trim() ?? "";
            const matchesMessageFilter =
              !filterReplyToId && !filterMessageId
                ? true
                : filterMessageId
                  ? message.id === filterMessageId
                  : message.replyToId === filterReplyToId;

            if (!matchesMessageFilter) {
              return;
            }

            queryClient.setQueryData<ChatMessagesQueryData>(
              messagesQueryKey,
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

            if (message.authorId !== currentUserId && peerUserId && message.authorId === peerUserId) {
              setPeerState((currentState) => ({
                ...currentState,
                isTyping: false,
                isUploadingMedia: false,
              }));
            }

            if (!peerUserId && message.authorId !== currentUserId) {
              clearGroupUserActivity(message.authorId);
            }
            return;
          }

          if (payload.type === "message.updated" && payload.messageId) {
            const nextEditedAt =
              typeof payload.editedAt === "number" && Number.isFinite(payload.editedAt)
                ? payload.editedAt
                : Date.now();
            const hasNextText = typeof payload.text === "string";
            const nextText = hasNextText ? payload.text : "";
            const hasReplyMarkupJson = typeof payload.replyMarkupJson === "string";
            const nextReplyMarkupJson = hasReplyMarkupJson ? payload.replyMarkupJson : "";

            queryClient.setQueryData<ChatMessagesQueryData>(
              messagesQueryKey,
              (currentData) => {
                if (!currentData) return currentData;

                return {
                  messages: currentData.messages.map((message) =>
                    message.id === payload.messageId
                      ? {
                          ...message,
                          ...(hasNextText ? { text: nextText } : {}),
                          ...(hasReplyMarkupJson
                            ? {
                                replyMarkupJson: nextReplyMarkupJson,
                                replyMarkup: parseChatReplyMarkup(nextReplyMarkupJson),
                              }
                            : {}),
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
              messagesQueryKey,
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
        socketRef.current = null;
        socket = null;

        if (closedByUserRef.current) {
          return;
        }

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
      window.cancelAnimationFrame(resetPeerStateFrame);
      window.cancelAnimationFrame(resetGroupStateFrame);
      resetGroupActivityState();

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        if (typingStateRef.current) {
          socketRef.current.send(
            JSON.stringify({
              type: "status.typing",
              conversationId,
              active: false,
            }),
          );
        }

        if (mediaUploadingStateRef.current) {
          socketRef.current.send(
            JSON.stringify({
              type: "status.media-upload",
              conversationId,
              active: false,
            }),
          );
        }
      }

      typingStateRef.current = false;
      mediaUploadingStateRef.current = false;
      socketRef.current = null;
      socket?.close();
    };
  }, [
    clearGroupUserActivity,
    conversationId,
    currentUserId,
    messagesQueryKey,
    messageFilter?.messageId,
    messageFilter?.replyToId,
    peerUserId,
    queryClient,
    resetGroupActivityState,
    setGroupUserActivity,
  ]);

  return {
    peerState,
    groupState,
    setTypingActive,
    setMediaUploadingActive,
  };
}
