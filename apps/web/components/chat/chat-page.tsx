"use client";

import {
  type ConversationResponseDto,
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  ConversationMemberResponseDtoRole,
  ConversationMemberResponseDtoState,
  ConversationResponseDtoType,
  SendMessageRequestDtoKind,
  getConversationsControllerMyQueryKey,
  useConversationsControllerJoin,
  useConversationsControllerMy,
  useUsersControllerMe,
  useMessagesControllerDelete,
  useMessagesControllerSend,
} from "@/api/generated";
import {
  CHAT_MESSAGE_KIND,
  type ChatMessageDto,
  type ChatMessagesFilter,
  type ChatMessagesQueryData,
  bumpConversationInListData,
  bumpConversationQueryData,
  getChatMessagesQueryKey,
  getConversationQueryKey,
  getConversationUsernameQueryKey,
  removeChatMessageFromData,
  useChatAuthors,
  useChatInputMarkup,
  useChatMessages,
  useConversationQuery,
  useConversationUsernameQuery,
  useRouteUserQuery,
} from "@/hooks/use-chat";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { useChatBlockStatus, useSetChatBlock } from "@/hooks/use-chat-block";
import { useConversationNotifications } from "@/hooks/use-conversation-notifications";
import { ChatHeader } from "./chat-header";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SendMessageForm } from "./send-message-form";
import { ChatMessageList } from "./chat-message-list";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, toast } from "@repo/ui";
import { FiTrash2, FiX } from "react-icons/fi";
import {
  CHAT_DISCUSSION_COMMENTS_CONTEXT_STORAGE_KEY_PREFIX,
  CHAT_FOCUS_STORAGE_KEY_PREFIX,
  CHAT_SELECT_EVENT,
  CHAT_SELECT_STORAGE_KEY_PREFIX,
} from "@/lib/chat.constants";
import {
  getAvatarGradient,
  getConversationAvatarUrl,
  getConversationInitial,
  getConversationTitle,
  formatTimestampTime,
  getUserAvatarUrl,
  getUserDisplayName,
  getUserInitial,
  isDirectConversation,
  isBotProjectionUserId,
  CHAT_CONVERSATION_TYPE,
} from "@/lib/chat";
import {
  buildConversationPath,
  decodeConversationLocator,
  isUsernameConversationLocator,
  normalizeConversationUsername,
} from "@/lib/chat-routes";
import {
  buildDirectConversationPath,
  createVirtualDirectConversation,
  findDirectConversationWithUser,
  sendDirectMessage,
  upsertConversationInListData,
} from "@/lib/direct-chat";
import type {
  ChatCommentsContext,
  ChatEditTarget,
  ChatReplyTarget,
} from "./chat.types";
import { useDirectCall } from "@/hooks/use-direct-call";
import { ChatCallWindow } from "./chat-call-window";
import { createCallLogMessageText } from "@/lib/call-log-message";
import { rightSidebarStore } from "@/store/right-sidebar/right-sidebar.store";
import { runWithViewTransition } from "@/lib/view-transitions";
import { AnimatePresence, motion } from "motion/react";
import { fadeScale } from "@/lib/animations";

interface ChatPageProps {
  conversationId: string;
  focusMessageId?: string | null;
}

const EMPTY_MESSAGE_SELECTION = new Set<string>();

function toPost(
  snapshot: ChatReplyTarget | null,
  fallbackConversationId: string,
): ChatMessageDto | null {
  if (!snapshot?.id) {
    return null;
  }

  return {
    id: snapshot.id,
    conversationId: snapshot.conversationId?.trim() || fallbackConversationId,
    authorId: snapshot.authorId,
    kind: snapshot.kind ?? CHAT_MESSAGE_KIND.TEXT,
    text: snapshot.text ?? "",
    replyToId: "",
    mediaKeys: snapshot.mediaKeys ?? [],
    createdAt: snapshot.createdAt ?? 0,
    editedAt: 0,
    deletedAt: 0,
    entitiesJson: "",
    replyMarkupJson: "",
    attachmentsJson: "",
    sourceBotId: "",
    metadataJson: "",
    replyMarkup: null,
  };
}

export function ChatPage({ conversationId, focusMessageId }: ChatPageProps) {
  const tHeader = useTranslations("chat.header");
  const tSelection = useTranslations("chat.selection");
  const tSendForm = useTranslations("chat.sendMessageForm");
  const locale = useLocale();
  const conversationRouteParam = decodeConversationLocator(conversationId);
  const usernameLookup = isUsernameConversationLocator(conversationRouteParam)
    ? normalizeConversationUsername(conversationRouteParam)
    : "";
  const usernameConversationQuery = useConversationUsernameQuery(usernameLookup);
  const routeConversationId = usernameLookup
    ? (usernameConversationQuery.data?.conversation?.id?.trim() ?? "")
    : conversationRouteParam;
  const conversationQuery = useConversationQuery(routeConversationId);
  const me = useUsersControllerMe();
  const currentUser = me.data?.user ?? null;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createdDirectConversation, setCreatedDirectConversation] =
    useState<ConversationResponseDto | null>(null);
  const [replyState, setReplyState] = useState<{
    conversationId: string;
    target: ChatReplyTarget | null;
  }>({
    conversationId: conversationRouteParam,
    target: null,
  });
  const [editState, setEditState] = useState<{
    conversationId: string;
    target: ChatEditTarget | null;
  }>({
    conversationId: conversationRouteParam,
    target: null,
  });
  const [selectionState, setSelectionState] = useState<{
    conversationId: string;
    ids: Set<string>;
  }>({
    conversationId: conversationRouteParam,
    ids: new Set<string>(),
  });
  const [resolvedFocusMessageId] = useState<string | null>(() => {
    if (focusMessageId) {
      return focusMessageId;
    }

    if (typeof window === "undefined") {
      return null;
    }

    const storageKey = `${CHAT_FOCUS_STORAGE_KEY_PREFIX}:${conversationRouteParam}`;
    const storedMessageId = sessionStorage.getItem(storageKey);
    if (storedMessageId) {
      sessionStorage.removeItem(storageKey);
      return storedMessageId;
    }

    return null;
  });
  const selectedMessageIds =
    selectionState.conversationId === conversationRouteParam
      ? selectionState.ids
      : EMPTY_MESSAGE_SELECTION;
  const isSelectionMode = selectedMessageIds.size > 0;
  const selectedCount = selectedMessageIds.size;

  const { mutateAsync: deleteMessage, isPending: isDeletingSelected } =
    useMessagesControllerDelete();
  const { mutate: sendMessage } = useMessagesControllerSend();
  const { mutateAsync: joinConversation, isPending: isJoiningConversation } =
    useConversationsControllerJoin();
  const { mutateAsync: setUserBlock, isPending: isSettingPeerBlock } = useSetChatBlock();
  const rightSidebar = rightSidebarStore();
  const routeConversation =
    conversationQuery.data?.conversation ?? usernameConversationQuery.data?.conversation ?? null;
  const isResolvingConversationRoute = usernameLookup
    ? usernameConversationQuery.isPending
    : conversationQuery.isPending;
  const shouldResolveRouteUser = !isResolvingConversationRoute && !routeConversation;
  const routeUserQuery = useRouteUserQuery(
    conversationRouteParam,
    shouldResolveRouteUser,
  );
  const routeUser = routeUserQuery.data?.user ?? null;
  const myConversationsQuery = useConversationsControllerMy(undefined, {
    query: {
      queryKey: getConversationsControllerMyQueryKey(),
      staleTime: 60_000,
    },
  });
  const currentUserId = currentUser?.id ?? "";
  const routeUserId = routeUser?.id ?? "";
  const routeDirectConversation = useMemo(() => {
    if (!routeUserId || !currentUserId) {
      return null;
    }

    if (
      createdDirectConversation?.id &&
      createdDirectConversation.type === ConversationResponseDtoType.DM &&
      createdDirectConversation.members.some((member) => member.userId === routeUserId)
    ) {
      return createdDirectConversation;
    }

    return findDirectConversationWithUser(
      myConversationsQuery.data?.conversations,
      routeUserId,
      currentUserId,
    );
  }, [
    createdDirectConversation,
    currentUserId,
    myConversationsQuery.data?.conversations,
    routeUserId,
  ]);
  const virtualDirectConversation = useMemo(() => {
    if (
      routeConversation ||
      routeDirectConversation ||
      myConversationsQuery.isPending ||
      !currentUser?.id ||
      !routeUser?.id
    ) {
      return null;
    }

    return createVirtualDirectConversation({
      currentUser,
      peerUser: routeUser,
    });
  }, [
    currentUser,
    myConversationsQuery.isPending,
    routeConversation,
    routeDirectConversation,
    routeUser,
  ]);
  const conversation =
    routeConversation ?? routeDirectConversation ?? virtualDirectConversation;
  const activeConversationId =
    routeConversation?.id?.trim() ?? routeDirectConversation?.id?.trim() ?? "";
  const isVirtualDirect = Boolean(virtualDirectConversation && !activeConversationId);
  const isResolvingDirectConversationRoute = Boolean(
    !routeConversation &&
      routeUserId &&
      currentUserId &&
      myConversationsQuery.isPending,
  );
  const isChatShellLoading =
    me.isPending ||
    isResolvingConversationRoute ||
    (shouldResolveRouteUser && routeUserQuery.isPending) ||
    isResolvingDirectConversationRoute;

  useEffect(() => {
    if (isResolvingConversationRoute) return;
    if (conversation || routeUser) return;
    if (shouldResolveRouteUser && routeUserQuery.isPending) return;

    router.replace("/");
  }, [
    conversation,
    isResolvingConversationRoute,
    routeUser,
    routeUserQuery.isPending,
    router,
    shouldResolveRouteUser,
  ]);

  useEffect(() => {
    if (!routeUser?.id || routeUser.username || !routeDirectConversation?.id) {
      return;
    }

    const targetPath = buildDirectConversationPath(routeDirectConversation, routeUser);
    if (targetPath !== `/${conversationRouteParam}`) {
      router.replace(targetPath);
    }
  }, [conversationRouteParam, routeDirectConversation, routeUser, router]);

  const exitSelectionMode = useCallback(() => {
    setSelectionState({
      conversationId: conversationRouteParam,
      ids: new Set(),
    });
  }, [conversationRouteParam]);

  const startSelectionMode = useCallback((messageId: string) => {
    if (!messageId) return;

    setReplyState((currentState) => ({
      ...currentState,
      conversationId: conversationRouteParam,
      target: null,
    }));
    setEditState((currentState) => ({
      ...currentState,
      conversationId: conversationRouteParam,
      target: null,
    }));
    setSelectionState({
      conversationId: conversationRouteParam,
      ids: new Set([messageId]),
    });
  }, [conversationRouteParam]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = `${CHAT_SELECT_STORAGE_KEY_PREFIX}:${conversationRouteParam}`;
    const pendingMessageId = sessionStorage.getItem(storageKey);
    if (pendingMessageId) {
      sessionStorage.removeItem(storageKey);
      queueMicrotask(() => {
        startSelectionMode(pendingMessageId);
      });
    }

    const onStartSelect = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: string; messageId?: string }>).detail;
      if (!detail?.messageId || detail.conversationId !== conversationRouteParam) {
        return;
      }

      startSelectionMode(detail.messageId);
    };

    window.addEventListener(CHAT_SELECT_EVENT, onStartSelect as EventListener);
    return () => {
      window.removeEventListener(CHAT_SELECT_EVENT, onStartSelect as EventListener);
    };
  }, [conversationRouteParam, startSelectionMode]);

  const commentsContextStorageKey = useMemo(
    () => `${CHAT_DISCUSSION_COMMENTS_CONTEXT_STORAGE_KEY_PREFIX}:${conversationRouteParam}`,
    [conversationRouteParam],
  );
  const [commentsContext] = useState<ChatCommentsContext | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const rawContext = sessionStorage.getItem(commentsContextStorageKey);
    if (!rawContext) {
      return null;
    }

    sessionStorage.removeItem(commentsContextStorageKey);

    try {
      const parsed = JSON.parse(rawContext) as ChatCommentsContext | null;
      return parsed?.post?.id && parsed.channelConversationId ? parsed : null;
    } catch {
      return null;
    }
  });
  const commentsFor = commentsContext?.post.id?.trim() ?? "";
  const isDirect = isDirectConversation(conversation);
  const isDiscussionGroup =
    conversation?.type === CHAT_CONVERSATION_TYPE.GROUP &&
    Boolean(conversation?.discussionChannelId?.trim());
  const commentsChannelId =
    commentsContext?.channelConversationId?.trim() ||
    conversation?.discussionChannelId?.trim() ||
    "";
  const isCommentsMode = Boolean(
    commentsFor && commentsChannelId && isDiscussionGroup,
  );
  const commentsMessageFilter = useMemo<ChatMessagesFilter | undefined>(
    () => (isCommentsMode ? { replyToId: commentsFor } : undefined),
    [commentsFor, isCommentsMode],
  );
  const realtimeMessageFilter = useMemo<ChatMessagesFilter | undefined>(
    () =>
      commentsMessageFilter ??
      (isDiscussionGroup && commentsChannelId
        ? { discussionChannelId: commentsChannelId }
        : undefined),
    [commentsChannelId, commentsMessageFilter, isDiscussionGroup],
  );
  const composerInputMarkupQuery = useChatInputMarkup(
    activeConversationId,
    commentsMessageFilter,
  );
  const activeConversationInputMarkup = composerInputMarkupQuery.data ?? null;
  const activeBotReplyKeyboard =
    activeConversationInputMarkup?.markup?.type === "reply_keyboard"
      ? {
          message: activeConversationInputMarkup.message,
          markup: activeConversationInputMarkup.markup,
        }
      : null;
  const botInputPlaceholder =
    activeConversationInputMarkup?.markup?.type === "reply_keyboard" ||
    activeConversationInputMarkup?.markup?.type === "force_reply"
      ? (activeConversationInputMarkup.markup.inputFieldPlaceholder ?? "")
      : "";
  const threadPostSnapshot = useMemo(
    () =>
      isCommentsMode
        ? toPost(
            commentsContext?.post ?? null,
            commentsChannelId,
          )
        : null,
    [commentsChannelId, commentsContext?.post, isCommentsMode],
  );
  const threadPostQuery = useChatMessages(
    isCommentsMode && !threadPostSnapshot ? commentsChannelId : "",
    isCommentsMode && !threadPostSnapshot && commentsFor
      ? { messageId: commentsFor }
      : undefined,
  );
  const threadPost = threadPostSnapshot ?? threadPostQuery.data?.messages.at(0) ?? null;
  const threadPostAuthorIds = useMemo(
    () => (threadPost?.authorId ? [threadPost.authorId] : []),
    [threadPost],
  );
  const { data: threadPostAuthors } = useChatAuthors(threadPostAuthorIds);
  const threadPostAuthor = threadPost?.authorId
    ? (threadPostAuthors?.[threadPost.authorId] ?? null)
    : null;
  const implicitCommentsReplyTarget = useMemo<ChatReplyTarget | null>(() => {
    if (!isCommentsMode) {
      return null;
    }

    if (threadPost) {
      return {
        id: threadPost.id,
        conversationId: threadPost.conversationId,
        authorId: threadPost.authorId,
        authorName:
          commentsContext?.post.authorName ||
          getUserDisplayName(threadPostAuthor, tHeader("unknownUser")),
        text: threadPost.text,
        kind: threadPost.kind,
        mediaKeys: threadPost.mediaKeys,
        createdAt: threadPost.createdAt,
      };
    }

    return {
      id: commentsFor,
      conversationId: commentsChannelId,
      authorId: commentsContext?.post.authorId ?? "",
      authorName: commentsContext?.post.authorName ?? "",
      text: commentsContext?.post.text ?? "",
      kind: commentsContext?.post.kind,
      mediaKeys: commentsContext?.post.mediaKeys,
      createdAt: commentsContext?.post.createdAt,
    };
  }, [
    commentsChannelId,
    commentsContext?.post,
    commentsFor,
    isCommentsMode,
    tHeader,
    threadPost,
    threadPostAuthor,
  ]);

  const toggleMessageSelection = useCallback((messageId: string) => {
    if (!messageId) return;

    setSelectionState((currentState) => {
      const nextSelection =
        currentState.conversationId === conversationRouteParam
          ? new Set(currentState.ids)
          : new Set<string>();

      if (nextSelection.has(messageId)) {
        nextSelection.delete(messageId);
      } else {
        nextSelection.add(messageId);
      }

      return {
        conversationId: conversationRouteParam,
        ids: nextSelection,
      };
    });
  }, [conversationRouteParam]);

  const handleDeleteSelected = useCallback(async () => {
    const idsToDelete = Array.from(selectedMessageIds);

    if (idsToDelete.length === 0 || isDeletingSelected) return;

    try {
      await deleteMessage({
        data: {
          conversationId: activeConversationId,
          messageIds: idsToDelete,
        },
      });
      const deletedIds = idsToDelete;

      if (deletedIds.length > 0) {
        queryClient.setQueryData<ChatMessagesQueryData>(
          getChatMessagesQueryKey(activeConversationId, commentsMessageFilter),
          (currentData) =>
            deletedIds.reduce<ChatMessagesQueryData | undefined>(
              (nextData, messageId) => removeChatMessageFromData(nextData, messageId),
              currentData,
            ),
        );

        const nextTimestamp = Date.now();

        queryClient.setQueryData<GetConversationResponseDto>(
          getConversationQueryKey(activeConversationId),
          (currentData) => bumpConversationQueryData(currentData, nextTimestamp),
        );

        queryClient.setQueriesData<ListMyConversationsResponseDto>(
          { queryKey: getConversationsControllerMyQueryKey() },
          (currentData) =>
            bumpConversationInListData(currentData, activeConversationId, nextTimestamp),
        );
      }

      exitSelectionMode();
    } catch {
      setSelectionState({
        conversationId: conversationRouteParam,
        ids: new Set(idsToDelete),
      });
    }
  }, [
    activeConversationId,
    commentsMessageFilter,
    conversationRouteParam,
    deleteMessage,
    exitSelectionMode,
    isDeletingSelected,
    queryClient,
    selectedMessageIds,
  ]);

  const peerId = isDirect
    ? (conversation?.members ?? []).find((member) => member.userId !== currentUser?.id)
        ?.userId
    : undefined;
  const chatRealtime = useChatRealtime(
    activeConversationId,
    currentUser?.id,
    peerId,
    realtimeMessageFilter,
  );
  const groupStatusUserId = isDirect ? null : chatRealtime.groupState.activeUserId;
  const statusAuthorIds = [...new Set([peerId, groupStatusUserId].filter(Boolean))] as string[];
  const { data: usersMap } = useChatAuthors(statusAuthorIds);
  const { data: blockStatus } = useChatBlockStatus(isDirect ? peerId : null);
  const peerUser = peerId
    ? (usersMap?.[peerId] ?? (peerId === routeUser?.id ? routeUser : null))
    : null;
  const isBotDirectConversation = Boolean(isDirect && isBotProjectionUserId(peerId));
  const groupStatusUser = groupStatusUserId
    ? (usersMap?.[groupStatusUserId] ?? null)
    : null;
  const peerUserLastSeenAt =
    (peerUser as { lastSeenAt?: number | null } | null)?.lastSeenAt ?? null;
  const conversationTitle = isDirect
    ? getUserDisplayName(peerUser, tHeader("directFallback"))
    : (conversation ? getConversationTitle(conversation) : "");
  const resolvedPeerLastSeenAt = chatRealtime.peerState.lastSeenAt ?? peerUserLastSeenAt;
  const peerLastSeenTime = formatTimestampTime(resolvedPeerLastSeenAt, locale);
  const directFallbackSubtitle = tHeader("directFallback");
  const groupStatusUserName = getUserDisplayName(groupStatusUser, tHeader("unknownUser"));
  const groupStatusSubtitle = chatRealtime.groupState.activity
    ? (chatRealtime.groupState.activity === "uploadingMedia"
      ? tHeader("uploadingMediaByUser", { name: groupStatusUserName })
      : tHeader("typingByUser", { name: groupStatusUserName }))
    : "";
  const subtitle = isDirect
    ? (isBotDirectConversation
      ? tHeader("bot")
      : (chatRealtime.peerState.isUploadingMedia
        ? tHeader("uploadingMedia")
        : chatRealtime.peerState.isTyping
          ? tHeader("typing")
          : chatRealtime.peerState.isOnline
            ? tHeader("online")
            : (resolvedPeerLastSeenAt
              ? (peerLastSeenTime
                ? tHeader("lastSeenAt", { time: peerLastSeenTime })
                : directFallbackSubtitle)
              : directFallbackSubtitle)))
    : groupStatusSubtitle;
  const avatarUrl = isDirect
    ? getUserAvatarUrl(peerUser)
    : getConversationAvatarUrl(conversation);
  const avatarFallback = isDirect
    ? getUserInitial(peerUser, conversationTitle || "#")
    : (conversation ? getConversationInitial(conversation) : "#");
  const avatarSeed = getAvatarGradient(
    peerId ?? activeConversationId ?? conversationRouteParam,
  );
  const replyTarget =
    !isCommentsMode && replyState.conversationId === conversationRouteParam
      ? replyState.target
      : null;
  const editTarget =
    editState.conversationId === conversationRouteParam ? editState.target : null;
  const isPeerBlockedByCurrentUser = Boolean(isDirect && blockStatus?.blocked);
  const isCurrentUserBlockedByPeer = Boolean(isDirect && blockStatus?.blockedByTarget);
  const isCallBlocked = isPeerBlockedByCurrentUser || isCurrentUserBlockedByPeer;
  const isCallUnavailable = isCallBlocked || isBotDirectConversation;
  const currentMember =
    currentUser?.id
      ? (conversation?.members ?? []).find(
          (member) =>
            member.userId === currentUser.id &&
            member.state === ConversationMemberResponseDtoState.ACTIVE,
        ) ?? null
      : null;
  const isChannel = conversation?.type === CHAT_CONVERSATION_TYPE.CHANNEL;
  const currentMemberRole = currentMember?.role;
  const canWriteMessages =
    Boolean(conversation) &&
    (
      !isChannel ||
      currentUser?.id === conversation?.ownerId ||
      currentMemberRole === ConversationMemberResponseDtoRole.OWNER ||
      currentMemberRole === ConversationMemberResponseDtoRole.ADMIN ||
      currentMemberRole === ConversationMemberResponseDtoRole.MEMBER
    );
  const canJoinChannel =
    isChannel &&
    Boolean(activeConversationId) &&
    currentUser?.id !== conversation?.ownerId &&
    !currentMember;
  const canLeaveConversation =
    Boolean(activeConversationId) &&
    (isDirect || Boolean(currentMember && currentUser?.id !== conversation?.ownerId));
  const notifications = useConversationNotifications(
    activeConversationId,
    conversation?.notificationsEnabled,
    Boolean(currentMember),
  );
  const headerTitle = isCommentsMode
    ? tHeader("commentsTitle")
    : conversationTitle;

  const handleUnblockPeer = useCallback(async () => {
    if (!peerId || !isDirect || isSettingPeerBlock) return;

    try {
      await setUserBlock({
        targetUserId: peerId,
        blocked: false,
      });
    } catch {
      toast({
        title: tSendForm("unblockError"),
        type: "error",
      });
    }
  }, [isDirect, isSettingPeerBlock, peerId, setUserBlock, tSendForm]);

  const handleToggleNotifications = useCallback(() => {
    notifications.toggleNotifications(!notifications.notificationsEnabled);
  }, [notifications]);

  const handleDirectConversationResolved = useCallback(
    (nextConversation: ConversationResponseDto) => {
      if (!nextConversation.id) {
        return;
      }

      setCreatedDirectConversation(nextConversation);

      const targetPath = buildDirectConversationPath(nextConversation, routeUser);
      if (targetPath !== `/${conversationRouteParam}`) {
        router.replace(targetPath);
      }
    },
    [conversationRouteParam, routeUser, router],
  );

  const { mutateAsync: startBotDirect, isPending: isStartingBotDirect } = useMutation({
    mutationFn: async () => {
      if (!peerId) {
        throw new Error("Direct peer is missing");
      }

      return sendDirectMessage({
        targetUserId: peerId,
        kind: SendMessageRequestDtoKind.TEXT,
        text: "/start",
        locale,
      });
    },
    onSuccess: (response) => {
      const conversation = response.conversation ?? null;
      if (!conversation?.id) {
        return;
      }

      const nextTimestamp = Date.now();
      setCreatedDirectConversation(conversation);

      queryClient.setQueryData<GetConversationResponseDto>(
        getConversationQueryKey(conversation.id),
        {
          conversation: {
            ...conversation,
            updatedAt: Math.max(conversation.updatedAt ?? 0, nextTimestamp),
          },
        },
      );
      queryClient.setQueriesData<ListMyConversationsResponseDto>(
        { queryKey: getConversationsControllerMyQueryKey() },
        (currentData) =>
          upsertConversationInListData(currentData, conversation, nextTimestamp),
      );
      void queryClient.invalidateQueries({
        queryKey: getConversationsControllerMyQueryKey(),
      });

      const targetPath = buildDirectConversationPath(conversation, routeUser);
      if (targetPath !== `/${conversationRouteParam}`) {
        router.replace(targetPath);
      }
    },
    onError: () => {
      toast({
        title: tSendForm("sendError"),
        type: "error",
      });
    },
  });

  const handleStartBotDirect = useCallback(async () => {
    if (!peerId || isStartingBotDirect) {
      return;
    }

    try {
      await startBotDirect();
    } catch {
      // The mutation onError already shows the user-facing error.
    }
  }, [isStartingBotDirect, peerId, startBotDirect]);

  const handleJoinChannel = useCallback(async () => {
    if (!activeConversationId || isJoiningConversation) {
      return;
    }

    try {
      await joinConversation({
        data: {
          conversationId: activeConversationId,
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getConversationQueryKey(activeConversationId),
        }),
        queryClient.invalidateQueries({
          queryKey: getConversationsControllerMyQueryKey(),
        }),
        usernameLookup
          ? queryClient.invalidateQueries({
              queryKey: getConversationUsernameQueryKey(usernameLookup),
            })
          : Promise.resolve(),
      ]);
    } catch {
      toast({
        title: tSendForm("subscribeError"),
        type: "error",
      });
    }
  }, [
    activeConversationId,
    isJoiningConversation,
    joinConversation,
    queryClient,
    tSendForm,
    usernameLookup,
  ]);

  const handleOpenComments = useCallback(
    (message: ChatReplyTarget) => {
      const discussionConversationId =
        conversation?.discussionConversationId?.trim() ?? "";
      if (!discussionConversationId || !activeConversationId || !currentMember) {
        return;
      }

      if (typeof window !== "undefined") {
        const storageKey =
          `${CHAT_DISCUSSION_COMMENTS_CONTEXT_STORAGE_KEY_PREFIX}:${discussionConversationId}`;
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            channelConversationId: activeConversationId,
            channelUsername: conversation?.username ?? "",
            post: {
              ...message,
              conversationId: activeConversationId,
            },
          } satisfies ChatCommentsContext),
        );
      }

      void runWithViewTransition(() =>
        router.push(buildConversationPath({ conversationId: discussionConversationId })),
      );
    },
    [
      activeConversationId,
      conversation?.discussionConversationId,
      conversation?.username,
      currentMember,
      router,
    ],
  );

  const handleBackFromComments = useCallback(() => {
    if (commentsChannelId && commentsFor) {
      const targetPath = buildConversationPath({
        conversationId: commentsChannelId,
        username: commentsContext?.channelUsername,
      });
      const targetRouteParam = targetPath.slice(1);

      if (typeof window !== "undefined" && targetRouteParam) {
        sessionStorage.removeItem(commentsContextStorageKey);
        sessionStorage.setItem(
          `${CHAT_FOCUS_STORAGE_KEY_PREFIX}:${targetRouteParam}`,
          commentsFor,
        );
      }

      void runWithViewTransition(() => router.push(targetPath));
      return;
    }

    void runWithViewTransition(() => router.back());
  }, [
    commentsChannelId,
    commentsContext?.channelUsername,
    commentsContextStorageKey,
    commentsFor,
    router,
  ]);

  const handleViewDiscussion = useCallback(() => {
    const discussionConversationId = conversation?.discussionConversationId?.trim() ?? "";
    if (!discussionConversationId) {
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.removeItem(
        `${CHAT_DISCUSSION_COMMENTS_CONTEXT_STORAGE_KEY_PREFIX}:${discussionConversationId}`,
      );
    }

    void runWithViewTransition(() =>
      router.push(buildConversationPath({ conversationId: discussionConversationId })),
    );
  }, [conversation?.discussionConversationId, router]);

  const handleReplyMessage = useCallback(
    (message: ChatReplyTarget) => {
      setEditState({
        conversationId: conversationRouteParam,
        target: null,
      });
      setReplyState({
        conversationId: conversationRouteParam,
        target: message,
      });
    },
    [conversationRouteParam],
  );

  const handleEditMessage = useCallback(
    (message: ChatEditTarget) => {
      setReplyState({
        conversationId: conversationRouteParam,
        target: null,
      });
      setEditState({
        conversationId: conversationRouteParam,
        target: message,
      });
    },
    [conversationRouteParam],
  );

  useEffect(() => {
    const discussionConversationId = conversation?.discussionConversationId?.trim() ?? "";
    if (!discussionConversationId) {
      return;
    }

    void router.prefetch(
      buildConversationPath({ conversationId: discussionConversationId }),
    );
  }, [conversation?.discussionConversationId, router]);

  const directCall = useDirectCall({
    enabled: Boolean(activeConversationId) && isDirect && !isBotDirectConversation,
    conversationId: activeConversationId,
    onCallSummary: (summary) => {
      sendMessage({
        data: {
          conversationId: activeConversationId,
          kind: SendMessageRequestDtoKind.TEXT,
          text: createCallLogMessageText({
            status: summary.status,
            durationSeconds: summary.durationSeconds,
            endedAt: summary.endedAt,
          }),
        },
      });
    },
  });

  const shouldShowComposerFooter =
    !isChatShellLoading &&
    (isSelectionMode || isPeerBlockedByCurrentUser || canJoinChannel || canWriteMessages);
  const canStartBotDirect =
    isVirtualDirect &&
    isBotDirectConversation &&
    !isPeerBlockedByCurrentUser &&
    !isCurrentUserBlockedByPeer;

  return (
    <div className="chat-wallpaper relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <ChatCallWindow
        state={directCall.state}
        error={directCall.error}
        title={conversationTitle}
        avatarUrl={avatarUrl}
        avatarFallback={avatarFallback}
        securityMaterial={directCall.securityMaterial}
        onAccept={() => void directCall.acceptIncomingCall()}
        onReject={directCall.rejectIncomingCall}
        onEnd={directCall.endCall}
        onDismissError={directCall.dismissError}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <ChatHeader
          conversationId={activeConversationId || conversationRouteParam}
          title={headerTitle}
          members={conversation?.members.length ?? 0}
          subtitle={subtitle}
          avatarUrl={avatarUrl}
          avatarFallback={avatarFallback}
          avatarSeed={avatarSeed}
          isDirect={isDirect}
          showCallAction={Boolean(activeConversationId) && isDirect && !isBotDirectConversation}
          directPeerId={peerId}
          isPeerBlockedByCurrentUser={isPeerBlockedByCurrentUser}
          onStartCall={() => {
            if (!isCallUnavailable) {
              void directCall.startCall();
            }
          }}
          onEndCall={directCall.endCall}
          callActive={directCall.isInCall}
          callDisabled={isCallUnavailable}
          onToggleRightSidebar={
            isCommentsMode || !conversation
              ? undefined
              : () => rightSidebar.toggle(conversationRouteParam)
          }
          commentsMode={isCommentsMode}
          onBack={isCommentsMode ? handleBackFromComments : undefined}
          notificationsEnabled={notifications.notificationsEnabled}
          onToggleNotifications={handleToggleNotifications}
          isTogglingNotifications={notifications.isUpdatingNotifications}
          canToggleNotifications={notifications.canToggleNotifications}
          canLeaveConversation={canLeaveConversation}
          onViewDiscussion={
            isChannel && currentMember && conversation?.discussionConversationId?.trim()
              ? handleViewDiscussion
              : undefined
          }
          isLoading={isChatShellLoading}
        />

        <ChatMessageList
          conversationId={activeConversationId}
          conversation={conversation}
          discussionConversationId={conversation?.discussionConversationId || undefined}
          commentsMode={isCommentsMode}
          threadReplyToId={isCommentsMode ? commentsFor : undefined}
          threadPost={threadPost}
          focusMessageId={resolvedFocusMessageId}
          selectionMode={isSelectionMode}
          selectedMessageIds={selectedMessageIds}
          onStartSelectMessage={startSelectionMode}
          onToggleMessageSelect={toggleMessageSelection}
          onOpenComments={
            isChannel && currentMember
              ? handleOpenComments
              : undefined
          }
          onReply={isCommentsMode ? undefined : handleReplyMessage}
          onEdit={handleEditMessage}
          alwaysMarkRead={isBotDirectConversation}
          isLoadingConversation={isChatShellLoading}
        />

        {shouldShowComposerFooter ? (
        <div className="shrink-0 px-4 py-4">
          <div className="mx-auto w-full max-w-3xl">
            <AnimatePresence mode="wait" initial={false}>
              {isSelectionMode ? (
                <motion.div
                  key="selection"
                  variants={fadeScale}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-border/70 bg-background/90 p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-xl"
                      onClick={exitSelectionMode}
                    >
                      <FiX className="size-4" />
                    </Button>

                    <p className="text-sm font-semibold text-foreground">
                      {tSelection("selected", { count: selectedCount })}
                    </p>

                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="ml-auto size-9 rounded-xl"
                      onClick={() => void handleDeleteSelected()}
                      disabled={selectedCount === 0 || isDeletingSelected}
                    >
                      <FiTrash2 className="size-4" />
                    </Button>
                  </div>
                </motion.div>
              ) : canJoinChannel ? (
                <motion.div
                  key="join"
                  variants={fadeScale}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Button
                    type="button"
                    className="h-14 w-full rounded-2xl text-base font-semibold"
                    onClick={() => void handleJoinChannel()}
                    disabled={!activeConversationId || isJoiningConversation}
                  >
                    {tSendForm("subscribeAction")}
                  </Button>
                </motion.div>
              ) : canStartBotDirect ? (
                <motion.div
                  key="start-bot"
                  variants={fadeScale}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Button
                    type="button"
                    className="h-14 w-full rounded-2xl text-base font-semibold"
                    onClick={() => void handleStartBotDirect()}
                    disabled={!peerId || isStartingBotDirect}
                  >
                    {tSendForm("startBotAction")}
                  </Button>
                </motion.div>
              ) : (
                isPeerBlockedByCurrentUser ? (
                  <motion.div
                    key="unblock"
                    variants={fadeScale}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Button
                      type="button"
                      className="h-14 w-full rounded-2xl text-base font-semibold"
                      onClick={() => void handleUnblockPeer()}
                      disabled={!peerId || isSettingPeerBlock}
                    >
                      {tSendForm("unblockAction")}
                    </Button>
                  </motion.div>
                ) : (
                  canWriteMessages ? (
                    <motion.div
                      key="composer"
                      variants={fadeScale}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <SendMessageForm
                        conversationId={activeConversationId}
                        directPeerUserId={isVirtualDirect ? (peerId ?? "") : ""}
                        isBlockedByCurrentUser={isPeerBlockedByCurrentUser}
                        isBlockedByPeer={isCurrentUserBlockedByPeer}
                        botReplyKeyboard={activeBotReplyKeyboard}
                        botInputPlaceholder={botInputPlaceholder}
                        onTypingStateChange={
                          activeConversationId ? chatRealtime.setTypingActive : undefined
                        }
                        onUploadingMediaStateChange={
                          activeConversationId ? chatRealtime.setMediaUploadingActive : undefined
                        }
                        onConversationResolved={handleDirectConversationResolved}
                        replyTarget={replyTarget}
                        implicitReplyTarget={implicitCommentsReplyTarget}
                        hideReplyPanel={isCommentsMode}
                        editTarget={editTarget}
                        messageFilter={commentsMessageFilter}
                        onCancelReply={() =>
                          setReplyState({
                            conversationId: conversationRouteParam,
                            target: null,
                          })
                        }
                        onCancelEdit={() =>
                          setEditState({
                            conversationId: conversationRouteParam,
                            target: null,
                          })
                        }
                      />
                    </motion.div>
                  ) : null
                )
              )}
            </AnimatePresence>
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}
