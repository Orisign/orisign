"use client";

import type {
  ConversationResponseDto,
  UserResponseDto,
} from "@/api/generated";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  type ChatMessageDto,
  type ChatMessagesFilter,
  CHAT_MESSAGE_KIND,
} from "@/hooks/use-chat";
import { Checkbox } from "@repo/ui";
import {
  getAvatarGradient,
  getConversationAvatarUrl,
  getConversationInitial,
  getConversationTitle,
  getConversationParticipantVisual,
  formatTimestampTime,
  getUserAvatarUrl,
  getUserDisplayName,
  getUserInitial,
  isRingMediaKey,
  isSameCalendarDay,
  isVoiceMediaKey,
  normalizeTimestamp,
} from "@/lib/chat";
import { extractMessageUrls, stripMessageFormatting } from "@/lib/chat-message-format";
import {
  parseCallLogMessageText,
} from "@/lib/call-log-message";
import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import { MdRemoveRedEye } from "react-icons/md";
import {
  FiArrowDownLeft,
  FiArrowUpRight,
  FiPhoneIncoming,
  FiPhoneOutgoing,
} from "react-icons/fi";
import { ChatMessageContextMenu } from "./chat-message-context-menu";
import { ChatMessageMedia } from "./chat-message-media";
import { ChatFormattedMessage } from "./chat-formatted-message";
import { ChatMessageLinkPreview } from "./chat-message-link-preview";
import type { ChatMessageReadReceipt } from "./chat-message-read-dialog";
import type { ChatEditTarget, ChatReplyTarget } from "./chat.types";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { ChatMessageReplyMarkup } from "./chat-message-reply-markup";

interface ChatMessageItemProps {
  index?: number;
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
  commentCount?: number;
  onReply?: (message: ChatReplyTarget) => void;
  onEdit?: (message: ChatEditTarget) => void;
  onStartSelect?: (messageId: string) => void;
  onToggleSelect?: (messageId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  onOpenComments?: (message: ChatReplyTarget) => void;
  repliedMessage?: ChatMessageDto | null;
  repliedAuthorName?: string;
  senderConversation?: ConversationResponseDto | null;
  authorIdentityKeyOverride?: string;
  startsGroupOverride?: boolean;
  endsGroupOverride?: boolean;
  forceShowAvatar?: boolean;
  forceShowAuthorName?: boolean;
  hideIncomingAvatar?: boolean;
  messageFilter?: ChatMessagesFilter;
  hideReplyPreview?: boolean;
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
  minimalMedia,
}: {
  isOwn: boolean;
  startsGroup: boolean;
  endsGroup: boolean;
  selectionMode: boolean;
  minimalMedia: boolean;
}) {
  const classes = [
    "relative max-w-[38rem]",
    "w-fit",
    selectionMode ? "cursor-pointer" : "cursor-context-menu",
  ];

  if (minimalMedia) {
    classes.push("bg-transparent px-0 py-0 shadow-none");
  } else {
    classes.push("px-2.5 py-1.5");
  }

  if (isOwn) {
    if (!minimalMedia) {
      classes.push("bg-primary text-primary-foreground");
    } else {
      classes.push("text-primary-foreground");
    }

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

  if (!minimalMedia) {
    classes.push("bg-sidebar text-foreground");
  } else {
    classes.push("text-foreground");
  }

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

export const ChatMessageItem = memo(function ChatMessageItem({
  index = 0,
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
  commentCount = 0,
  onReply,
  onEdit,
  onStartSelect,
  onToggleSelect,
  onJumpToMessage,
  onOpenComments,
  repliedMessage,
  repliedAuthorName,
  senderConversation = null,
  authorIdentityKeyOverride,
  startsGroupOverride,
  endsGroupOverride,
  forceShowAvatar = false,
  forceShowAuthorName = false,
  hideIncomingAvatar = false,
  messageFilter,
  hideReplyPreview = false,
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
  const tMessages = useTranslations("chat.messages");
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
        <div className="rounded-full border border-border bg-sidebar px-3 py-1 text-xs font-medium text-muted-foreground">
          {message.text}
        </div>
      </div>
    );
  }

  const isEdited =
    !isDeleted &&
    (normalizeTimestamp(message.editedAt) ?? 0) >
      (normalizeTimestamp(message.createdAt) ?? 0);
  const senderTitle = senderConversation
    ? getConversationTitle(senderConversation)
    : "";
  const authorName = senderTitle || getUserDisplayName(author, unknownAuthorLabel);
  const avatarUrl = senderConversation
    ? getConversationAvatarUrl(senderConversation)
    : getUserAvatarUrl(author);
  const authorInitial = senderConversation
    ? getConversationInitial(senderConversation)
    : getUserInitial(author, authorName || message.authorId);
  const participantVisual = getConversationParticipantVisual(
    conversationId,
    authorIdentityKeyOverride || message.authorId,
  );
  const senderNameClassName = senderConversation
    ? "text-primary"
    : participantVisual.nameClassName;
  const senderAvatarClassName = senderConversation
    ? `bg-linear-to-br ${getAvatarGradient(senderConversation.id)}`
    : participantVisual.avatarClassName;

  const startsGroup = startsGroupOverride ?? (
    !previousMessage ||
    previousMessage.kind === CHAT_MESSAGE_KIND.SYSTEM ||
    previousMessage.authorId !== message.authorId ||
    !isSameCalendarDay(previousMessage.createdAt, message.createdAt)
  );

  const endsGroup = endsGroupOverride ?? (
    !nextMessage ||
    nextMessage.kind === CHAT_MESSAGE_KIND.SYSTEM ||
    nextMessage.authorId !== message.authorId ||
    !isSameCalendarDay(nextMessage.createdAt, message.createdAt)
  );

  const showAuthorName =
    !isOwn &&
    Boolean(authorName) &&
    (forceShowAuthorName || startsGroup);
  const showAvatar =
    !isOwn &&
    !hideIncomingAvatar &&
    (forceShowAvatar || (!isChannel && endsGroup));
  const replyPreviewText = stripMessageFormatting(repliedMessage?.text ?? "").trim() || replyUnavailableLabel;
  const showReplyBlock = Boolean(message.replyToId) && !hideReplyPreview;
  const hasOnlyRingMedia =
    mediaKeys.length > 0 &&
    mediaKeys.every((mediaKey) => isRingMediaKey(mediaKey));
  const hasOnlyVoiceOrRingMedia =
    mediaKeys.length > 0 &&
    mediaKeys.every((mediaKey) => isVoiceMediaKey(mediaKey) || isRingMediaKey(mediaKey));
  const showInlineMediaMeta = hasOnlyVoiceOrRingMedia && !messageText && !isCallLogMessage;
  const inlineReplyMarkup =
    message.replyMarkup?.type === "inline_keyboard" ? message.replyMarkup : null;
  const messageLinkUrls = !isCallLogMessage
    ? extractMessageUrls(messageText, 3)
    : [];
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

  const commentsVisual = commentCount <= 1 ? (
    <Avatar
      size="sm"
      className={cn(
        "size-6 shrink-0 border border-white/15 shadow-sm",
        senderAvatarClassName,
      )}
    >
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className={!avatarUrl ? "bg-transparent text-[11px] text-white" : ""}>
        {authorInitial}
      </AvatarFallback>
    </Avatar>
  ) : (
    <div className="relative mr-1 h-6 w-11 shrink-0">
      {[
        "from-sky-500 to-blue-600",
        "from-emerald-500 to-green-600",
        "from-fuchsia-500 to-pink-600",
      ].map((gradient, index) => (
        <span
          key={`${message.id}-comments-avatar-${index}`}
          className={cn(
            "absolute top-0 inline-flex size-6 items-center justify-center rounded-full border border-white/20 bg-linear-to-br text-[10px] font-semibold text-white shadow-sm",
            gradient,
          )}
          style={{ left: `${index * 0.85}rem` }}
        >
          {index === 0 ? authorInitial : authorInitial}
        </span>
      ))}
    </div>
  );

  const commentsAction = isChannel && onOpenComments ? (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        if (selectionMode) {
          return;
        }

        onOpenComments({
          id: message.id,
          conversationId,
          authorId: message.authorId,
          authorName,
          text: messageText,
          kind: message.kind,
          mediaKeys: message.mediaKeys ?? [],
          createdAt: message.createdAt,
        });
      }}
      className={cn(
        "-mx-2.5 mt-2.5 flex w-[calc(100%+1.25rem)] items-center gap-2.5 border-t px-2.5 pt-2.5 text-left text-sm font-semibold transition-colors",
        isOwn
          ? "border-primary-foreground/15 text-primary-foreground/85 hover:text-primary-foreground"
          : "border-border/70 text-muted-foreground hover:text-foreground",
      )}
    >
      {commentsVisual}
      <span className="leading-none">{tMessages("commentsButton", { count: commentCount })}</span>
    </button>
  ) : null;

  const bubble = (
    <div
      className={getBubbleClassName({
        isOwn,
        startsGroup,
        endsGroup,
        selectionMode,
        minimalMedia: hasOnlyRingMedia,
      })}
      onClick={selectionMode ? handleToggleSelect : undefined}
    >
      {!isDeleted ? (
        <>
          {showAuthorName ? (
            <p
              className={cn(
                "mb-px text-[12px] font-semibold leading-none",
                senderNameClassName,
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
            <div className="min-w-0">
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
                    inlineMeta={showInlineMediaMeta ? messageMeta : null}
                  />
                </div>
              ) : null}

              {messageText ? (
                <div className="min-w-0">
                  <div className="chat-message-text">
                      <ChatFormattedMessage text={messageText} isOwn={isOwn} />
                  </div>
                  {messageLinkUrls.length > 0 ? (
                    <div className="mt-1.5 flex max-w-[28rem] flex-col gap-1.5">
                      {messageLinkUrls.map((url) => (
                        <ChatMessageLinkPreview
                          key={`${message.id}-link-preview-${url}`}
                          url={url}
                          isOwn={isOwn}
                        />
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-1 flex justify-end">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium leading-none",
                        isOwn ? "text-primary-foreground/70" : "text-muted-foreground",
                      )}
                    >
                      {isEdited ? (
                        <span className="overflow-hidden opacity-50">
                          {editedLabel}
                        </span>
                      ) : null}
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
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <p className="text-[length:var(--chat-message-font-size,15px)] italic text-muted-foreground">
          {deletedLabel}
        </p>
      )}
      {!messageText && !isCallLogMessage && !showInlineMediaMeta ? (
        <div className="mt-px">{messageMeta}</div>
      ) : null}

      {commentsAction}
    </div>
  );

  const messageStack = (
    <div
      className={cn(
        "inline-flex max-w-[38rem] min-w-0 flex-col",
        inlineReplyMarkup ? "min-w-[18rem]" : "",
        isOwn ? "items-end" : "items-start",
      )}
    >
      <div className="w-full min-w-0">
        {bubble}
      </div>
      {inlineReplyMarkup ? (
        <div className="mt-2 w-full">
          <ChatMessageReplyMarkup
            conversationId={conversationId}
            messageId={message.id}
            markup={inlineReplyMarkup}
            disabled={selectionMode}
          />
        </div>
      ) : null}
    </div>
  );

  const incomingMessageStack = (
    <div className="relative inline-flex max-w-[38rem] min-w-0 flex-col items-start">
      {showAvatar ? (
        <Avatar
          className={cn(
            "absolute bottom-0 -left-10 size-8 ring-2 ring-background",
            !avatarUrl && senderAvatarClassName,
          )}
        >
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback
            className={cn(
              "font-semibold text-white",
              !avatarUrl && !senderConversation && "bg-transparent text-white",
            )}
          >
            {authorInitial}
          </AvatarFallback>
        </Avatar>
      ) : null}
      {messageStack}
    </div>
  );

  const selectionToggle = (
    className?: string,
  ) => (
    <>
      {selectionMode ? (
        <div className={cn("absolute top-1/2 -translate-y-1/2", className)}>
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
        </div>
      ) : null}
    </>
  );

  const renderRowHighlight = () => {
    const shouldRender = selectionMode || isFocused;
    const isActive = selectionMode ? isSelected : isFocused;

    return (
      shouldRender ? (
        <span
          data-active={isActive}
          className="chat-message-highlight pointer-events-none absolute inset-0 rounded-md bg-primary/40"
        />
      ) : null
    );
  };

  const content = isOwn ? (
    <div className="relative flex w-full justify-end px-0">
      {renderRowHighlight()}
      {selectionToggle("left-0")}
      <div className="relative flex max-w-[85%] flex-col items-end">
        {messageStack}
      </div>
    </div>
  ) : (
    <div className="relative flex w-full justify-start px-0">
      {renderRowHighlight()}
      {selectionToggle(showAvatar ? "-left-8" : "left-0")}
      <div
        className={cn(
          "relative flex max-w-[85%] min-w-0 flex-col items-start",
          showAvatar ? "pl-10" : "",
        )}
      >
        {incomingMessageStack}
      </div>
    </div>
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
      mediaKeys={mediaKeys}
      messageFilter={messageFilter}
    >
      {content}
    </ChatMessageContextMenu>
  );
});
