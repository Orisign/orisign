"use client";

import { ConversationResponseDto } from "@/api/generated";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useChatAuthors, useChatLastMessagePreview } from "@/hooks/use-chat";
import {
  formatChatListMessagePreview,
  formatConversationTime,
  getAvatarGradient,
  getConversationInitial,
  getConversationSubtitle,
  getConversationTitle,
  getUserDisplayName,
} from "@/lib/chat";
import { cn, Ripple } from "@repo/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

interface ChatItemProps {
  conversation: ConversationResponseDto;
}

export function ChatItem({ conversation }: ChatItemProps) {
  const t = useTranslations("chat.list");
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const isActive = pathname === `/${conversation.id}`;
  const { data: lastMessagePreview } = useChatLastMessagePreview(conversation.id);
  const title = getConversationTitle(conversation);
  const initial = getConversationInitial(conversation);
  const fallbackSubtitle = getConversationSubtitle(conversation);
  const membersCount = conversation.members?.length ?? 0;
  const lastMessage = lastMessagePreview?.message ?? null;
  const { data: lastMessageAuthorMap } = useChatAuthors(
    lastMessage?.authorId ? [lastMessage.authorId] : [],
  );
  const lastMessageAuthor = lastMessage?.authorId
    ? (lastMessageAuthorMap?.[lastMessage.authorId] ?? null)
    : null;
  const lastMessagePrefix =
    lastMessage?.authorId === user?.id
      ? t("ownPrefix")
      : lastMessage
        ? `${getUserDisplayName(lastMessageAuthor, t("unknownAuthor"))}:`
        : "";
  const lastMessageText = formatChatListMessagePreview(lastMessage, {
    prefixLabel: lastMessagePrefix,
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
      })
    : formatConversationTime(conversation);

  return (
    <Ripple asChild className="w-full rounded-xl">
      <Link
        href={`/${conversation.id}`}
        className={cn(
          "block w-full cursor-pointer rounded-xl px-2 py-2.5 transition-colors duration-200",
          isActive
            ? "bg-primary text-primary-foreground hover:bg-primary/95"
            : "hover:bg-accent/70",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-base font-semibold text-white",
              getAvatarGradient(conversation.id),
            )}
          >
            {initial}
          </div>
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
            <div className="mt-0.5 flex items-center gap-2">
              <p
                className={cn(
                  "min-w-0 flex-1 overflow-hidden text-sm",
                  isActive
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                  lastMessage &&
                    "truncate text-left [direction:rtl] [text-overflow:ellipsis] [unicode-bidi:plaintext]",
                )}
                title={subtitle}
              >
                {subtitle}
              </p>
              {membersCount > 1 ? (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    isActive
                      ? "bg-primary-foreground/16 text-primary-foreground"
                      : "bg-primary/15 text-primary",
                  )}
                >
                  {membersCount}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </Link>
    </Ripple>
  );
}
