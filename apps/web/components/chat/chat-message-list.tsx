"use client";

import {
  messagesControllerGetCommentSummary,
  useUsersControllerMe,
  useMessagesControllerRead,
} from "@/api/generated";
import type { ConversationResponseDto } from "@/api/generated";
import {
  CHAT_MESSAGE_KIND,
  type ChatMessagesFilter,
  fetchChatMessagesPage,
  getChatMessagesQueryKey,
  type ChatMessagesQueryData,
  getChatUnreadCountQueryKey,
  prependChatMessagesToData,
  useChatAuthors,
  useChatReadState,
  useChatMessages,
  useConversationQuery,
} from "@/hooks/use-chat";
import {
  CHAT_FORCE_SCROLL_BOTTOM_EVENT,
  CHAT_MESSAGES_PAGE_SIZE,
} from "@/lib/chat.constants";
import {
  formatChatDayLabel,
  CHAT_CONVERSATION_TYPE,
  getConversationTitle,
  getUserAvatarUrl,
  getUserDisplayName,
  getUserInitial,
  isSameCalendarDay,
} from "@/lib/chat";
import { ScrollArea, Skeleton } from "@repo/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatCommentsPinnedPost } from "./chat-comments-pinned-post";
import type { ChatMessageReadReceipt } from "./chat-message-read-dialog";
import { ChatMessageDayDivider } from "./chat-message-day-divider";
import { ChatMessageItem } from "./chat-message-item";
import type { ChatMessageDto } from "@/hooks/use-chat";
import type { ChatEditTarget, ChatReplyTarget } from "./chat.types";

interface ChatMessageListProps {
  conversationId: string;
  conversation: ConversationResponseDto | null;
  discussionConversationId?: string;
  commentsMode?: boolean;
  threadReplyToId?: string;
  threadPost?: ChatMessageDto | null;
  focusMessageId?: string | null;
  onReply?: (message: ChatReplyTarget) => void;
  onEdit?: (message: ChatEditTarget) => void;
  onOpenComments?: (message: ChatReplyTarget) => void;
  alwaysMarkRead?: boolean;
  isLoadingConversation?: boolean;
  selectionMode?: boolean;
  selectedMessageIds?: Set<string>;
  onStartSelectMessage?: (messageId: string) => void;
  onToggleMessageSelect?: (messageId: string) => void;
}

export function ChatMessageList({
  conversationId,
  conversation,
  discussionConversationId,
  commentsMode = false,
  threadReplyToId,
  threadPost = null,
  focusMessageId,
  onReply,
  onEdit,
  onOpenComments,
  alwaysMarkRead = false,
  isLoadingConversation = false,
  selectionMode = false,
  selectedMessageIds,
  onStartSelectMessage,
  onToggleMessageSelect,
}: ChatMessageListProps) {
  const t = useTranslations("chat.messages");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const me = useUsersControllerMe();
  const currentUser = me.data?.user ?? null;
  const currentUserId = currentUser?.id ?? "";
  const messagesFilter = useMemo<ChatMessagesFilter | undefined>(
    () =>
      commentsMode && threadReplyToId
        ? { replyToId: threadReplyToId }
        : (
            conversation?.type === CHAT_CONVERSATION_TYPE.GROUP &&
            Boolean(conversation?.discussionChannelId?.trim())
          )
          ? { discussionChannelId: conversation?.discussionChannelId?.trim() ?? "" }
          : undefined,
    [commentsMode, conversation?.discussionChannelId, conversation?.type, threadReplyToId],
  );
  const scrollViewportId = useMemo(
    () => `chat-scroll-viewport-${conversationId}`,
    [conversationId],
  );
  const viewportRef = useRef<HTMLDivElement>(null);
  const messageNodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const highlightTimeoutRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const lastAutoFocusedMessageIdRef = useRef("");
  const hasMoreOlderRef = useRef(true);
  const isLoadingOlderRef = useRef(false);
  const isSeekingFocusedMessageRef = useRef(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState("");
  const [, setHasMoreOlder] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const shouldStickToBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);
  const lastMarkedReadMessageIdRef = useRef("");

  const messagesQuery = useChatMessages(conversationId, messagesFilter);
  const messages = useMemo(
    () => messagesQuery.data?.messages ?? [],
    [messagesQuery.data?.messages],
  );
  const discussionChannelId = conversation?.discussionChannelId?.trim() ?? "";
  const isDiscussionGroup =
    conversation?.type === CHAT_CONVERSATION_TYPE.GROUP &&
    Boolean(discussionChannelId);
  const discussionChannelQuery = useConversationQuery(
    isDiscussionGroup ? discussionChannelId : "",
  );
  const discussionChannelConversation =
    discussionChannelQuery.data?.conversation ?? null;
  const discussionChannelTitle = discussionChannelConversation
    ? getConversationTitle(discussionChannelConversation)
    : "";
  const lastMessageId = messages.at(-1)?.id ?? "";
  const latestIncomingMessage = useMemo(
    () =>
      currentUserId
        ? [...messages]
            .reverse()
            .find(
              (message) =>
                message.authorId !== currentUserId &&
                message.kind !== CHAT_MESSAGE_KIND.SYSTEM,
            ) ?? null
        : null,
    [currentUserId, messages],
  );
  const readStateQuery = useChatReadState(conversationId);
  const readCursors = useMemo(
    () => readStateQuery.data?.cursors ?? [],
    [readStateQuery.data?.cursors],
  );
  const { mutate: markRead } = useMessagesControllerRead({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData<{ count: number }>(
          getChatUnreadCountQueryKey(conversationId),
          { count: 0 },
        );
      },
      onError: (_error, variables) => {
        if (lastMarkedReadMessageIdRef.current === variables.data.lastReadMessageId) {
          lastMarkedReadMessageIdRef.current = "";
        }
      },
    },
  });

  const authorIds = useMemo(
    () =>
      [...new Set([
        ...messages.map((message) => message.authorId),
        ...(conversation?.members ?? []).map((member) => member.userId),
        ...(threadPost?.authorId ? [threadPost.authorId] : []),
      ])],
    [conversation?.members, messages, threadPost?.authorId],
  );
  const authorsQuery = useChatAuthors(authorIds);
  const authorsById = useMemo(
    () => authorsQuery.data ?? {},
    [authorsQuery.data],
  );
  const memberIds = useMemo(
    () => (conversation?.members ?? []).map((member) => member.userId).filter(Boolean),
    [conversation?.members],
  );
  const otherMemberIds = useMemo(
    () => memberIds.filter((userId) => userId !== currentUserId),
    [currentUserId, memberIds],
  );
  const messageIndexById = useMemo(
    () => new Map(messages.map((message, index) => [message.id, index])),
    [messages],
  );
  const messagesById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );
  const readCursorByUserId = useMemo(
    () => new Map(readCursors.map((cursor) => [cursor.userId, cursor])),
    [readCursors],
  );
  const isChannel = conversation?.type === CHAT_CONVERSATION_TYPE.CHANNEL;
  const isDiscussionChannelMessage = useCallback(
    (message?: ChatMessageDto | null) =>
      Boolean(
        isDiscussionGroup &&
        discussionChannelId &&
        message?.conversationId === discussionChannelId,
      ),
    [discussionChannelId, isDiscussionGroup],
  );
  const resolveAuthorIdentityKey = useCallback(
    (message?: ChatMessageDto | null) => {
      if (!message) {
        return "";
      }

      return isChannel
        ? `channel:${conversation?.id ?? conversationId}`
        : isDiscussionChannelMessage(message)
        ? `channel:${discussionChannelId}`
        : `user:${message.authorId}`;
    },
    [conversation?.id, conversationId, discussionChannelId, isChannel, isDiscussionChannelMessage],
  );
  const commentTargetIds = useMemo(
    () =>
      isChannel && discussionConversationId
        ? messages
            .filter((message) => message.kind !== CHAT_MESSAGE_KIND.SYSTEM)
            .map((message) => message.id)
        : [],
    [discussionConversationId, isChannel, messages],
  );
  const commentSummaryQuery = useQuery({
    queryKey: [
      "chat",
      "comment-summary",
      discussionConversationId,
      commentTargetIds.join(":"),
    ],
    queryFn: () =>
      messagesControllerGetCommentSummary({
        conversationId: discussionConversationId ?? "",
        replyToIds: commentTargetIds,
      }),
    enabled: Boolean(isChannel && discussionConversationId && commentTargetIds.length > 0),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const commentCountsByMessageId = useMemo(() => {
    return new Map(
      (commentSummaryQuery.data?.items ?? []).map((item) => [
        item.replyToId,
        item.count,
      ]),
    );
  }, [commentSummaryQuery.data?.items]);
  const channelViewCounts = useMemo(() => {
    const countsByMessageId = new Map<string, number>();
    if (!isChannel) return countsByMessageId;

    const visibleMemberIds = new Set(memberIds);

    messages.forEach((message, index) => {
      if (message.kind === CHAT_MESSAGE_KIND.SYSTEM) {
        return;
      }

      const viewers = new Set<string>([message.authorId]);
      visibleMemberIds.forEach((userId) => {
        const cursor = readCursorByUserId.get(userId);
        if (!cursor?.lastReadMessageId) return;

        const readIndex = messageIndexById.get(cursor.lastReadMessageId);
        if (typeof readIndex !== "number" || readIndex < index) return;

        viewers.add(userId);
      });

      countsByMessageId.set(message.id, viewers.size);
    });

    return countsByMessageId;
  }, [isChannel, memberIds, messageIndexById, messages, readCursorByUserId]);
  const ownMessageReadReceipts = useMemo(() => {
    const receiptsByMessageId = new Map<string, ChatMessageReadReceipt[]>();

    if (!currentUserId || otherMemberIds.length === 0) {
      return receiptsByMessageId;
    }

    messages.forEach((message, index) => {
      if (message.authorId !== currentUserId) return;

      const receipts = otherMemberIds
        .flatMap((userId) => {
          const cursor = readCursorByUserId.get(userId);
          if (!cursor?.lastReadMessageId) {
            return [];
          }

          const readIndex = messageIndexById.get(cursor.lastReadMessageId);
          if (typeof readIndex !== "number" || readIndex < index) {
            return [];
          }

          const reader = authorsById[userId];
          const displayName = getUserDisplayName(reader, t("unknownAuthor"));

          return [
            {
              userId,
              displayName,
              avatarUrl: getUserAvatarUrl(reader),
              avatarInitial: getUserInitial(reader, displayName || userId),
              readAt: cursor.lastReadAt,
            },
          ];
        })
        .sort((left, right) => right.readAt - left.readAt);

      receiptsByMessageId.set(message.id, receipts);
    });

    return receiptsByMessageId;
  }, [
    authorsById,
    currentUserId,
    messageIndexById,
    messages,
    otherMemberIds,
    readCursorByUserId,
    t,
  ]);
  const ownMessageReadState = useMemo(() => {
    const state = new Map<string, boolean>();
    ownMessageReadReceipts.forEach((receipts, messageId) => {
      state.set(messageId, receipts.length > 0);
    });

    return state;
  }, [ownMessageReadReceipts]);
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 80,
    overscan: 4,
    getItemKey: (index) => messages[index]?.id ?? index,
    useAnimationFrameWithResizeObserver: true,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  const getDistanceToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return 0;
    }

    return Math.max(
      0,
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight,
    );
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior,
    });
  }, []);

  const handleReplyMessage = useCallback(
    (message: ChatReplyTarget) => {
      onReply?.(message);
    },
    [onReply],
  );

  const handleEditMessage = useCallback(
    (message: ChatEditTarget) => {
      onEdit?.(message);
    },
    [onEdit],
  );

  const handleOpenCommentsForMessage = useCallback(
    (message: ChatReplyTarget) => {
      onOpenComments?.(message);
    },
    [onOpenComments],
  );

  const handleStartSelect = useCallback(
    (messageId: string) => {
      onStartSelectMessage?.(messageId);
    },
    [onStartSelectMessage],
  );

  const handleToggleSelect = useCallback(
    (messageId: string) => {
      onToggleMessageSelect?.(messageId);
    },
    [onToggleMessageSelect],
  );

  const tryMarkConversationRead = useCallback((nearBottomOverride?: boolean) => {
    const viewport = viewportRef.current;
    if (!viewport || !conversationId || !latestIncomingMessage) {
      return;
    }

    const isNearBottom = nearBottomOverride ?? getDistanceToBottom() < 120;
    shouldStickToBottomRef.current = isNearBottom;

    if (!isNearBottom && !alwaysMarkRead) {
      return;
    }

    if (lastMarkedReadMessageIdRef.current === latestIncomingMessage.id) {
      return;
    }

    lastMarkedReadMessageIdRef.current = latestIncomingMessage.id;

    markRead({
      data: {
        conversationId,
        lastReadMessageId: latestIncomingMessage.id,
      },
    });
  }, [alwaysMarkRead, conversationId, getDistanceToBottom, latestIncomingMessage, markRead]);

  const updateHasMoreOlder = useCallback((nextValue: boolean) => {
    hasMoreOlderRef.current = nextValue;
    setHasMoreOlder(nextValue);
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || isLoadingOlderRef.current || !hasMoreOlderRef.current) {
      return false;
    }

    const viewport = viewportRef.current;
    const previousScrollHeight = viewport?.scrollHeight ?? 0;
    const previousScrollTop = viewport?.scrollTop ?? 0;
    const queryKey = getChatMessagesQueryKey(conversationId, messagesFilter);
    const loadedMessagesCount =
      queryClient.getQueryData<ChatMessagesQueryData>(queryKey)?.messages.length ?? 0;

    isLoadingOlderRef.current = true;
    setIsLoadingOlder(true);

    try {
      const olderMessages = await fetchChatMessagesPage({
        conversationId,
        limit: CHAT_MESSAGES_PAGE_SIZE,
        offset: loadedMessagesCount,
        replyToId: messagesFilter?.replyToId,
        messageId: messagesFilter?.messageId,
      });

      if (olderMessages.length === 0) {
        updateHasMoreOlder(false);
        return false;
      }

      if (olderMessages.length < CHAT_MESSAGES_PAGE_SIZE) {
        updateHasMoreOlder(false);
      }

      queryClient.setQueryData<ChatMessagesQueryData>(queryKey, (currentData) =>
        prependChatMessagesToData(currentData, olderMessages),
      );

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const nextViewport = viewportRef.current;
          if (!nextViewport) return;

          const heightDelta = nextViewport.scrollHeight - previousScrollHeight;
          nextViewport.scrollTop = previousScrollTop + heightDelta;
        });
      });

      return true;
    } catch {
      return false;
    } finally {
      isLoadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [
    conversationId,
    messagesFilter,
    queryClient,
    updateHasMoreOlder,
  ]);

  useEffect(() => {
    didInitialScrollRef.current = false;
    shouldStickToBottomRef.current = true;
    lastMarkedReadMessageIdRef.current = "";
    lastAutoFocusedMessageIdRef.current = "";
    hasMoreOlderRef.current = true;
    isLoadingOlderRef.current = false;
    isSeekingFocusedMessageRef.current = false;
    setHasMoreOlder(true);
    setIsLoadingOlder(false);
    messageNodeRefs.current.clear();
  }, [conversationId]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || messages.length === 0) return;

    if (!didInitialScrollRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
      didInitialScrollRef.current = true;
      return;
    }

    if (shouldStickToBottomRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom();
        });
      });
    }
  }, [lastMessageId, messages.length, scrollToBottom]);

  useEffect(() => {
    if (!latestIncomingMessage) return;

    const frameId = window.requestAnimationFrame(() => {
      tryMarkConversationRead();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [latestIncomingMessage, tryMarkConversationRead]);

  const focusMessage = useCallback(
    (messageId: string, behavior: ScrollBehavior = "smooth") => {
      if (!messageId) return;

      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      const focusNode = () => {
        const messageNode = messageNodeRefs.current.get(messageId);
        if (!messageNode?.isConnected) {
          if (messageNode) {
            messageNodeRefs.current.delete(messageId);
          }
          return;
        }

        messageNode.scrollIntoView({
          behavior,
          block: "center",
          inline: "nearest",
        });
      };

      const existingNode = messageNodeRefs.current.get(messageId);
      if (existingNode?.isConnected) {
        focusNode();
      } else {
        if (existingNode) {
          messageNodeRefs.current.delete(messageId);
        }
        const messageIndex = messageIndexById.get(messageId);
        if (typeof messageIndex === "number") {
          rowVirtualizer.scrollToIndex(messageIndex, {
            align: "center",
            behavior,
          });

          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              focusNode();
            });
          });
        }
      }

      setHighlightedMessageId(messageId);
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }

      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedMessageId((currentId) =>
          currentId === messageId ? "" : currentId,
        );
      }, 1400);
    },
    [messageIndexById, rowVirtualizer],
  );

  useEffect(() => {
    if (!focusMessageId) return;
    if (lastAutoFocusedMessageIdRef.current === focusMessageId) return;
    if (isSeekingFocusedMessageRef.current) return;

    if (messages.some((message) => message.id === focusMessageId)) {
      const rafId = window.requestAnimationFrame(() => {
        lastAutoFocusedMessageIdRef.current = focusMessageId;
        focusMessage(focusMessageId);
      });

      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }

    let isCancelled = false;

    void (async () => {
      isSeekingFocusedMessageRef.current = true;
      try {
        let attempts = 0;

        while (!isCancelled && attempts < 40) {
          const currentMessages =
            queryClient.getQueryData<ChatMessagesQueryData>(
              getChatMessagesQueryKey(conversationId, messagesFilter),
            )?.messages ?? [];

          if (currentMessages.some((message) => message.id === focusMessageId)) {
            break;
          }

          if (!hasMoreOlderRef.current) {
            return;
          }

          const loaded = await loadOlderMessages();
          if (!loaded) {
            return;
          }

          attempts += 1;
        }

        if (isCancelled) return;

        const latestMessages =
          queryClient.getQueryData<ChatMessagesQueryData>(
            getChatMessagesQueryKey(conversationId, messagesFilter),
          )?.messages ?? [];

        if (!latestMessages.some((message) => message.id === focusMessageId)) {
          return;
        }

        if (lastAutoFocusedMessageIdRef.current === focusMessageId) {
          return;
        }

        window.requestAnimationFrame(() => {
          lastAutoFocusedMessageIdRef.current = focusMessageId;
          focusMessage(focusMessageId);
        });
      } finally {
        isSeekingFocusedMessageRef.current = false;
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    conversationId,
    focusMessage,
    focusMessageId,
    loadOlderMessages,
    messages,
    messagesFilter,
    queryClient,
  ]);

  useEffect(
    () => () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }

      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const handleForceScrollBottom = (event: Event) => {
      const customEvent = event as CustomEvent<{ conversationId?: string }>;
      if (customEvent.detail?.conversationId !== conversationId) {
        return;
      }

      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      shouldStickToBottomRef.current = true;

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          scrollToBottom();
        });
      });
    };

    window.addEventListener(CHAT_FORCE_SCROLL_BOTTOM_EVENT, handleForceScrollBottom);

    return () => {
      window.removeEventListener(CHAT_FORCE_SCROLL_BOTTOM_EVENT, handleForceScrollBottom);
    };
  }, [conversationId, scrollToBottom]);

  const processScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const isNearBottom = getDistanceToBottom() < 120;
    shouldStickToBottomRef.current = isNearBottom;

    if (viewport.scrollTop < 200 && hasMoreOlderRef.current && !isLoadingOlderRef.current) {
      void loadOlderMessages();
    }

    if (isNearBottom || alwaysMarkRead) {
      tryMarkConversationRead(isNearBottom);
    }
  }, [alwaysMarkRead, getDistanceToBottom, loadOlderMessages, tryMarkConversationRead]);

  const handleScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) {
      return;
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      processScroll();
    });
  }, [processScroll]);

  const registerMessageNode = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        rowVirtualizer.measureElement(null);
        return;
      }

      const messageId = node.dataset.messageId;
      if (messageId && messageNodeRefs.current.get(messageId) !== node) {
        messageNodeRefs.current.set(messageId, node);
      }

      rowVirtualizer.measureElement(node);
    },
    [rowVirtualizer],
  );

  if (isLoadingConversation || messagesQuery.isPending) {
    return (
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-4 pb-6">
          <div className="flex justify-center py-2">
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>

          {Array.from({ length: 6 }).map((_, index) => {
            const isOwn = index % 3 === 0;

            return (
              <div
                key={index}
                className={isOwn ? "flex justify-end" : "flex items-end gap-2"}
              >
                {!isOwn ? <Skeleton className="size-10 rounded-full" /> : null}
                <div className="max-w-[32rem] space-y-2">
                  {!isOwn ? <Skeleton className="h-3 w-24 rounded-full" /> : null}
                  <Skeleton className="h-12 w-64 rounded-[1.35rem]" />
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    );
  }

  if (messagesQuery.isError) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6">
        <p className="text-sm text-muted-foreground">{t("loadError")}</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-4 pb-6">
          {commentsMode && threadPost ? (
            <ChatCommentsPinnedPost
              message={threadPost}
              senderConversation={discussionChannelConversation}
              locale={locale}
              deletedLabel={t("deleted")}
              editedLabel={t("edited")}
              unknownAuthorLabel={t("unknownAuthor")}
              replyUnavailableLabel={t("replyUnavailable")}
            />
          ) : null}

          <div className="flex min-h-40 items-center justify-center px-4 py-6">
            <p className="text-sm text-muted-foreground">
              {commentsMode ? t("commentsEmpty") : t("empty")}
            </p>
          </div>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea
      className="min-h-0 flex-1"
      viewportRef={viewportRef}
      viewportId={scrollViewportId}
      viewportClassName="overscroll-contain"
      onViewportScroll={handleScroll}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-4 pb-6">
        {commentsMode && threadPost ? (
          <ChatCommentsPinnedPost
            message={threadPost}
            senderConversation={discussionChannelConversation}
            locale={locale}
            deletedLabel={t("deleted")}
            editedLabel={t("edited")}
            unknownAuthorLabel={t("unknownAuthor")}
            replyUnavailableLabel={t("replyUnavailable")}
          />
        ) : null}

        {isLoadingOlder ? (
          <div className="flex justify-center py-2">
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ) : null}

        <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {virtualItems.map((virtualRow) => {
              const index = virtualRow.index;
              const message = messages[index];
              if (!message) {
                return null;
              }
              const previousMessage = messages[index - 1];
              const nextMessage = messages[index + 1];
              const dayLabel = formatChatDayLabel(message.createdAt, locale, {
                today: t("dayDivider.today"),
                yesterday: t("dayDivider.yesterday"),
              });
              const showDayDivider =
                dayLabel &&
                (index === 0 ||
                  !isSameCalendarDay(previousMessage?.createdAt, message.createdAt));
              const isMirroredChannelPost = isDiscussionChannelMessage(message);
              const isOwnMessage =
                message.authorId === currentUserId && !isMirroredChannelPost;
              const senderConversation = isMirroredChannelPost
                ? discussionChannelConversation
                : isChannel
                  ? conversation
                  : null;
              const startsGroup =
                index === 0 ||
                previousMessage?.kind === CHAT_MESSAGE_KIND.SYSTEM ||
                resolveAuthorIdentityKey(previousMessage) !==
                  resolveAuthorIdentityKey(message) ||
                !isSameCalendarDay(previousMessage?.createdAt, message.createdAt);
              const endsGroup =
                index === messages.length - 1 ||
                nextMessage?.kind === CHAT_MESSAGE_KIND.SYSTEM ||
                resolveAuthorIdentityKey(nextMessage) !==
                  resolveAuthorIdentityKey(message) ||
                !isSameCalendarDay(nextMessage?.createdAt, message.createdAt);
              const repliedMessage = message.replyToId
                ? (
                    messagesById.get(message.replyToId) ??
                    (threadPost?.id === message.replyToId ? threadPost : null)
                  )
                : null;
              const repliedAuthorName = repliedMessage
                ? (
                    isDiscussionChannelMessage(repliedMessage) || isChannel
                      ? (
                          discussionChannelTitle ||
                          (
                            discussionChannelConversation
                              ? getConversationTitle(discussionChannelConversation)
                              : (conversation ? getConversationTitle(conversation) : "")
                          )
                        )
                      : getUserDisplayName(
                          authorsById[repliedMessage.authorId],
                          t("unknownAuthor"),
                        )
                  )
                : "";
                return (
                  <div
                    key={virtualRow.key}
                    ref={registerMessageNode}
                    data-index={index}
                    data-message-id={message.id}
                    className="absolute left-0 top-0 w-full"
                    style={{
                      transform: `translate3d(0, ${virtualRow.start}px, 0)`,
                      paddingBottom: endsGroup ? "1.2rem" : "0.65rem",
                    }}
                  >
                    {showDayDivider ? (
                      <div data-date-label={dayLabel}>
                        <ChatMessageDayDivider label={dayLabel} />
                      </div>
                    ) : null}

                    <ChatMessageItem
                      index={index}
                      conversationId={conversationId}
                      message={message}
                      previousMessage={previousMessage}
                      nextMessage={nextMessage}
                      author={senderConversation ? null : authorsById[message.authorId]}
                      senderConversation={senderConversation}
                      isOwn={isOwnMessage}
                      isReadByOthers={ownMessageReadState.get(message.id) ?? false}
                      readReceipts={ownMessageReadReceipts.get(message.id) ?? []}
                      isChannel={isChannel}
                      channelViewCount={channelViewCounts.get(message.id) ?? 0}
                      commentCount={commentCountsByMessageId.get(message.id) ?? 0}
                      onReply={commentsMode ? undefined : handleReplyMessage}
                      onEdit={handleEditMessage}
                      onOpenComments={
                        isChannel && discussionConversationId
                          ? handleOpenCommentsForMessage
                          : undefined
                      }
                      messageFilter={messagesFilter}
                      onStartSelect={handleStartSelect}
                      onToggleSelect={handleToggleSelect}
                      onJumpToMessage={focusMessage}
                      repliedMessage={repliedMessage}
                      repliedAuthorName={repliedAuthorName}
                      authorIdentityKeyOverride={resolveAuthorIdentityKey(message)}
                      startsGroupOverride={startsGroup}
                      endsGroupOverride={endsGroup}
                      forceShowAvatar={isMirroredChannelPost}
                      forceShowAuthorName={isMirroredChannelPost}
                      hideIncomingAvatar={
                        conversation?.type === CHAT_CONVERSATION_TYPE.DM &&
                        !isMirroredChannelPost
                      }
                      hideReplyPreview={commentsMode}
                      locale={locale}
                      deletedLabel={t("deleted")}
                      editedLabel={t("edited")}
                      unknownAuthorLabel={t("unknownAuthor")}
                      replyUnavailableLabel={t("replyUnavailable")}
                      selectionMode={selectionMode}
                      isSelected={selectedMessageIds?.has(message.id) ?? false}
                      isFocused={highlightedMessageId === message.id}
                    />
                  </div>
                );
              })}
        </div>
      </div>
    </ScrollArea>
  );
}
