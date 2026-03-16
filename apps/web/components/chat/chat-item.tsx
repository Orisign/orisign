"use client";

import { ConversationResponseDto } from "@/api/generated";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useChatAuthors, useChatLastMessagePreview, useChatUnreadCount } from "@/hooks/use-chat";
import {
  formatChatListMessagePreview,
  formatConversationTime,
  getAvatarGradient,
  getConversationAvatarUrl,
  getConversationInitial,
  getConversationSubtitle,
  getConversationTitle,
  getUserAvatarUrl,
  getUserDisplayName,
  getUserInitial,
  isDirectConversation,
} from "@/lib/chat";
import { cn, Ripple } from "@repo/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";

interface ChatItemProps {
  conversation: ConversationResponseDto;
}

export function ChatItem({ conversation }: ChatItemProps) {
  const t = useTranslations("chat.list");
  const locale = useLocale();
  const timeFormat = useGeneralSettingsStore((state) => state.timeFormat);
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const isActive =
    pathname === `/${conversation.id}` || pathname.startsWith(`/c/${conversation.id}/`);
  const { data: lastMessagePreview } = useChatLastMessagePreview(conversation.id);
  const isDirect = isDirectConversation(conversation);
  const peerId = isDirect
    ? (conversation.members ?? []).find((member) => member.userId !== user?.id)?.userId
    : undefined;
  const lastMessage = lastMessagePreview?.message ?? null;
  const { data: unreadCountData } = useChatUnreadCount(conversation.id);
  const unreadCount = unreadCountData?.count ?? 0;
  const unreadLabel = unreadCount > 99 ? "99+" : `${unreadCount}`;
  const relatedUserIds = [
    ...(lastMessage?.authorId ? [lastMessage.authorId] : []),
    ...(peerId ? [peerId] : []),
  ];
  const { data: usersMap } = useChatAuthors(relatedUserIds);
  const lastMessageAuthor = lastMessage?.authorId
    ? (usersMap?.[lastMessage.authorId] ?? null)
    : null;
  const peerUser = peerId ? (usersMap?.[peerId] ?? null) : null;
  const title = isDirect
    ? getUserDisplayName(peerUser, t("unknownAuthor"))
    : getConversationTitle(conversation);
  const initial = isDirect
    ? getUserInitial(peerUser, title)
    : getConversationInitial(conversation);
  const avatarUrl = isDirect
    ? getUserAvatarUrl(peerUser)
    : getConversationAvatarUrl(conversation);
  const fallbackSubtitle = isDirect
    ? (peerUser?.username ? `@${peerUser.username}` : getConversationSubtitle(conversation))
    : getConversationSubtitle(conversation);
  const lastMessagePrefix =
    lastMessage?.authorId === user?.id
      ? t("ownPrefix")
      : lastMessage
        ? `${getUserDisplayName(lastMessageAuthor, t("unknownAuthor"))}:`
        : "";
  const lastMessageText = formatChatListMessagePreview(lastMessage, {
    prefixLabel: lastMessagePrefix,
    callLabels: {
      title: t("call.title"),
      separator: "·",
      status: {
        completed: t("call.status.completed"),
        declined: t("call.status.declined"),
        canceled: t("call.status.canceled"),
        failed: t("call.status.failed"),
      },
    },
    mediaLabels: {
      photo: t("media.photo"),
      file: t("media.file"),
      attachment: t("media.attachment"),
    },
  });
  const subtitle = lastMessageText || fallbackSubtitle;
  const timeLabel = lastMessagePreview?.message
    ? formatConversationTime({
        ...conversation,
        updatedAt: lastMessagePreview.message.createdAt,
      }, locale, { timeFormat })
    : formatConversationTime(conversation, locale, { timeFormat });

  return (
    <Ripple asChild className="w-full rounded-xl">
      <div className="relative">
        {isActive ? (
          <span className="absolute inset-0 rounded-xl bg-primary" aria-hidden />
        ) : null}
        <Link
          href={`/${conversation.id}`}
          className={cn(
            "relative z-10 block w-full cursor-pointer rounded-xl px-2 py-2.5 transition-colors duration-200",
            isActive ? "text-primary-foreground" : "hover:bg-accent/70",
          )}
        >
          <div className="flex items-center gap-3">
            <Avatar
              size="lg"
              className={cn(
                !avatarUrl
                  ? cn(
                      "text-white",
                      `bg-linear-to-br ${getAvatarGradient(peerId ?? conversation.id)}`,
                    )
                  : "",
              )}
            >
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback className={!avatarUrl ? "bg-transparent text-white" : ""}>
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[15px] font-semibold leading-5">
                  {title}
                </p>
                {timeLabel ? (
                  <span
                    className={cn(
                      "ml-auto shrink-0 text-xs",
                      isActive
                        ? "text-primary-foreground/75"
                        : "text-muted-foreground",
                    )}
                  >
                    {timeLabel}
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <p
                  className={cn(
                    "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm",
                    isActive
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground",
                  )}
                  title={subtitle}
                >
                  {subtitle}
                </p>
                {unreadCount > 0 && !isActive ? (
                  <span
                    className={cn(
                      "justify-self-end rounded-full px-2 py-0.5 text-xs font-semibold",
                      isActive
                        ? "bg-primary-foreground/16 text-primary-foreground"
                        : "bg-primary/15 text-primary",
                    )}
                  >
                    {unreadLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </Link>
      </div>
    </Ripple>
  );
}
