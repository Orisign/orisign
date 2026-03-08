"use client";

import { useMessagesControllerRead } from "@/api/generated";
import type { ConversationResponseDto } from "@/api/generated";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  CHAT_MESSAGE_KIND,
  useChatAuthors,
  useChatReadState,
  useChatMessages,
} from "@/hooks/use-chat";
import {
  formatChatDayLabel,
  getUserAvatarUrl,
  getUserDisplayName,
  getUserInitial,
  isSameCalendarDay,
} from "@/lib/chat";
import { Skeleton } from "@repo/ui";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ChatMessageReadReceipt } from "./chat-message-read-dialog";
import { ChatMessageDayDivider } from "./chat-message-day-divider";
import { ChatMessageItem } from "./chat-message-item";
import type { ChatReplyTarget } from "./chat.types";

interface ChatMessageListProps {
  conversationId: string;
  conversation: ConversationResponseDto | null;
  onReply?: (message: ChatReplyTarget) => void;
}

export function ChatMessageList({
  conversationId,
  conversation,
  onReply,
}: ChatMessageListProps) {
  const t = useTranslations("chat.messages");
  const locale = useLocale();
  const { user: currentUser } = useCurrentUser();
  const currentUserId = currentUser?.id ?? "";
  const viewportRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    didInitialScrollRef.current = false;
    shouldStickToBottomRef.current = true;
    lastMarkedReadMessageIdRef.current = "";
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
      <div className="min-h-0 flex-1 overflow-y-auto">
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
      </div>
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
    <div
      ref={viewportRef}
      onScroll={handleScroll}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-0.5 px-4 py-4 pb-6">
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
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{
                  opacity: {
                    duration: 0.12,
                    ease: [0.2, 0.8, 0.2, 1],
                  },
                  y: {
                    duration: 0.14,
                    ease: [0.2, 0.8, 0.2, 1],
                  },
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
                  onReply={onReply}
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
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
