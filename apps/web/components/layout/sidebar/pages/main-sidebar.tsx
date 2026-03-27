"use client";

import {
  CreateConversationRequestDtoType,
  getConversationsControllerMyQueryKey,
  useConversationsControllerCreate,
  useConversationsControllerMy,
} from "@/api/generated";
import { ChatItem } from "@/components/chat/chat-item";
import { ChatList } from "@/components/chat/chat-list";
import { CreateConversationUserRow } from "@/components/chat/create-conversation-user-row";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
} from "@/components/ui/sidebar-page";
import { CreateConversationDropdown } from "@/components/user/create-conversation-dropdown";
import { UserDropdown } from "@/components/user/user-dropdown";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useChatFolders } from "@/hooks/use-chat-folders";
import {
  useClearSearchHistory,
  useDeleteSearchHistoryEntry,
  useSearchHistory,
  useUpsertSearchHistory,
} from "@/hooks/use-search-history";
import { useUsersList } from "@/hooks/use-users-list";
import { getConversationTitle } from "@/lib/chat";
import {
  CHAT_FOLDER_ALL_TAB_ID,
  normalizeChatFolderName,
} from "@/lib/chat-folders";
import {
  Input,
  Skeleton,
  SkeletonGroup,
  Tabs,
  TabsList,
  TabsTrigger,
  Button,
  toast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { History, Search, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { SidebarAnimatedMenuIcon } from "./animated-menu-icon";

type SidebarContentView = "main" | "search";

export const MainSidebar = () => {
  const t = useTranslations("appShell");
  const tSearch = useTranslations("chatSearchSidebar");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: currentUser } = useCurrentUser();
  const { data: foldersData } = useChatFolders();
  const { data: searchData, isLoading: isSearchLoading } =
    useConversationsControllerMy();

  const [activeFolderId, setActiveFolderId] = useState(CHAT_FOLDER_ALL_TAB_ID);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [isClearHistoryDialogOpen, setIsClearHistoryDialogOpen] = useState(false);

  const { data: searchHistoryData, isLoading: isSearchHistoryLoading } =
    useSearchHistory(20, isSearchOpen);
  const { mutate: upsertSearchHistory } = useUpsertSearchHistory();
  const { mutate: deleteSearchHistoryEntry, isPending: isDeletingSearchHistoryEntry } =
    useDeleteSearchHistoryEntry();
  const { mutate: clearSearchHistory, isPending: isClearingSearchHistory } =
    useClearSearchHistory();
  const { mutateAsync: createConversation, isPending: isCreatingConversation } =
    useConversationsControllerCreate();

  const inputRef = useRef<HTMLInputElement | null>(null);

  const folders = useMemo(
    () =>
      [...(foldersData?.folders ?? [])].sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.createdAt - right.createdAt,
      ),
    [foldersData?.folders],
  );

  const resolvedActiveFolderId = useMemo(() => {
    if (activeFolderId === CHAT_FOLDER_ALL_TAB_ID) {
      return CHAT_FOLDER_ALL_TAB_ID;
    }

    const hasActiveFolder = folders.some((folder) => folder.id === activeFolderId);
    return hasActiveFolder ? activeFolderId : CHAT_FOLDER_ALL_TAB_ID;
  }, [activeFolderId, folders]);

  const activeFolder = useMemo(() => {
    if (resolvedActiveFolderId === CHAT_FOLDER_ALL_TAB_ID) {
      return null;
    }

    return folders.find((folder) => folder.id === resolvedActiveFolderId) ?? null;
  }, [folders, resolvedActiveFolderId]);

  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedSearchQuery) {
      return [];
    }

    return (searchData?.conversations ?? []).filter((conversation) =>
      [
        getConversationTitle(conversation),
        conversation.username ? `@${conversation.username}` : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery),
    );
  }, [normalizedSearchQuery, searchData?.conversations]);
  const usersSearchQuery = useUsersList({
    query: deferredSearchQuery,
    excludeIds: currentUser?.id ? [currentUser.id] : [],
    limit: 20,
    enabled: isSearchOpen && Boolean(normalizedSearchQuery),
  });
  const userSearchResults = usersSearchQuery.data?.users ?? [];
  const hasSearchResults =
    searchResults.length > 0 || userSearchResults.length > 0;
  const searchHistoryEntries = searchHistoryData?.entries;
  const historyConversations = useMemo(() => {
    const conversations = searchData?.conversations ?? [];
    const entries = searchHistoryEntries ?? [];
    const conversationsById = new Map(
      conversations.map((conversation) => [conversation.id, conversation]),
    );

    return entries
      .map((entry) => ({
        entryId: entry.id,
        conversation: conversationsById.get(entry.conversationId) ?? null,
      }))
      .filter(
        (item): item is { entryId: string; conversation: (typeof conversations)[number] } =>
          Boolean(item.conversation),
      );
  }, [searchData?.conversations, searchHistoryEntries]);

  const activeContentView: SidebarContentView = isSearchOpen ? "search" : "main";
  const showTabs = !isSearchOpen;

  const handleOpenSearch = useCallback(() => {
    if (isSearchOpen) {
      return;
    }

    setSearchQuery("");
    setIsSearchOpen(true);
  }, [isSearchOpen]);

  const handleCloseSearch = useCallback(() => {
    if (!isSearchOpen) {
      return;
    }

    setIsSearchOpen(false);
    setSearchQuery("");
  }, [isSearchOpen]);

  const persistSearchConversation = useCallback(
    (conversationId: string) => {
      const normalizedConversationId = conversationId.trim();
      if (!normalizedConversationId) {
        return;
      }

      upsertSearchHistory(normalizedConversationId);
    },
    [upsertSearchHistory],
  );

  const handleOpenDirectConversation = useCallback(
    async (userId: string) => {
      if (!userId || isCreatingConversation) {
        return;
      }

      try {
        const response = await createConversation({
          data: {
            type: CreateConversationRequestDtoType.DM,
            memberIds: [userId],
          },
        });

        const conversationId = response.conversation?.id?.trim() ?? "";
        if (!conversationId) {
          throw new Error("Conversation was not created");
        }

        await queryClient.invalidateQueries({
          queryKey: getConversationsControllerMyQueryKey(),
        });
        persistSearchConversation(conversationId);
        setIsSearchOpen(false);
        setSearchQuery("");
        router.push(`/${conversationId}`);
      } catch {
        toast({
          title: tSearch("openChatError"),
          type: "error",
        });
      }
    },
    [
      createConversation,
      isCreatingConversation,
      persistSearchConversation,
      queryClient,
      router,
      tSearch,
    ],
  );

  useEffect(() => {
    if (!isSearchOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      handleCloseSearch();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCloseSearch, isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) return;

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isSearchOpen]);

  const menuTriggerIcon = <SidebarAnimatedMenuIcon isBack={isSearchOpen} />;

  const renderMainContent = () => (
    <div className="relative h-full min-w-0">
      <div className="relative">
        <ChatList activeFolder={activeFolder} />
      </div>
      <CreateConversationDropdown />
    </div>
  );

  const renderSearchContent = () => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isSearchLoading ? (
          <SkeletonGroup durationMs={2100} className="flex w-full flex-col gap-1 px-1 py-1">
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

        {!isSearchLoading && !normalizedSearchQuery ? (
          <section className="border-b border-border/60 pb-2">
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <p className="text-[13px] font-semibold text-muted-foreground">
                {tSearch("historyTitle")}
              </p>
              {historyConversations.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full"
                  onClick={() => setIsClearHistoryDialogOpen(true)}
                  disabled={isClearingSearchHistory}
                  aria-label={tSearch("clearAll")}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              ) : null}
            </div>

            {isSearchHistoryLoading ? (
              <SkeletonGroup durationMs={1800} className="flex w-full flex-col gap-1 px-2 py-1">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full rounded-xl" />
                ))}
              </SkeletonGroup>
            ) : null}

            {!isSearchHistoryLoading && historyConversations.length > 0 ? (
              <div className="flex w-full flex-col gap-0.5 px-1">
                {historyConversations.map(({ entryId, conversation }) => (
                  <div
                    key={entryId}
                    className="group relative rounded-xl"
                    onClick={() => {
                      persistSearchConversation(conversation.id);
                      handleCloseSearch();
                    }}
                  >
                    <div className="pr-9">
                      <ChatItem conversation={conversation} />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-3 top-1/2 z-20 size-7 -translate-y-1/2 rounded-full bg-background/90 opacity-70 backdrop-blur-xs transition group-hover:opacity-100"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        deleteSearchHistoryEntry(entryId);
                      }}
                      disabled={isDeletingSearchHistoryEntry}
                      aria-label={tSearch("deleteHistoryItemAriaLabel")}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            {!isSearchHistoryLoading && historyConversations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <History className="size-8 text-muted-foreground/70" />
                <p className="text-sm font-medium text-foreground">
                  {tSearch("emptyRecentTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tSearch("emptyRecentDescription")}
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {!isSearchLoading && normalizedSearchQuery ? (
          <section className="border-b border-border/60 pb-2">
            <div className="px-4 pb-2 pt-3">
              <p className="text-[13px] font-semibold text-muted-foreground">
                {tSearch("resultsTitle")}
              </p>
            </div>

            {searchResults.length > 0 ? (
              <div className="px-4 pb-2 pt-1">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {tSearch("chatsTitle")}
                </p>
              </div>
            ) : null}

            {searchResults.length > 0 ? (
              <div className="flex w-full flex-col gap-0.5 px-1">
                {searchResults.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => {
                      persistSearchConversation(conversation.id);
                      handleCloseSearch();
                    }}
                  >
                    <ChatItem conversation={conversation} />
                  </div>
                ))}
              </div>
            ) : null}

            {usersSearchQuery.isPending ? (
              <SkeletonGroup durationMs={1600} className="flex w-full flex-col gap-1 px-2 py-1">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={`search-user-skeleton-${index}`} className="h-14 w-full rounded-xl" />
                ))}
              </SkeletonGroup>
            ) : null}

            {!usersSearchQuery.isPending && userSearchResults.length > 0 ? (
              <>
                <div className="px-4 pb-2 pt-3">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {tSearch("peopleTitle")}
                  </p>
                </div>
                <div className="flex w-full flex-col gap-0.5 px-1">
                  {userSearchResults.map((user) => (
                    <CreateConversationUserRow
                      key={`search-user-${user.id}`}
                      conversationSeed="search"
                      user={user}
                      subtitle={
                        user.username
                          ? `@${user.username}${user.username.endsWith("bot") ? ` · ${tSearch("botLabel")}` : ""}`
                          : tSearch("createDirect")
                      }
                      checked={false}
                      showCheckbox={false}
                      onToggle={() => {
                        void handleOpenDirectConversation(user.id);
                      }}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {!usersSearchQuery.isPending && !hasSearchResults ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                {tSearch("empty")}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );

  const renderContentView = (view: SidebarContentView) => {
    if (view === "search") {
      return renderSearchContent();
    }

    return renderMainContent();
  };

  return (
    <SidebarPage className="h-full">
      <SidebarPageHeader className="flex-col items-stretch gap-3 pb-3">
        <div className="flex items-center gap-3">
          <UserDropdown
            triggerIcon={menuTriggerIcon}
            triggerClassName="size-11 rounded-full p-0 [&_svg]:!size-6"
            preventOpen={isSearchOpen}
            onTriggerAction={handleCloseSearch}
            triggerAriaLabel={isSearchOpen ? tSearch("backAriaLabel") : "Menu"}
          />

          <Input
            leftSlot={<Search className="size-5" />}
            placeholder={isSearchOpen ? tSearch("placeholder") : t("searchPlaceholder")}
            readOnly={!isSearchOpen}
            ref={inputRef}
            value={isSearchOpen ? searchQuery : ""}
            onChange={(event) => setSearchQuery(event.target.value)}
            className={isSearchOpen ? "" : "cursor-pointer"}
            onClick={() => {
              if (!isSearchOpen) {
                handleOpenSearch();
              }
            }}
            onFocus={() => {
              if (!isSearchOpen) {
                handleOpenSearch();
              }
            }}
            aria-label={isSearchOpen ? tSearch("placeholder") : t("searchPlaceholder")}
          />
        </div>

        <div
          className={showTabs ? "overflow-hidden" : "hidden"}
          aria-hidden={!showTabs}
        >
          <Tabs value={resolvedActiveFolderId} onValueChange={setActiveFolderId}>
            <TabsList className="w-full gap-1 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
              <TabsTrigger
                value={CHAT_FOLDER_ALL_TAB_ID}
                className="shrink-0 rounded-xl px-3 py-2.5"
              >
                {t("folderTabs.allChats")}
              </TabsTrigger>
              {folders.map((folder) => (
                <TabsTrigger
                  key={folder.id}
                  value={folder.id}
                  className="shrink-0 rounded-xl px-3 py-2.5"
                  title={folder.name}
                >
                  {normalizeChatFolderName(folder.name, t("folderTabs.untitled"))}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </SidebarPageHeader>

      <SidebarPageContent className="relative min-h-0 flex-1">
        <div className="relative h-full min-w-0 overflow-hidden">
          <div className="absolute inset-0 min-w-0">
            {renderContentView(activeContentView)}
          </div>
        </div>
      </SidebarPageContent>

      <Dialog
        open={isClearHistoryDialogOpen}
        onOpenChange={setIsClearHistoryDialogOpen}
      >
        <DialogContent className="max-w-[26rem] rounded-2xl border-border/70 bg-background p-5">
          <DialogHeader className="gap-2">
            <DialogTitle className="text-base">
              {tSearch("clearDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {tSearch("clearDialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsClearHistoryDialogOpen(false)}
              disabled={isClearingSearchHistory}
            >
              {tSearch("clearDialogCancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                clearSearchHistory();
                setIsClearHistoryDialogOpen(false);
              }}
              disabled={isClearingSearchHistory}
            >
              {tSearch("clearDialogConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarPage>
  );
};
