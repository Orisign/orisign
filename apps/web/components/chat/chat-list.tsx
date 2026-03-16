"use client";

import { useConversationsControllerMy } from "@/api/generated";
import { getConversationSubtitle, getConversationTitle } from "@/lib/chat";
import { filterConversationsByChatFolder, type ChatFolder } from "@/lib/chat-folders";
import { Skeleton, SkeletonGroup } from "@repo/ui";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { ChatItem } from "./chat-item";
import { useChatListRealtime } from "@/hooks/use-chat-list-realtime";
import { useCurrentUser } from "@/hooks/use-current-user";

interface ChatListProps {
  activeFolder?: ChatFolder | null;
  searchQuery?: string;
}

export const ChatList = ({ activeFolder = null, searchQuery = "" }: ChatListProps) => {
  const t = useTranslations("chat.list");
  const { user } = useCurrentUser();
  useChatListRealtime(user?.id);
  const { data, isLoading } = useConversationsControllerMy();

  const allConversations = useMemo(() => data?.conversations ?? [], [data?.conversations]);
  const folderFilteredConversations = useMemo(
    () => filterConversationsByChatFolder(allConversations, activeFolder),
    [activeFolder, allConversations],
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const conversations = useMemo(() => {
    if (!normalizedSearchQuery) {
      return folderFilteredConversations;
    }

    return folderFilteredConversations.filter((conversation) => {
      const title = getConversationTitle(conversation).toLowerCase();
      const subtitle = getConversationSubtitle(conversation).toLowerCase();

      return (
        title.includes(normalizedSearchQuery) ||
        subtitle.includes(normalizedSearchQuery)
      );
    });
  }, [folderFilteredConversations, normalizedSearchQuery]);

  if (isLoading) {
    return (
      <SkeletonGroup durationMs={2100} className="flex w-full flex-col gap-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3.5 w-11/12" />
            </div>
          </div>
        ))}
      </SkeletonGroup>
    );
  }

  if (conversations.length === 0) {
    return <p className="px-2 py-4 text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="flex w-full flex-col gap-1">
      {conversations.map((conversation) => (
        <div key={conversation.id}>
          <ChatItem conversation={conversation} />
        </div>
      ))}
    </div>
  );
};
