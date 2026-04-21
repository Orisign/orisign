"use client";

import {
  type UserResponseDto,
  useConversationsControllerMy,
  useUsersControllerMe,
} from "@/api/generated";
import { ChatItem } from "@/components/chat/chat-item";
import { CreateConversationUserRow } from "@/components/chat/create-conversation-user-row";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
} from "@/components/ui/sidebar-page";
import { sidebarStore } from "@/store/sidebar/sidebar.store";
import { useUsersList } from "@/hooks/use-users-list";
import { SPRING_MICRO } from "@/lib/animations";
import { getConversationTitle } from "@/lib/chat";
import {
  buildDirectConversationPath,
  buildUserDirectPath,
  findDirectConversationWithUser,
} from "@/lib/direct-chat";
import { Button, Input, Skeleton, SkeletonGroup } from "@repo/ui";
import { AnimatePresence, motion } from "motion/react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";

const SEARCH_ICON_VARIANTS = {
  hidden: { opacity: 0, rotate: -72, scale: 0.86 },
  visible: {
    opacity: 1,
    rotate: 0,
    scale: 1,
    transition: SPRING_MICRO,
  },
  exit: { opacity: 0, rotate: 72, scale: 0.86, transition: SPRING_MICRO },
} as const;

export const ChatSearchSidebar = () => {
  const t = useTranslations("chatSearchSidebar");
  const { pop } = sidebarStore();
  const router = useRouter();
  const me = useUsersControllerMe();
  const currentUser = me.data?.user ?? null;
  const { data, isLoading } = useConversationsControllerMy();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const conversations = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    const allConversations = data?.conversations ?? [];
    return allConversations.filter((conversation) =>
      [
        getConversationTitle(conversation),
        conversation.username ? `@${conversation.username}` : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [data?.conversations, normalizedQuery]);
  const usersQuery = useUsersList({
    query: deferredQuery,
    excludeIds: currentUser?.id ? [currentUser.id] : [],
    limit: 20,
    enabled: Boolean(normalizedQuery),
  });
  const users = usersQuery.data?.users ?? [];

  function openDirect(user: UserResponseDto) {
    if (!user.id) {
      return;
    }

    const existingConversation = findDirectConversationWithUser(
      data?.conversations,
      user.id,
      currentUser?.id,
    );

    pop();
    router.push(
      existingConversation
        ? buildDirectConversationPath(existingConversation, user)
        : buildUserDirectPath(user),
    );
  }

  return (
    <SidebarPage className="h-full">
      <SidebarPageHeader className="items-center gap-3 pb-3">
        <Button
          onClick={pop}
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={t("backAriaLabel")}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key="search-back-icon"
              variants={SEARCH_ICON_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="inline-flex size-5 items-center justify-center"
            >
              <FiArrowLeft className="size-5" />
            </motion.span>
          </AnimatePresence>
        </Button>
        <Input
          leftSlot={<Search className="size-5" />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("placeholder")}
          autoFocus
        />
      </SidebarPageHeader>

      <SidebarPageContent>
        {isLoading ? (
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
        ) : null}

        {!isLoading && !normalizedQuery ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">{t("startTyping")}</p>
        ) : null}

        {!isLoading && normalizedQuery && conversations.length === 0 && users.length === 0 && !usersQuery.isPending ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">{t("empty")}</p>
        ) : null}

        {!isLoading && conversations.length > 0 ? (
          <div className="flex w-full flex-col gap-1">
            <p className="px-2 pt-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("chatsTitle")}
            </p>
            {conversations.map((conversation) => (
              <div key={conversation.id}>
                <ChatItem conversation={conversation} />
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && usersQuery.isPending ? (
          <SkeletonGroup durationMs={1500} className="flex w-full flex-col gap-1">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={`search-user-sidebar-${index}`} className="h-14 w-full rounded-xl" />
            ))}
          </SkeletonGroup>
        ) : null}

        {!isLoading && users.length > 0 ? (
          <div className="mt-3 flex w-full flex-col gap-1">
            <p className="px-2 pt-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("peopleTitle")}
            </p>
            {users.map((user) => (
              <CreateConversationUserRow
                key={`search-user-${user.id}`}
                conversationSeed="chat-search"
                user={user}
                subtitle={
                  user.username
                    ? `@${user.username}${user.username.endsWith("bot") ? ` · ${t("botLabel")}` : ""}`
                    : t("createDirect")
                }
                checked={false}
                showCheckbox={false}
                onToggle={() => {
                  openDirect(user);
                }}
              />
            ))}
          </div>
        ) : null}
      </SidebarPageContent>
    </SidebarPage>
  );
};
