"use client";

import type { UserResponseDto } from "@/api/generated";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type ChatMessageDto, CHAT_MESSAGE_KIND } from "@/hooks/use-chat";
import {
  getConversationParticipantVisual,
  formatTimestampTime,
  getUserAvatarUrl,
  getUserDisplayName,
  getUserInitial,
  isSameCalendarDay,
  normalizeTimestamp,
} from "@/lib/chat";
import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import { ChatMessageContextMenu } from "./chat-message-context-menu";
import { ChatMessageMedia } from "./chat-message-media";
import type { ChatMessageReadReceipt } from "./chat-message-read-dialog";
import type { ChatReplyTarget } from "./chat.types";

interface ChatMessageItemProps {
  conversationId: string;
  message: ChatMessageDto;
  previousMessage?: ChatMessageDto;
  nextMessage?: ChatMessageDto;
  author: UserResponseDto | null | undefined;
  isOwn: boolean;
  isReadByOthers: boolean;
  readReceipts: ChatMessageReadReceipt[];
  onReply?: (message: ChatReplyTarget) => void;
  repliedMessage?: ChatMessageDto | null;
  repliedAuthorName?: string;
  locale: string;
  deletedLabel: string;
  editedLabel: string;
  unknownAuthorLabel: string;
  replyUnavailableLabel: string;
}

function getBubbleClassName({
  isOwn,
  startsGroup,
  endsGroup,
}: {
  isOwn: boolean;
  startsGroup: boolean;
  endsGroup: boolean;
}) {
  const classes = [
    "relative w-fit max-w-[38rem] cursor-context-menu px-2.5 py-0.75 transition-colors",
  ];

  if (isOwn) {
    classes.push("bg-primary text-primary-foreground");

    if (startsGroup && endsGroup) {
      classes.push("rounded-[1rem] rounded-br-[0.3rem]");
    } else if (startsGroup) {
      classes.push("rounded-[1rem] rounded-br-[0.3rem]");
    } else if (endsGroup) {
      classes.push("rounded-[1rem] rounded-tr-[0.55rem] rounded-br-[0.3rem]");
    } else {
      classes.push("rounded-[1rem] rounded-tr-[0.55rem] rounded-br-[0.55rem]");
    }

    return classes.join(" ");
  }

  classes.push("bg-accent/85 text-foreground backdrop-blur-sm");

  if (startsGroup && endsGroup) {
    classes.push("rounded-[1rem] rounded-bl-[0.3rem]");
  } else if (startsGroup) {
    classes.push("rounded-[1rem] rounded-bl-[0.3rem]");
  } else if (endsGroup) {
    classes.push("rounded-[1rem] rounded-tl-[0.55rem] rounded-bl-[0.3rem]");
  } else {
    classes.push("rounded-[1rem] rounded-tl-[0.55rem] rounded-bl-[0.55rem]");
  }

  return classes.join(" ");
}

export function ChatMessageItem({
  conversationId,
  message,
  previousMessage,
  nextMessage,
  author,
  isOwn,
  isReadByOthers,
  readReceipts,
  onReply,
  repliedMessage,
  repliedAuthorName,
  locale,
  deletedLabel,
  editedLabel,
  unknownAuthorLabel,
  replyUnavailableLabel,
}: ChatMessageItemProps) {
  const mediaKeys = message.mediaKeys ?? [];
  const messageText = message.text ?? "";

  if (message.kind === CHAT_MESSAGE_KIND.SYSTEM) {
    return (
      <div className="flex justify-center py-1">
        <div className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
          {message.text}
        </div>
      </div>
    );
  }

  const isDeleted = normalizeTimestamp(message.deletedAt) !== null;
  const isEdited =
    !isDeleted &&
    (normalizeTimestamp(message.editedAt) ?? 0) > (normalizeTimestamp(message.createdAt) ?? 0);
  const authorName = getUserDisplayName(author, unknownAuthorLabel);
  const avatarUrl = getUserAvatarUrl(author);
  const authorInitial = getUserInitial(author, authorName || message.authorId);
  const participantVisual = getConversationParticipantVisual(conversationId, message.authorId);

  const startsGroup =
    !previousMessage ||
    previousMessage.kind === CHAT_MESSAGE_KIND.SYSTEM ||
    previousMessage.authorId !== message.authorId ||
    !isSameCalendarDay(previousMessage.createdAt, message.createdAt);

  const endsGroup =
    !nextMessage ||
    nextMessage.kind === CHAT_MESSAGE_KIND.SYSTEM ||
    nextMessage.authorId !== message.authorId ||
    !isSameCalendarDay(nextMessage.createdAt, message.createdAt);

  const showAuthorName = !isOwn && startsGroup && Boolean(authorName);
  const showAvatar = !isOwn && endsGroup;
  const replyPreviewText = repliedMessage?.text?.trim() || replyUnavailableLabel;
  const showReplyBlock = Boolean(message.replyToId);
  const messageMeta = (
    <span
      className={cn(
        "ml-1 inline-flex translate-y-px items-center gap-0.5 whitespace-nowrap align-baseline text-[10px] font-medium",
        isOwn ? "text-primary-foreground/70" : "text-muted-foreground",
      )}
    >
      {isEdited ? <span>{editedLabel}</span> : null}
      <span>{formatTimestampTime(message.createdAt, locale)}</span>
      {isOwn ? (
        isReadByOthers ? (
          <CheckCheck className="size-3.5" strokeWidth={2.4} />
        ) : (
          <Check className="size-3.5" strokeWidth={2.4} />
        )
      ) : null}
    </span>
  );

  const bubble = (
    <div className={getBubbleClassName({ isOwn, startsGroup, endsGroup })}>
      {!isDeleted ? (
        <>
          {showAuthorName ? (
            <p
              className={cn(
                "mb-px text-[12px] font-semibold leading-none",
                participantVisual.nameClassName,
              )}
            >
              {authorName}
            </p>
          ) : null}

          {showReplyBlock ? (
            <div
              className={cn(
                "mb-1 border-l-[3px] pl-2 pr-1.5 py-0.5 text-left",
                isOwn
                  ? "border-primary-foreground/55"
                  : "border-sky-400/85",
              )}
            >
              <p
                className={cn(
                  "truncate text-[12px] font-semibold leading-none",
                  repliedMessage
                    ? getConversationParticipantVisual(
                        conversationId,
                        repliedMessage.authorId,
                      ).nameClassName
                    : "text-muted-foreground",
                )}
              >
                {repliedAuthorName || replyUnavailableLabel}
              </p>
              <p
                className={cn(
                  "mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-[13px] leading-[1.1]",
                  isOwn
                    ? "text-primary-foreground/80"
                    : "text-foreground/80",
                )}
              >
                {replyPreviewText}
              </p>
            </div>
          ) : null}

          {mediaKeys.length > 0 ? (
            <div className={cn(messageText ? "mb-1.5" : "")}>
              <ChatMessageMedia mediaKeys={mediaKeys} />
            </div>
          ) : null}

          {messageText ? (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.15]">
              {messageText}
              {messageMeta}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-[15px] italic text-muted-foreground">{deletedLabel}</p>
      )}

      {!messageText ? <div className="mt-px">{messageMeta}</div> : null}
    </div>
  );

  const content = isOwn ? (
    <div className="mt-0.5 flex w-full justify-end px-0">
      <div className="flex max-w-[85%] flex-col items-end">{bubble}</div>
    </div>
  ) : (
    <div className="relative mt-0.5 flex w-full justify-start px-0 pl-10">
      {showAvatar ? (
        <Avatar
          className={cn(
            "absolute bottom-0 left-0 size-8 ring-2 ring-background",
            !avatarUrl && participantVisual.avatarClassName,
          )}
        >
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback
            className={cn(
              "font-semibold text-white",
              !avatarUrl && "bg-transparent text-white",
            )}
          >
            {authorInitial}
          </AvatarFallback>
        </Avatar>
      ) : null}
      <div className="flex max-w-[85%] min-w-0 flex-col items-start">{bubble}</div>
    </div>
  );

  return (
    <ChatMessageContextMenu
      conversationId={conversationId}
      message={message}
      canDelete={isOwn && !isDeleted}
      readReceipts={isOwn ? readReceipts : []}
      onReply={onReply}
      replyAuthorName={authorName}
    >
      {content}
    </ChatMessageContextMenu>
  );
}
