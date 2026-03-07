"use client";

import { useConversationsControllerMy } from "@/api/generated";
import { Skeleton, SkeletonGroup } from "@repo/ui";
import { useTranslations } from "next-intl";
import { ChatItem } from "./chat-item";

export const ChatList = () => {
  const t = useTranslations("chat.list");
  const { data, isLoading } = useConversationsControllerMy();

  const conversations = data?.conversations ?? [];

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
        <ChatItem conversation={conversation} key={conversation.id} />
      ))}
    </div>
  );
};
