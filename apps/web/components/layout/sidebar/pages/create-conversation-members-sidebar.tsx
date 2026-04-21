"use client";

import {
  getConversationsControllerMyQueryKey,
  useConversationsControllerMy,
  useUsersControllerMe,
} from "@/api/generated";
import { CreateConversationUserChip } from "@/components/chat/create-conversation-user-chip";
import { CreateConversationUserRow } from "@/components/chat/create-conversation-user-row";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
  SidebarPageTitle,
} from "@/components/ui/sidebar-page";
import { useChatAuthors } from "@/hooks/use-chat";
import { sidebarStore } from "@/store/sidebar/sidebar.store";
import { useUsersList } from "@/hooks/use-users-list";
import {
  buildDirectConversationPath,
  buildUserDirectPath,
  findDirectConversationWithUser,
} from "@/lib/direct-chat";
import { cn } from "@/lib/utils";
import type { SidebarRoute } from "@/store/sidebar/sidebar-state.types";
import { Button, Input } from "@repo/ui";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

interface CreateConversationMembersSidebarProps {
  route: Extract<SidebarRoute, { screen: "create-conversation-members" }>;
}

export function CreateConversationMembersSidebar({
  route,
}: CreateConversationMembersSidebarProps) {
  const t = useTranslations("createConversation.members");
  const me = useUsersControllerMe();
  const currentUser = me.data?.user ?? null;
  const { pop, push, reset, setCurrent } = sidebarStore();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    route.selectedUserIds,
  );
  const isDirect = route.type === "direct";

  const usersQuery = useUsersList({
    query: deferredSearch,
    excludeIds: currentUser?.id ? [currentUser.id] : [],
    limit: 60,
  });
  const directConversationsQuery = useConversationsControllerMy(undefined, {
    query: {
      queryKey: getConversationsControllerMyQueryKey(),
      staleTime: 60_000,
    },
  });
  const selectedUsersQuery = useChatAuthors(selectedUserIds);

  const selectedUsers = useMemo(
    () =>
      selectedUserIds
        .map((id) => selectedUsersQuery.data?.[id] ?? null)
        .filter((user): user is NonNullable<typeof user> => Boolean(user)),
    [selectedUserIds, selectedUsersQuery.data],
  );

  function handleToggleUser(userId: string) {
    const isSelected = selectedUserIds.includes(userId);
    if (isDirect) {
      setSelectedUserIds(isSelected ? [] : [userId]);
      return;
    }

    setSelectedUserIds(
      isSelected
        ? selectedUserIds.filter((id) => id !== userId)
        : [...selectedUserIds, userId],
    );
  }

  function handleNext() {
    if (selectedUserIds.length === 0) {
      return;
    }

    if (isDirect) {
      const selectedUserId = selectedUserIds[0] ?? "";
      const selectedUser =
        selectedUsers[0] ??
        usersQuery.data?.users.find((user) => user.id === selectedUserId) ??
        null;
      const existingConversation = findDirectConversationWithUser(
        directConversationsQuery.data?.conversations,
        selectedUserId,
        currentUser?.id,
      );

      reset();
      router.push(
        existingConversation
          ? buildDirectConversationPath(existingConversation, selectedUser)
          : buildUserDirectPath(selectedUser ?? { id: selectedUserId }),
      );
      return;
    }

    setCurrent({
      ...route,
      selectedUserIds: [...selectedUserIds],
    });
    push({
      screen: "create-conversation-details",
      type: "group",
      memberIds: [...selectedUserIds],
    });
  }

  const users = usersQuery.data?.users ?? [];

  return (
    <SidebarPage className="h-full pb-24">
      <SidebarPageHeader className="flex-col items-stretch gap-4 pb-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={pop}>
            <ArrowLeft className="size-6" strokeWidth={2.8} />
          </Button>
          <SidebarPageTitle>{t(isDirect ? "titleDirect" : "titleGroup")}</SidebarPageTitle>
        </div>

        <div className="space-y-3">
          {selectedUsers.length > 0 ? (
            <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max items-center gap-2">
                {selectedUsers.map((user) => (
                  <CreateConversationUserChip
                    key={user.id}
                    conversationSeed={`create:${route.type}`}
                    user={user}
                    onRemove={() => handleToggleUser(user.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <Input
            leftSlot={<Search className="size-5" />}
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            wrapperClassName="h-12 rounded-2xl bg-secondary/75"
          />
        </div>
      </SidebarPageHeader>

      <SidebarPageContent className="px-0">
        <div className="flex flex-col gap-0.5 px-2">
          {users.map((user) => (
            <CreateConversationUserRow
              key={user.id}
              conversationSeed={`create:${route.type}`}
              user={user}
              subtitle={user.username ? `@${user.username}` : t("recently")}
              checked={selectedUserIds.includes(user.id)}
              onToggle={() => handleToggleUser(user.id)}
            />
          ))}

          {!usersQuery.isPending && users.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">{t("empty")}</p>
          ) : null}
        </div>
      </SidebarPageContent>

      <Button
        type="button"
        size="icon"
        onClick={handleNext}
        disabled={selectedUserIds.length === 0}
        className={cn(
          "absolute bottom-4 right-4 z-40 size-14 rounded-full shadow-none [&_svg]:size-7",
          selectedUserIds.length === 0 && "opacity-60",
        )}
      >
        <ArrowRight className="size-7" strokeWidth={2.8} />
      </Button>
    </SidebarPage>
  );
}
