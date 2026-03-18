"use client";

import { useConversationsControllerMy } from "@/api/generated";
import { ChatItem } from "@/components/chat/chat-item";
import { ChatList } from "@/components/chat/chat-list";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
} from "@/components/ui/sidebar-page";
import { CreateConversationDropdown } from "@/components/user/create-conversation-dropdown";
import { UserDropdown } from "@/components/user/user-dropdown";
import { useChatFolders } from "@/hooks/use-chat-folders";
import {
  useClearSearchHistory,
  useDeleteSearchHistoryEntry,
  useSearchHistory,
  useUpsertSearchHistory,
} from "@/hooks/use-search-history";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { motion } from "motion/react";
import { History, Search, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SidebarContentView = "main" | "search";

interface SidebarContentTransition {
  id: string;
  from: SidebarContentView;
  to: SidebarContentView;
}

const SEARCH_VIEW_DURATION_MS = 150;
const SEARCH_VIEW_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const SEARCH_BUTTON_TRANSITION = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1],
} as const;
const SEARCH_TABS_TRANSITION = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
} as const;

function resetSearchViewLayerStyles(layer: HTMLDivElement) {
  layer.style.transition = "";
  layer.style.transform = "translate3d(0, 0, 0) scale(1)";
  layer.style.opacity = "1";
  layer.style.willChange = "";
}

export const MainSidebar = () => {
  const t = useTranslations("appShell");
  const tSearch = useTranslations("chatSearchSidebar");
  const { data: foldersData } = useChatFolders();
  const { data: searchData, isLoading: isSearchLoading } =
    useConversationsControllerMy();

  const [activeFolderId, setActiveFolderId] = useState(CHAT_FOLDER_ALL_TAB_ID);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isClearHistoryDialogOpen, setIsClearHistoryDialogOpen] = useState(false);

  const { data: searchHistoryData, isLoading: isSearchHistoryLoading } =
    useSearchHistory(20, isSearchOpen);
  const { mutate: upsertSearchHistory } = useUpsertSearchHistory();
  const { mutate: deleteSearchHistoryEntry, isPending: isDeletingSearchHistoryEntry } =
    useDeleteSearchHistoryEntry();
  const { mutate: clearSearchHistory, isPending: isClearingSearchHistory } =
    useClearSearchHistory();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listPanelRef = useRef<HTMLDivElement | null>(null);
  const listSlideFrameRef = useRef<number | null>(null);
  const hasAnimatedTabsRef = useRef(false);
  const lastAnimatedFolderIdRef = useRef(CHAT_FOLDER_ALL_TAB_ID);
  const previousTabIndexRef = useRef(0);
  const tabDirectionRef = useRef<1 | -1>(1);

  const [displayedContentView, setDisplayedContentView] =
    useState<SidebarContentView>("main");
  const [contentTransition, setContentTransition] =
    useState<SidebarContentTransition | null>(null);
  const contentBaseLayerRef = useRef<HTMLDivElement | null>(null);
  const contentIncomingLayerRef = useRef<HTMLDivElement | null>(null);
  const displayedContentViewRef = useRef(displayedContentView);
  const contentTransitionRef = useRef(contentTransition);

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

  const tabOrder = useMemo(
    () => [CHAT_FOLDER_ALL_TAB_ID, ...folders.map((folder) => folder.id)],
    [folders],
  );
  const activeTabIndex = useMemo(() => {
    const index = tabOrder.indexOf(resolvedActiveFolderId);
    return index < 0 ? 0 : index;
  }, [resolvedActiveFolderId, tabOrder]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedSearchQuery) {
      return [];
    }

    return (searchData?.conversations ?? []).filter((conversation) =>
      getConversationTitle(conversation).toLowerCase().includes(normalizedSearchQuery),
    );
  }, [normalizedSearchQuery, searchData?.conversations]);
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

  const baseContentView = contentTransition
    ? contentTransition.from
    : displayedContentView;

  const showTabs = !isSearchOpen || contentTransition?.from === "main";
  const queueStateUpdate = (updater: () => void) => {
    queueMicrotask(updater);
  };

  useEffect(() => {
    const previousIndex = previousTabIndexRef.current;
    if (activeTabIndex === previousIndex) {
      return;
    }

    tabDirectionRef.current = activeTabIndex > previousIndex ? 1 : -1;
    previousTabIndexRef.current = activeTabIndex;
  }, [activeTabIndex]);

  useLayoutEffect(() => {
    const panel = listPanelRef.current;
    if (!panel) return;
    if (isSearchOpen) return;

    if (!hasAnimatedTabsRef.current) {
      hasAnimatedTabsRef.current = true;
      lastAnimatedFolderIdRef.current = resolvedActiveFolderId;
      return;
    }

    if (resolvedActiveFolderId === lastAnimatedFolderIdRef.current) {
      return;
    }

    lastAnimatedFolderIdRef.current = resolvedActiveFolderId;

    const fromX = tabDirectionRef.current === 1 ? 72 : -72;
    panel.style.transition = "none";
    panel.style.transform = `translate3d(${fromX}px, 0, 0)`;
    void panel.offsetHeight;

    if (listSlideFrameRef.current !== null) {
      cancelAnimationFrame(listSlideFrameRef.current);
    }

    listSlideFrameRef.current = requestAnimationFrame(() => {
      panel.style.transition = "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)";
      panel.style.transform = "translate3d(0, 0, 0)";
      listSlideFrameRef.current = null;
    });

    return () => {
      if (listSlideFrameRef.current !== null) {
        cancelAnimationFrame(listSlideFrameRef.current);
        listSlideFrameRef.current = null;
      }
    };
  }, [isSearchOpen, resolvedActiveFolderId]);

  useLayoutEffect(() => {
    displayedContentViewRef.current = displayedContentView;
    contentTransitionRef.current = contentTransition;
  }, [contentTransition, displayedContentView]);

  useLayoutEffect(() => {
    if (!contentTransition) {
      return;
    }

    const baseLayer = contentBaseLayerRef.current;
    const incomingLayer = contentIncomingLayerRef.current;

    if (!baseLayer || !incomingLayer) {
      queueStateUpdate(() => {
        setDisplayedContentView(contentTransition.to);
        setContentTransition(null);
      });
      return;
    }

    const isOpeningSearch = contentTransition.to === "search";
    const transitionValue = `transform ${SEARCH_VIEW_DURATION_MS}ms ${SEARCH_VIEW_EASING}, opacity ${SEARCH_VIEW_DURATION_MS}ms ${SEARCH_VIEW_EASING}`;

    resetSearchViewLayerStyles(baseLayer);
    resetSearchViewLayerStyles(incomingLayer);

    baseLayer.style.transition = "none";
    incomingLayer.style.transition = "none";

    baseLayer.style.transform = "translate3d(0, 0, 0) scale(1)";
    baseLayer.style.opacity = "1";
    incomingLayer.style.opacity = "0";
    incomingLayer.style.transform = isOpeningSearch
      ? "translate3d(0, 0, 0) scale(1.1)"
      : "translate3d(0, 0, 0) scale(0.95)";

    baseLayer.style.willChange = "transform, opacity";
    incomingLayer.style.willChange = "transform, opacity";
    void incomingLayer.offsetHeight;

    baseLayer.style.transition = transitionValue;
    incomingLayer.style.transition = transitionValue;

    baseLayer.style.opacity = "0";
    baseLayer.style.transform = isOpeningSearch
      ? "translate3d(0, 0, 0) scale(1)"
      : "translate3d(0, 0, 0) scale(1.1)";
    incomingLayer.style.opacity = "1";
    incomingLayer.style.transform = "translate3d(0, 0, 0) scale(1)";

    const finishTransition = () => {
      setContentTransition((prevTransition) => {
        if (!prevTransition || prevTransition.id !== contentTransition.id) {
          return prevTransition;
        }

        setDisplayedContentView(prevTransition.to);
        return null;
      });
    };

    const onTransitionEnd = (event: TransitionEvent) => {
      if (
        event.target !== incomingLayer ||
        event.propertyName !== "transform"
      ) {
        return;
      }

      finishTransition();
    };

    const timeoutId = window.setTimeout(
      finishTransition,
      SEARCH_VIEW_DURATION_MS + 60,
    );
    incomingLayer.addEventListener("transitionend", onTransitionEnd);

    return () => {
      window.clearTimeout(timeoutId);
      incomingLayer.removeEventListener("transitionend", onTransitionEnd);
      resetSearchViewLayerStyles(baseLayer);
      resetSearchViewLayerStyles(incomingLayer);
    };
  }, [contentTransition]);

  const startContentTransition = useCallback((to: SidebarContentView) => {
    const activeTransition = contentTransitionRef.current;
    const from = activeTransition
      ? activeTransition.to
      : displayedContentViewRef.current;

    if (from === to) {
      return;
    }

    setContentTransition({
      id: `${from}:${to}:${Date.now()}`,
      from,
      to,
    });
  }, []);

  const handleOpenSearch = useCallback(() => {
    if (isSearchOpen) {
      return;
    }

    startContentTransition("search");
    setSearchQuery("");
    setIsSearchOpen(true);
  }, [isSearchOpen, startContentTransition]);

  const handleCloseSearch = useCallback(() => {
    if (!isSearchOpen) {
      return;
    }

    startContentTransition("main");
    setIsSearchOpen(false);
    setSearchQuery("");
  }, [isSearchOpen, startContentTransition]);

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

  const menuTriggerIcon = (
    <span className="relative inline-flex size-6 items-center justify-center">
      <motion.span
        className="absolute h-0.5 rounded-full bg-current"
        initial={false}
        animate={{
          width: isSearchOpen ? 8 : 18,
          x: isSearchOpen ? -4 : 0,
          y: isSearchOpen ? -3 : -5,
          rotate: isSearchOpen ? -45 : 0,
        }}
        transition={SEARCH_BUTTON_TRANSITION}
      />
      <motion.span
        className="absolute h-0.5 rounded-full bg-current"
        initial={false}
        animate={{
          width: isSearchOpen ? 14 : 18,
          x: isSearchOpen ? 1 : 0,
          y: 0,
          rotate: 0,
        }}
        transition={SEARCH_BUTTON_TRANSITION}
      />
      <motion.span
        className="absolute h-0.5 rounded-full bg-current"
        initial={false}
        animate={{
          width: isSearchOpen ? 8 : 18,
          x: isSearchOpen ? -4 : 0,
          y: isSearchOpen ? 3 : 5,
          rotate: isSearchOpen ? 45 : 0,
        }}
        transition={SEARCH_BUTTON_TRANSITION}
      />
    </span>
  );

  const renderMainContent = () => (
    <div className="relative h-full min-w-0">
      <div
        ref={listPanelRef}
        className="relative transform-gpu"
        style={{
          transform: "translate3d(0, 0, 0)",
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
      >
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
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                {tSearch("empty")}
              </p>
            )}
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
            triggerClassName="size-11 rounded-full [&_svg]:!size-6"
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

        <motion.div
          initial={false}
          animate={
            showTabs
              ? { height: "auto", opacity: 1, y: 0, marginTop: 0 }
              : { height: 0, opacity: 0, y: -8, marginTop: -6 }
          }
          transition={SEARCH_TABS_TRANSITION}
          className="overflow-hidden"
          style={{ pointerEvents: showTabs ? "auto" : "none" }}
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
        </motion.div>
      </SidebarPageHeader>

      <SidebarPageContent className="relative min-h-0 flex-1">
        <div className="relative h-full min-w-0 overflow-hidden [contain:layout_paint]">
          <div
            ref={contentBaseLayerRef}
            key={baseContentView}
            className="absolute inset-0 min-w-0 transform-gpu"
            style={{
              backfaceVisibility: "hidden",
              pointerEvents: contentTransition ? "none" : "auto",
            }}
            aria-hidden={contentTransition ? true : undefined}
          >
            {renderContentView(baseContentView)}
          </div>

          {contentTransition ? (
            <div
              ref={contentIncomingLayerRef}
              key={contentTransition.to}
              className="absolute inset-0 z-10 min-w-0 transform-gpu"
              style={{
                backfaceVisibility: "hidden",
              }}
            >
              {renderContentView(contentTransition.to)}
            </div>
          ) : null}
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
