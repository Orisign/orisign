"use client";

import { useMessagesControllerRead } from "@/api/generated";
import type { ConversationResponseDto } from "@/api/generated";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  CHAT_MESSAGE_KIND,
  fetchChatMessagesPage,
  getChatMessagesQueryKey,
  type ChatMessagesQueryData,
  getChatUnreadCountQueryKey,
  prependChatMessagesToData,
  useChatAuthors,
  useChatReadState,
  useChatMessages,
} from "@/hooks/use-chat";
import { CHAT_MESSAGES_PAGE_SIZE } from "@/lib/chat.constants";
import {
  formatChatDayLabel,
  CHAT_CONVERSATION_TYPE,
  getUserAvatarUrl,
  getUserDisplayName,
  getUserInitial,
  isSameCalendarDay,
} from "@/lib/chat";
import { ScrollArea, Skeleton } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import {
  createStaggerContainerVariants,
  messageListItemVariants,
} from "@/lib/animations";
import type { ChatMessageReadReceipt } from "./chat-message-read-dialog";
import { ChatMessageDayDivider } from "./chat-message-day-divider";
import { ChatMessageItem } from "./chat-message-item";
import type { ChatEditTarget, ChatReplyTarget } from "./chat.types";

interface ChatMessageListProps {
  conversationId: string;
  conversation: ConversationResponseDto | null;
  focusMessageId?: string | null;
  onReply?: (message: ChatReplyTarget) => void;
  onEdit?: (message: ChatEditTarget) => void;
  selectionMode?: boolean;
  selectedMessageIds?: Set<string>;
  onStartSelectMessage?: (messageId: string) => void;
  onToggleMessageSelect?: (messageId: string) => void;
}

export function ChatMessageList({
  conversationId,
  conversation,
  focusMessageId,
  onReply,
  onEdit,
  selectionMode = false,
  selectedMessageIds,
  onStartSelectMessage,
  onToggleMessageSelect,
}: ChatMessageListProps) {
  const t = useTranslations("chat.messages");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { user: currentUser } = useCurrentUser();
  const currentUserId = currentUser?.id ?? "";
  const scrollViewportId = useMemo(
    () => `chat-scroll-viewport-${conversationId}`,
    [conversationId],
  );
  const viewportRef = useRef<HTMLDivElement>(null);
  const messageNodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const highlightTimeoutRef = useRef<number | null>(null);
  const lastAutoFocusedMessageIdRef = useRef("");
  const hasMoreOlderRef = useRef(true);
  const isLoadingOlderRef = useRef(false);
  const isSeekingFocusedMessageRef = useRef(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState("");
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listInView = useInView(listRef, {
    once: true,
    amount: 0.06,
    margin: "0px 0px -12% 0px",
  });
  const listVariants = useMemo(
    () =>
      createStaggerContainerVariants({
        delayChildren: 0.01,
        staggerChildren: 0.04,
      }),
    [],
  );
  const shouldStickToBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);
  const lastMarkedReadMessageIdRef = useRef("");

  const messagesQuery = useChatMessages(conversationId);
  const messages = useMemo(
    () => messagesQuery.data?.messages ?? [],
    [messagesQuery.data?.messages],
  );
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
      ])],
    [conversation?.members, messages],
  );
  const authorsQuery = useChatAuthors(authorIds);
  const authorsById = useMemo(
    () => authorsQuery.data ?? {},
    [authorsQuery.data],
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
  const isChannel = Number(conversation?.type ?? 0) === CHAT_CONVERSATION_TYPE.CHANNEL;
  const channelViewCounts = useMemo(() => {
    const countsByMessageId = new Map<string, number>();
    if (!isChannel) return countsByMessageId;

    const memberIds = new Set(
      (conversation?.members ?? []).map((member) => member.userId).filter(Boolean),
    );

    messages.forEach((message, index) => {
      if (message.kind === CHAT_MESSAGE_KIND.SYSTEM) {
        return;
      }

      const viewers = new Set<string>([message.authorId]);
      memberIds.forEach((userId) => {
        const cursor = readCursorByUserId.get(userId);
        if (!cursor?.lastReadMessageId) return;

        const readIndex = messageIndexById.get(cursor.lastReadMessageId);
        if (typeof readIndex !== "number" || readIndex < index) return;

        viewers.add(userId);
      });

      countsByMessageId.set(message.id, viewers.size);
    });

    return countsByMessageId;
  }, [conversation?.members, isChannel, messageIndexById, messages, readCursorByUserId]);
  const ownMessageReadReceipts = useMemo(() => {
    const receiptsByMessageId = new Map<string, ChatMessageReadReceipt[]>();
    const otherMembers = (conversation?.members ?? []).filter(
      (member) => member.userId && member.userId !== currentUserId,
    );

    if (!currentUserId || otherMembers.length === 0) {
      return receiptsByMessageId;
    }

    messages.forEach((message, index) => {
      if (message.authorId !== currentUserId) return;

      const receipts = otherMembers
        .flatMap((member) => {
          const cursor = readCursorByUserId.get(member.userId);
          if (!cursor?.lastReadMessageId) {
            return [];
          }

          const readIndex = messageIndexById.get(cursor.lastReadMessageId);
          if (typeof readIndex !== "number" || readIndex < index) {
            return [];
          }

          const reader = authorsById[member.userId];
          const displayName = getUserDisplayName(reader, t("unknownAuthor"));

          return [
            {
              userId: member.userId,
              displayName,
              avatarUrl: getUserAvatarUrl(reader),
              avatarInitial: getUserInitial(reader, displayName || member.userId),
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
    conversation?.members,
    currentUserId,
    messageIndexById,
    messages,
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

  const tryMarkConversationRead = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !conversationId || !latestIncomingMessage) {
      return;
    }

    const distanceToBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const isNearBottom = distanceToBottom < 120;
    shouldStickToBottomRef.current = isNearBottom;

    if (!isNearBottom) {
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
  }, [conversationId, latestIncomingMessage, markRead]);

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
    const queryKey = getChatMessagesQueryKey(conversationId);
    const loadedMessagesCount =
      queryClient.getQueryData<ChatMessagesQueryData>(queryKey)?.messages.length ?? 0;

    isLoadingOlderRef.current = true;
    setIsLoadingOlder(true);

    try {
      const olderMessages = await fetchChatMessagesPage({
        conversationId,
        limit: CHAT_MESSAGES_PAGE_SIZE,
        offset: loadedMessagesCount,
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
        const nextViewport = viewportRef.current;
        if (!nextViewport) return;

        const heightDelta = nextViewport.scrollHeight - previousScrollHeight;
        nextViewport.scrollTop = previousScrollTop + heightDelta;
      });

      return true;
    } catch {
      return false;
    } finally {
      isLoadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [conversationId, queryClient, updateHasMoreOlder]);

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
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "auto",
        });
      });
      didInitialScrollRef.current = true;
      return;
    }

    if (shouldStickToBottomRef.current) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }, [lastMessageId, messages.length]);

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
      const messageNode = messageNodeRefs.current.get(messageId);
      if (!viewport || !messageNode) {
        return;
      }

      messageNode.scrollIntoView({
        behavior,
        block: "center",
        inline: "nearest",
      });

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
    [],
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
              getChatMessagesQueryKey(conversationId),
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
            getChatMessagesQueryKey(conversationId),
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
  }, [conversationId, focusMessage, focusMessageId, loadOlderMessages, messages, queryClient]);

  useEffect(
    () => () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    },
    [],
  );

  function handleScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const distanceToBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    shouldStickToBottomRef.current = distanceToBottom < 120;

    if (shouldStickToBottomRef.current) {
      tryMarkConversationRead();
    }
  }

  if (messagesQuery.isPending) {
    return (
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 pb-6">
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
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
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
      <motion.div
        ref={listRef}
        variants={listVariants}
        initial="hidden"
        animate={listInView ? "visible" : "hidden"}
        className="mx-auto flex w-full max-w-3xl flex-col gap-0.5 px-4 py-4 pb-6"
      >
        <InfiniteScroll
          dataLength={messages.length}
          next={() => void loadOlderMessages()}
          hasMore={hasMoreOlder}
          loader={
            isLoadingOlder ? (
              <div className="flex justify-center py-2">
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ) : null
          }
          inverse
          scrollableTarget={scrollViewportId}
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "visible",
          }}
        >
          <AnimatePresence initial={false}>
            {messages.map((message, index) => {
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

              return (
                <motion.div
                  key={message.id}
                  layout="position"
                  variants={messageListItemVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  style={{ willChange: "transform, opacity" }}
                  ref={(node) => {
                    if (node) {
                      messageNodeRefs.current.set(message.id, node);
                      return;
                    }

                    messageNodeRefs.current.delete(message.id);
                  }}
                >
                  {showDayDivider ? (
                    <ChatMessageDayDivider label={dayLabel} />
                  ) : null}

                  <ChatMessageItem
                    conversationId={conversationId}
                    message={message}
                    previousMessage={previousMessage}
                    nextMessage={nextMessage}
                    author={authorsById[message.authorId]}
                    isOwn={message.authorId === currentUserId}
                    isReadByOthers={ownMessageReadState.get(message.id) ?? false}
                    readReceipts={ownMessageReadReceipts.get(message.id) ?? []}
                    isChannel={isChannel}
                    channelViewCount={channelViewCounts.get(message.id) ?? 0}
                    onReply={onReply}
                    onEdit={onEdit}
                    onStartSelect={onStartSelectMessage}
                    onToggleSelect={onToggleMessageSelect}
                    onJumpToMessage={focusMessage}
                    repliedMessage={
                      message.replyToId ? (messagesById.get(message.replyToId) ?? null) : null
                    }
                    repliedAuthorName={
                      message.replyToId
                        ? getUserDisplayName(
                            authorsById[messagesById.get(message.replyToId)?.authorId ?? ""],
                            t("unknownAuthor"),
                          )
                        : ""
                    }
                    locale={locale}
                    deletedLabel={t("deleted")}
                    editedLabel={t("edited")}
                    unknownAuthorLabel={t("unknownAuthor")}
                    replyUnavailableLabel={t("replyUnavailable")}
                    selectionMode={selectionMode}
                    isSelected={selectedMessageIds?.has(message.id) ?? false}
                    isFocused={highlightedMessageId === message.id}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </InfiniteScroll>
      </motion.div>
    </ScrollArea>
  );
}
