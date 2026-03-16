"use client";

import type { UserResponseDto } from "@/api/generated";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type ChatMessageDto, CHAT_MESSAGE_KIND } from "@/hooks/use-chat";
import { Checkbox } from "@repo/ui";
import {
  getConversationParticipantVisual,
  formatTimestampTime,
  getUserAvatarUrl,
  getUserDisplayName,
  getUserInitial,
  isSameCalendarDay,
  normalizeTimestamp,
} from "@/lib/chat";
import {
  parseCallLogMessageText,
} from "@/lib/call-log-message";
import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  selectionToggleVariants,
  SPRING_LAYOUT,
  SPRING_SOFT,
} from "@/lib/animations";
import { MdRemoveRedEye } from "react-icons/md";
import {
  FiArrowDownLeft,
  FiArrowUpRight,
  FiPhoneIncoming,
  FiPhoneOutgoing,
} from "react-icons/fi";
import { ChatMessageContextMenu } from "./chat-message-context-menu";
import { ChatMessageMedia } from "./chat-message-media";
import type { ChatMessageReadReceipt } from "./chat-message-read-dialog";
import type { ChatEditTarget, ChatReplyTarget } from "./chat.types";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";
import { useTranslations } from "next-intl";

interface ChatMessageItemProps {
  conversationId: string;
  message: ChatMessageDto;
  previousMessage?: ChatMessageDto;
  nextMessage?: ChatMessageDto;
  author: UserResponseDto | null | undefined;
  isOwn: boolean;
  isReadByOthers: boolean;
  readReceipts: ChatMessageReadReceipt[];
  isChannel?: boolean;
  channelViewCount?: number;
  onReply?: (message: ChatReplyTarget) => void;
  onEdit?: (message: ChatEditTarget) => void;
  onStartSelect?: (messageId: string) => void;
  onToggleSelect?: (messageId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  repliedMessage?: ChatMessageDto | null;
  repliedAuthorName?: string;
  selectionMode?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
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
  selectionMode,
}: {
  isOwn: boolean;
  startsGroup: boolean;
  endsGroup: boolean;
  selectionMode: boolean;
}) {
  const classes = [
    "relative w-fit max-w-[38rem] px-2.5 py-1.5 transition-[background-color,box-shadow,transform] duration-200",
    selectionMode ? "cursor-pointer" : "cursor-context-menu",
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
  isChannel = false,
  channelViewCount = 0,
  onReply,
  onEdit,
  onStartSelect,
  onToggleSelect,
  onJumpToMessage,
  repliedMessage,
  repliedAuthorName,
  selectionMode = false,
  isSelected = false,
  isFocused = false,
  locale,
  deletedLabel,
  editedLabel,
  unknownAuthorLabel,
  replyUnavailableLabel,
}: ChatMessageItemProps) {
  const tCallLog = useTranslations("chat.messages.callLog");
  const timeFormat = useGeneralSettingsStore((state) => state.timeFormat);
  const mediaKeys = message.mediaKeys ?? [];
  const messageText = message.text ?? "";
  const isDeleted = normalizeTimestamp(message.deletedAt) !== null;
  const callLogPayload = parseCallLogMessageText(messageText);
  const isCallLogMessage = Boolean(callLogPayload);
  const canSelectMessage =
    message.kind !== CHAT_MESSAGE_KIND.SYSTEM && isOwn && !isDeleted;

  if (message.kind === CHAT_MESSAGE_KIND.SYSTEM) {
    return (
      <div className="flex justify-center py-1">
        <div className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
          {message.text}
        </div>
      </div>
    );
  }

  const isEdited =
    !isDeleted &&
    (normalizeTimestamp(message.editedAt) ?? 0) >
      (normalizeTimestamp(message.createdAt) ?? 0);
  const authorName = getUserDisplayName(author, unknownAuthorLabel);
  const avatarUrl = getUserAvatarUrl(author);
  const authorInitial = getUserInitial(author, authorName || message.authorId);
  const participantVisual = getConversationParticipantVisual(
    conversationId,
    message.authorId,
  );

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
  const showAvatar = !isOwn && !isChannel && endsGroup;
  const replyPreviewText = repliedMessage?.text?.trim() || replyUnavailableLabel;
  const showReplyBlock = Boolean(message.replyToId);
  const messageMeta = (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium leading-none",
        isOwn ? "text-primary-foreground/70" : "text-muted-foreground",
      )}
    >
      {isEdited ? <span>{editedLabel}</span> : null}
      <span>{formatTimestampTime(message.createdAt, locale, { timeFormat })}</span>
      {isChannel ? (
        <>
          <MdRemoveRedEye className="size-3.5 text-muted-foreground" />
          <span>{channelViewCount}</span>
        </>
      ) : isOwn ? (
        isReadByOthers ? (
          <CheckCheck className="size-4" strokeWidth={2.4} />
        ) : (
          <Check className="size-4" strokeWidth={2.4} />
        )
      ) : null}
    </span>
  );

  function handleToggleSelect() {
    if (!canSelectMessage) return;
    onToggleSelect?.(message.id);
  }

  const bubble = (
    <motion.div
      layout="position"
      transition={SPRING_LAYOUT}
      className={getBubbleClassName({
        isOwn,
        startsGroup,
        endsGroup,
        selectionMode,
      })}
      onClick={selectionMode ? handleToggleSelect : undefined}
    >
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

          {isCallLogMessage && callLogPayload ? (
            <div className="w-full min-w-[14rem] max-w-[20rem]">
              <div className="min-w-0">
                <div
                  className={cn(
                    "flex items-center gap-2",
                    isOwn ? "text-primary-foreground" : "text-foreground",
                  )}
                >
                  {isOwn ? (
                    <FiPhoneOutgoing className="size-4 shrink-0" />
                  ) : (
                    <FiPhoneIncoming className="size-4 shrink-0" />
                  )}
                  <p className="truncate text-[15px] font-semibold leading-none">
                    {isOwn
                      ? tCallLog("direction.outgoing")
                      : tCallLog("direction.incoming")}
                  </p>
                </div>

                <div className="mt-1 flex items-center gap-1.5 text-[13px] leading-none">
                  {isOwn ? (
                    <FiArrowUpRight
                      className={cn(
                        "size-3.5 shrink-0",
                        callLogPayload.status === "completed"
                          ? "text-emerald-300"
                          : "text-red-300",
                      )}
                    />
                  ) : (
                    <FiArrowDownLeft
                      className={cn(
                        "size-3.5 shrink-0",
                        callLogPayload.status === "completed"
                          ? "text-emerald-300"
                          : "text-red-300",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "truncate",
                      callLogPayload.status === "completed"
                        ? "text-emerald-300"
                        : callLogPayload.status === "declined"
                          ? "text-red-300"
                          : callLogPayload.status === "canceled"
                            ? "text-red-300"
                            : "text-red-300",
                    )}
                  >
                    {callLogPayload.status === "completed"
                      ? tCallLog("status.completed")
                      : callLogPayload.status === "declined"
                        ? tCallLog("status.declined")
                        : callLogPayload.status === "canceled"
                          ? tCallLog("status.canceled")
                          : tCallLog("status.failed")}
                  </span>
                  <span
                    className={cn(
                      "ml-auto text-[12px]",
                      isOwn ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {formatTimestampTime(message.createdAt, locale, { timeFormat })}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {showReplyBlock ? (
                <button
                  type="button"
                  onClick={(event) => {
                    if (selectionMode || !message.replyToId) return;
                    event.stopPropagation();
                    onJumpToMessage?.(message.replyToId);
                  }}
                  className={cn(
                    "mb-1 w-full appearance-none border-0 border-l-[3px] bg-transparent py-0.5 pl-2 pr-1.5 text-left",
                    isOwn ? "border-primary-foreground/55" : "border-sky-400/85",
                    !selectionMode && message.replyToId
                      ? "cursor-pointer hover:opacity-90"
                      : "cursor-default",
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
                      isOwn ? "text-primary-foreground/80" : "text-foreground/80",
                    )}
                  >
                    {replyPreviewText}
                  </p>
                </button>
              ) : null}

              {mediaKeys.length > 0 ? (
                <div className={cn(messageText ? "mb-1.5" : "")}>
                  <ChatMessageMedia
                    conversationId={conversationId}
                    messageId={message.id}
                    mediaKeys={mediaKeys}
                    canDelete={isOwn && !isDeleted}
                  />
                </div>
              ) : null}

              {messageText ? (
                <div className="relative">
                  <p className="whitespace-pre-wrap break-words text-[length:var(--chat-message-font-size,15px)] leading-[1.15]">
                    {messageText}
                    <span aria-hidden className="inline-block w-24" />
                  </p>
                  <span className="pointer-events-none absolute bottom-0 right-0">
                    {messageMeta}
                  </span>
                </div>
              ) : null}
            </>
          )}
        </>
      ) : (
        <p className="text-[length:var(--chat-message-font-size,15px)] italic text-muted-foreground">
          {deletedLabel}
        </p>
      )}

      {!messageText && !isCallLogMessage ? <div className="mt-px">{messageMeta}</div> : null}
    </motion.div>
  );

  const selectionToggle = (
    className?: string,
  ) => (
    <AnimatePresence initial={false}>
      {selectionMode ? (
        <motion.div
          variants={selectionToggleVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn("absolute top-1/2 -translate-y-1/2", className)}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => handleToggleSelect()}
            disabled={!canSelectMessage}
            className={cn(
              "size-6 rounded-full border-border/80 bg-background/75 text-primary transition-colors hover:bg-accent/70",
              isSelected && "border-primary bg-primary text-primary-foreground",
              !canSelectMessage &&
                "cursor-not-allowed border-border/60 bg-background/40 text-muted-foreground/50 hover:bg-background/40",
            )}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  const renderRowHighlight = () => {
    const shouldRender = selectionMode || isFocused;
    const isActive = selectionMode ? isSelected : isFocused;

    return (
      <AnimatePresence initial={false}>
        {shouldRender ? (
          <motion.span
            key="message-highlight"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{
              opacity: isActive ? 1 : 0,
              scale: isActive ? 1 : 0.992,
            }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={SPRING_SOFT}
            className="pointer-events-none absolute inset-0 rounded-md bg-primary/40"
          />
        ) : null}
      </AnimatePresence>
    );
  };

  const content = isOwn ? (
    <motion.div
      layout="position"
      transition={SPRING_LAYOUT}
      className="relative mt-0.5 flex w-full justify-end px-0"
    >
      {renderRowHighlight()}
      {selectionToggle("left-0")}
      <motion.div
        layout="position"
        transition={SPRING_LAYOUT}
        className="relative flex max-w-[85%] flex-col items-end"
      >
        {bubble}
      </motion.div>
    </motion.div>
  ) : (
    <motion.div
      layout="position"
      transition={SPRING_LAYOUT}
      className="relative mt-0.5 flex w-full justify-start px-0 pl-10"
    >
      {renderRowHighlight()}
      {selectionToggle(showAvatar ? "-left-8" : "left-0")}
      {showAvatar ? (
        <Avatar
          className={cn(
            "absolute bottom-0 size-8 ring-2 ring-background",
            "left-0",
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
      <motion.div
        layout="position"
        transition={SPRING_LAYOUT}
        className="relative flex max-w-[85%] min-w-0 flex-col items-start"
      >
        {bubble}
      </motion.div>
    </motion.div>
  );

  return (
    <ChatMessageContextMenu
      conversationId={conversationId}
      message={message}
      canDelete={isOwn && !isDeleted}
      canEdit={isOwn && !isDeleted && message.kind === CHAT_MESSAGE_KIND.TEXT && !isCallLogMessage}
      canSelect={canSelectMessage}
      canCopyLink={isChannel}
      disabled={selectionMode}
      readReceipts={isOwn && !isChannel ? readReceipts : []}
      onReply={onReply}
      onEdit={onEdit}
      onStartSelect={onStartSelect}
      replyAuthorName={authorName}
    >
      {content}
    </ChatMessageContextMenu>
  );
}
