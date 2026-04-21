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
  CHAT_CONVERSATION_TYPE,
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
  resolveStorageFileUrl,
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
import { memo, useEffect, useRef } from "react";
import { ChatMessageReplyMarkup } from "./chat-message-reply-markup";
import Link from "next/link";

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

interface ForwardedFromMetadata {
  conversationId: string;
  messageId: string;
  authorId: string;
  sourceType: string;
  sourceTitle: string;
  sourceAvatarKey: string;
  sourceConversationTitle: string;
  sourceConversationUsername: string;
  sourceAuthorName: string;
  sourceAuthorUsername: string;
}

function parseForwardedFromMetadata(metadataJson: string) {
  if (!metadataJson.trim()) {
    return null;
  }

  try {
    const metadata = JSON.parse(metadataJson) as {
      forwardedFrom?: Partial<ForwardedFromMetadata> | null;
    };
    const forwardedFrom = metadata.forwardedFrom;

    if (!forwardedFrom) {
      return null;
    }

    return {
      conversationId:
        typeof forwardedFrom.conversationId === "string"
          ? forwardedFrom.conversationId
          : "",
      messageId:
        typeof forwardedFrom.messageId === "string" ? forwardedFrom.messageId : "",
      authorId:
        typeof forwardedFrom.authorId === "string" ? forwardedFrom.authorId : "",
      sourceType:
        typeof forwardedFrom.sourceType === "string" ? forwardedFrom.sourceType : "",
      sourceTitle:
        typeof forwardedFrom.sourceTitle === "string"
          ? forwardedFrom.sourceTitle
          : "",
      sourceAvatarKey:
        typeof forwardedFrom.sourceAvatarKey === "string"
          ? forwardedFrom.sourceAvatarKey
          : "",
      sourceConversationTitle:
        typeof forwardedFrom.sourceConversationTitle === "string"
          ? forwardedFrom.sourceConversationTitle
          : "",
      sourceConversationUsername:
        typeof forwardedFrom.sourceConversationUsername === "string"
          ? forwardedFrom.sourceConversationUsername
          : "",
      sourceAuthorName:
        typeof forwardedFrom.sourceAuthorName === "string"
          ? forwardedFrom.sourceAuthorName
          : "",
      sourceAuthorUsername:
        typeof forwardedFrom.sourceAuthorUsername === "string"
          ? forwardedFrom.sourceAuthorUsername
          : "",
    };
  } catch {
    return null;
  }
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
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = bubbleRef.current;
    if (!element) return;

    const keyframes: Keyframe[] = [
      { opacity: 0, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ];

    const animation = element.animate(keyframes, {
      duration: 150,
      easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
      fill: 'forwards'
    });

    return () => {
      animation.cancel();
    };
  }, []);

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
  const forwardedFrom = parseForwardedFromMetadata(message.metadataJson);
  const forwardedSourceType = forwardedFrom?.sourceType ?? "";
  const forwardedSourceLinksToMessage =
    forwardedSourceType === CHAT_CONVERSATION_TYPE.CHANNEL ||
    forwardedSourceType === CHAT_CONVERSATION_TYPE.GROUP ||
    forwardedSourceType === CHAT_CONVERSATION_TYPE.SUPERGROUP;
  const forwardedProfileUsername = (
    forwardedSourceLinksToMessage
      ? ""
      : forwardedFrom?.sourceAuthorUsername ||
        forwardedFrom?.sourceConversationUsername ||
        ""
  ).replace(/^@+/, "");
  const forwardedSourceName =
    forwardedFrom?.sourceTitle ||
    forwardedFrom?.sourceConversationTitle ||
    forwardedFrom?.sourceAuthorName ||
    (forwardedFrom?.sourceConversationUsername
      ? `@${forwardedFrom.sourceConversationUsername}`
      : "") ||
    (forwardedFrom?.sourceAuthorUsername
      ? `@${forwardedFrom.sourceAuthorUsername}`
      : "") ||
    "";
  const forwardedSourceAvatarUrl = resolveStorageFileUrl(forwardedFrom?.sourceAvatarKey);
  const forwardedSourceInitial =
    forwardedSourceName.replace(/^@+/, "").trim()[0]?.toUpperCase() ?? "#";
  const forwardedSourceAvatarSeed =
    forwardedFrom?.conversationId ||
    forwardedFrom?.authorId ||
    forwardedSourceName ||
    "forwarded";
  const forwardedSourceHref =
    forwardedSourceLinksToMessage &&
    forwardedFrom?.conversationId &&
    forwardedFrom?.messageId
      ? `/c/${forwardedFrom.conversationId}/${forwardedFrom.messageId}`
      : forwardedProfileUsername
        ? `/@${forwardedProfileUsername}`
      : "";

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

  const commentsVisual = (
    <Avatar
      size="sm"
      className={cn(
        "size-6 shrink-0 border border-white/15",
        senderAvatarClassName,
      )}
    >
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className={!avatarUrl ? "bg-transparent text-[11px] text-white" : ""}>
        {authorInitial}
      </AvatarFallback>
    </Avatar>
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

          {forwardedFrom && forwardedSourceName ? (
            <div
              className={cn(
                "mb-1 max-w-full text-[12px] leading-tight",
                isOwn
                  ? "text-primary-foreground/75"
                  : "text-muted-foreground",
              )}
            >
              <span className="block font-normal">{tMessages("forwardedFrom")}</span>
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                <Avatar
                  size="sm"
                  className={cn(
                    "size-5 shrink-0 bg-linear-to-br",
                    getAvatarGradient(forwardedSourceAvatarSeed),
                  )}
                >
                  {forwardedSourceAvatarUrl ? (
                    <AvatarImage src={forwardedSourceAvatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="bg-transparent text-[10px] font-semibold text-white">
                    {forwardedSourceInitial}
                  </AvatarFallback>
                </Avatar>
                {forwardedSourceHref ? (
                  <Link
                    href={forwardedSourceHref}
                    className={cn(
                      "min-w-0 truncate font-semibold hover:underline",
                      isOwn ? "text-primary-foreground" : "text-primary",
                    )}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {forwardedSourceName}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      "min-w-0 truncate font-semibold",
                      isOwn ? "text-primary-foreground" : "text-primary",
                    )}
                  >
                    {forwardedSourceName}
                  </span>
                )}
              </div>
            </div>
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
    <div ref={bubbleRef}>
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
    </div>
  );
});
