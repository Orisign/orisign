"use client";

import {
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  getConversationsControllerMyQueryKey,
} from "@/api/generated";
import { getCookie } from "@/lib/cookies";
import {
  apiWsOnOpen,
  apiWsSend,
  apiWsSendIfOpen,
  apiWsSubscribe,
} from "@/lib/api-ws";
import { parseChatReplyMarkup } from "@/lib/bot-reply-markup";
import { playChatSound } from "@/lib/chat-sound-manager";
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

export function useChatRealtime(
  conversationId: string,
  currentUserId?: string,
  peerUserId?: string | null,
  messageFilter?: ChatMessagesFilter,
) {
  const queryClient = useQueryClient();
  const readsRef = useRef<Map<string, string>>(new Map());
  const typingRef = useRef(false);
  const uploadRef = useRef(false);
  const groupRef = useRef<Map<string, ChatGroupUserActivity>>(new Map());
  const [peerState, setPeerState] = useState<ChatPeerRealtimeState>(
    DEFAULT_CHAT_PEER_STATE,
  );
  const [groupState, setGroupState] = useState<ChatGroupRealtimeState>(
    DEFAULT_CHAT_GROUP_STATE,
  );
  const msgsKey = useMemo(
    () => getChatMessagesQueryKey(conversationId, messageFilter),
    [conversationId, messageFilter],
  );

  const syncGroup = useCallback(() => {
    let nextActiveUserId: string | null = null;
    let nextActivity: ChatGroupActivityType | null = null;
    let latestUpdatedAt = 0;

    groupRef.current.forEach((activity, userId) => {
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

  const setGroup = useCallback(
    (
      userId: string,
      activityType: ChatGroupActivityType,
      active: boolean,
      updatedAt: number,
    ) => {
      if (!userId || userId === currentUserId) {
        return;
      }

      const currentActivity = groupRef.current.get(userId) ?? {
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
        groupRef.current.delete(userId);
      } else {
        groupRef.current.set(userId, nextActivity);
      }

      syncGroup();
    },
    [currentUserId, syncGroup],
  );

  const clearGroup = useCallback(
    (userId: string) => {
      if (!userId) {
        return;
      }

      if (!groupRef.current.has(userId)) {
        return;
      }

      groupRef.current.delete(userId);
      syncGroup();
    },
    [syncGroup],
  );

  const resetGroup = useCallback(() => {
    groupRef.current.clear();
    setGroupState({ ...DEFAULT_CHAT_GROUP_STATE });
  }, []);

  const sendStatus = useCallback(
    (type: "status.typing" | "status.media-upload", active: boolean) => {
      apiWsSendIfOpen({
        type,
        conversationId,
        active,
      });
    },
    [conversationId],
  );

  const setTypingActive = useCallback(
    (active: boolean) => {
      const nextActive = Boolean(active);
      if (typingRef.current === nextActive) {
        return;
      }

      typingRef.current = nextActive;
      sendStatus("status.typing", nextActive);
    },
    [sendStatus],
  );

  const setMediaUploadingActive = useCallback(
    (active: boolean) => {
      const nextActive = Boolean(active);
      if (uploadRef.current === nextActive) {
        return;
      }

      uploadRef.current = nextActive;
      sendStatus("status.media-upload", nextActive);
    },
    [sendStatus],
  );

  useEffect(() => {
    const token = getCookie("accessToken");

    const resetPeerStateFrame = window.requestAnimationFrame(() => {
      setPeerState({ ...DEFAULT_CHAT_PEER_STATE });
    });
    const resetGroupStateFrame = window.requestAnimationFrame(() => {
      resetGroup();
    });

    if (!conversationId || !token) {
      return () => {
        window.cancelAnimationFrame(resetPeerStateFrame);
        window.cancelAnimationFrame(resetGroupStateFrame);
      };
    }

    const currentReadState = queryClient.getQueryData<ChatReadStateQueryData>(
      getChatReadStateQueryKey(conversationId),
    );
    const readMap = new Map<string, string>();
    (currentReadState?.cursors ?? []).forEach((cursor) => {
      readMap.set(
        cursor.userId,
        `${cursor.userId}:${cursor.lastReadMessageId ?? ""}`,
      );
    });
    readsRef.current = readMap;

    const subscribeToChat = () =>
      apiWsSend({
        type: "chat.subscribe",
        conversationId,
        token,
      })
        .then(() => {
          if (typingRef.current) {
            apiWsSendIfOpen({
              type: "status.typing",
              conversationId,
              active: true,
            });
          }

          if (uploadRef.current) {
            apiWsSendIfOpen({
              type: "status.media-upload",
              conversationId,
              active: true,
            });
          }
        })
        .catch(() => undefined);

    const unsubscribeFromEvents = apiWsSubscribe((rawPayload) => {
        try {
          const payload = rawPayload as ChatRealtimeEvent;

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
              clearGroup(payload.userId);
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

              setGroup(
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

              setGroup(
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
            const previousCursorKey = readsRef.current.get(cursorUserId);

            if (
              cursorKey &&
              previousCursorKey !== cursorKey &&
              cursorUserId !== currentUserId
            ) {
              readsRef.current.set(cursorUserId, cursorKey);
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
                msgsKey,
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
              msgsKey,
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
              clearGroup(message.authorId);
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
              msgsKey,
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
              msgsKey,
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
    });
    void subscribeToChat();
    const unsubscribeFromOpen = apiWsOnOpen(subscribeToChat);

    return () => {
      unsubscribeFromEvents();
      unsubscribeFromOpen();
      window.cancelAnimationFrame(resetPeerStateFrame);
      window.cancelAnimationFrame(resetGroupStateFrame);
      resetGroup();

      if (typingRef.current) {
        apiWsSendIfOpen({
          type: "status.typing",
          conversationId,
          active: false,
        });
      }

      if (uploadRef.current) {
        apiWsSendIfOpen({
          type: "status.media-upload",
          conversationId,
          active: false,
        });
      }

      typingRef.current = false;
      uploadRef.current = false;
      apiWsSendIfOpen({ type: "chat.unsubscribe" });
    };
  }, [
    clearGroup,
    conversationId,
    currentUserId,
    msgsKey,
    messageFilter?.discussionChannelId,
    messageFilter?.messageId,
    messageFilter?.replyToId,
    peerUserId,
    queryClient,
    resetGroup,
    setGroup,
  ]);

  return {
    peerState,
    groupState,
    setTypingActive,
    setMediaUploadingActive,
  };
}
