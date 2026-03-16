"use client";

import { useConversationsControllerMy } from "@/api/generated";
import { ChatItem } from "@/components/chat/chat-item";
import { CreateConversationDropdown } from "@/components/user/create-conversation-dropdown";
import { UserDropdown } from "@/components/user/user-dropdown";
import { useChatFolders } from "@/hooks/use-chat-folders";
import { SPRING_MICRO } from "@/lib/animations";
import { getConversationTitle } from "@/lib/chat";
import { CHAT_FOLDER_ALL_TAB_ID, normalizeChatFolderName } from "@/lib/chat-folders";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
} from "@/components/ui/sidebar-page";
import { Button, Input, Skeleton, SkeletonGroup, Tabs, TabsList, TabsTrigger } from "@repo/ui";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { ChatList } from "@/components/chat/chat-list";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiMenu } from "react-icons/fi";

export const MainSidebar = () => {
  const t = useTranslations("appShell");
  const tSearch = useTranslations("chatSearchSidebar");
  const { data: foldersData } = useChatFolders();
  const { data: searchData, isLoading: isSearchLoading } = useConversationsControllerMy();
  const [activeFolderId, setActiveFolderId] = useState(CHAT_FOLDER_ALL_TAB_ID);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [closedIconInitialRotation, setClosedIconInitialRotation] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listSlideFrameRef = useRef<number | null>(null);
  const hasAnimatedTabsRef = useRef(false);
  const listPanelRef = useRef<HTMLDivElement | null>(null);
  const previousTabIndexRef = useRef(0);
  const tabDirectionRef = useRef<1 | -1>(1);

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
      return;
    }

    const fromX = tabDirectionRef.current === 1 ? 72 : -72;
    panel.style.transition = "none";
    panel.style.transform = `translate3d(${fromX}px, 0, 0)`;
    // Flush transform before enabling transition.
    void panel.offsetHeight;

    if (listSlideFrameRef.current !== null) {
      cancelAnimationFrame(listSlideFrameRef.current);
    }

    listSlideFrameRef.current = requestAnimationFrame(() => {
      panel.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
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

  const handleOpenSearch = useCallback(() => {
    if (isSearchOpen) {
      return;
    }

    setClosedIconInitialRotation(0);
    setSearchQuery("");
    setIsSearchOpen(true);
  }, [isSearchOpen]);

  const closeSearchOverlay = useCallback(() => {
    if (!isSearchOpen) return;

    setClosedIconInitialRotation(90);
    setIsSearchOpen(false);
    setSearchQuery("");
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeSearchOverlay();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSearchOpen, closeSearchOverlay]);

  useEffect(() => {
    if (!isSearchOpen) return;

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isSearchOpen]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedSearchQuery) {
      return [];
    }

    return (searchData?.conversations ?? []).filter((conversation) =>
      getConversationTitle(conversation).toLowerCase().includes(normalizedSearchQuery),
    );
  }, [normalizedSearchQuery, searchData?.conversations]);

  const menuTriggerIcon = (
    <motion.span
      initial={{ rotate: isSearchOpen ? 0 : closedIconInitialRotation }}
      animate={{ rotate: isSearchOpen ? 90 : 0 }}
      onAnimationComplete={() => {
        if (!isSearchOpen && closedIconInitialRotation !== 0) {
          setClosedIconInitialRotation(0);
        }
      }}
      transition={{
        ...SPRING_MICRO,
        stiffness: 620,
        damping: 32,
        mass: 0.4,
      }}
      className="inline-flex items-center justify-center"
    >
      <span
        className="inline-flex items-center justify-center"
        style={{ transform: `rotate(${isSearchOpen ? -90 : 0}deg)` }}
      >
        {isSearchOpen ? <FiArrowLeft /> : <FiMenu />}
      </span>
    </motion.span>
  );

  return (
    <SidebarPage className="h-full">
      <SidebarPageHeader className="flex-col items-stretch gap-3 pb-3">
        <div className="flex items-center gap-3">
          {isSearchOpen ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-11 rounded-full [&_svg]:!size-6"
              onClick={closeSearchOverlay}
              aria-label={tSearch("backAriaLabel")}
            >
              {menuTriggerIcon}
            </Button>
          ) : (
            <UserDropdown
              triggerIcon={menuTriggerIcon}
              triggerClassName="size-11 rounded-full [&_svg]:!size-6"
            />
          )}
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

        {!isSearchOpen ? (
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
        ) : null}
      </SidebarPageHeader>

      <SidebarPageContent>
        <div
          ref={listPanelRef}
          className="relative transform-gpu"
          style={{
            transform: "translate3d(0, 0, 0)",
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        >
          {isSearchOpen ? (
            <>
              {isSearchLoading ? (
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

              {!isSearchLoading && !normalizedSearchQuery ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  {tSearch("startTyping")}
                </p>
              ) : null}

              {!isSearchLoading &&
              normalizedSearchQuery &&
              searchResults.length === 0 ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  {tSearch("empty")}
                </p>
              ) : null}

              {!isSearchLoading && searchResults.length > 0 ? (
                <div className="flex w-full flex-col gap-1">
                  {searchResults.map((conversation) => (
                    <div key={conversation.id} onClick={closeSearchOverlay}>
                      <ChatItem conversation={conversation} />
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <ChatList activeFolder={activeFolder} />
          )}
        </div>
      </SidebarPageContent>

      {!isSearchOpen ? <CreateConversationDropdown /> : null}
    </SidebarPage>
  );
};
