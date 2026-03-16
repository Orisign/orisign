"use client";

import { useSidebar } from "@/hooks/use-sidebar";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";
import { SIDEBAR_MAX, SIDEBAR_MIN } from "@/store/sidebar/sidebar.types";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { FC, PropsWithChildren, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { ScrollArea } from "../ui/scroll-area";
import { CreateConversationDetailsSidebar } from "./sidebar/pages/create-conversation-details-sidebar";
import { CreateConversationMembersSidebar } from "./sidebar/pages/create-conversation-members-sidebar";
import { EditProfileSidebar } from "./sidebar/pages/edit-profile-sidebar";
import { MainSidebar } from "./sidebar/pages/main-sidebar";
import { SettingsSidebar } from "./sidebar/pages/settings-sidebar";
import { LanguageSidebar } from "./sidebar/pages/language-sidebar";
import { GeneralSettingsSidebar } from "./sidebar/pages/general-settings-sidebar";
import { PowerSavingSidebar } from "./sidebar/pages/power-saving-sidebar";
import { ChatFoldersSidebar } from "./sidebar/pages/chat-folders-sidebar";
import { ChatFolderEditorSidebar } from "./sidebar/pages/chat-folder-editor-sidebar";
import { ChatFolderChatsSidebar } from "./sidebar/pages/chat-folder-chats-sidebar";
import { ChatFolderShareSidebar } from "./sidebar/pages/chat-folder-share-sidebar";
import { ChatSearchSidebar } from "./sidebar/pages/chat-search-sidebar";

type SidebarPanelMotionCustom = {
  direction: 1 | -1;
  animationsEnabled: boolean;
};

const SIDEBAR_PANEL_VARIANTS = {
  initial: (custom: SidebarPanelMotionCustom) => {
    if (!custom.animationsEnabled) {
      return {
        x: 0,
      };
    }

    return {
      x: custom.direction === 1 ? 72 : -72,
    };
  },
  animate: (custom: SidebarPanelMotionCustom) => {
    if (!custom.animationsEnabled) {
      return {
        x: 0,
        transition: { duration: 0 },
      };
    }

    return {
      x: 0,
      transition: {
        duration: 0.22,
      },
    };
  },
  exit: (custom: SidebarPanelMotionCustom) => {
    if (!custom.animationsEnabled) {
      return {
        x: 0,
        transition: { duration: 0 },
      };
    }

    return {
      x: custom.direction === 1 ? -72 : 72,
      transition: {
        duration: 0.22,
      },
    };
  },
} as const;

export const AppShell: FC<PropsWithChildren> = ({ children }) => {
  const t = useTranslations("appShell");
  const pathname = usePathname();
  const { sidebarWidth, setSidebarWidth, current, navigation } = useSidebar();
  const sidebarAnimationsEnabled = useGeneralSettingsStore(
    (state) =>
      state.animationsEnabled &&
      state.interfaceAnimationsEnabled &&
      !state.powerSavingEnabled,
  );
  const draggingRef = useRef(false);
  const isConversationPage = pathname !== "/";

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;

      setSidebarWidth(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, e.clientX)));
    };

    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setSidebarWidth]);

  const clampedSidebarWidth = Math.max(
    SIDEBAR_MIN,
    Math.min(SIDEBAR_MAX, sidebarWidth),
  );

  useEffect(() => {
    if (sidebarWidth !== clampedSidebarWidth) {
      setSidebarWidth(clampedSidebarWidth);
    }
  }, [clampedSidebarWidth, setSidebarWidth, sidebarWidth]);

  const gridStyles = useMemo(
    () => ({
      gridTemplateColumns: `${clampedSidebarWidth}px 0px 1fr`,
    }),
    [clampedSidebarWidth],
  );

  const direction: 1 | -1 = navigation.lastAction === "pop" ? -1 : 1;
  const sidebarRouteKey = useMemo(() => JSON.stringify(current), [current]);
  const panelMotionCustom: SidebarPanelMotionCustom = {
    direction,
    animationsEnabled: sidebarAnimationsEnabled,
  };

  const renderPage = (() => {
    switch (current.screen) {
      case "main":
        return <MainSidebar />;
      case "create-conversation-members":
        return <CreateConversationMembersSidebar route={current} />;
      case "create-conversation-details":
        return <CreateConversationDetailsSidebar route={current} />;
      case "settings":
        return <SettingsSidebar />;
      case "edit-profile":
        return <EditProfileSidebar />;
      case "language":
        return <LanguageSidebar />;
      case "general-settings":
        return <GeneralSettingsSidebar />;
      case "power-saving":
        return <PowerSavingSidebar />;
      case "chat-folders":
        return <ChatFoldersSidebar />;
      case "chat-folder-edit":
        return <ChatFolderEditorSidebar route={current} />;
      case "chat-folder-chats":
        return <ChatFolderChatsSidebar route={current} />;
      case "chat-folder-share":
        return <ChatFolderShareSidebar route={current} />;
      case "chat-search":
        return <ChatSearchSidebar />;
      default:
        return null;
    }
  })();

  return (
    <div className="min-h-screen bg-background">
      <div className="grid h-screen" style={gridStyles}>
        <aside className="relative min-w-0 border-r bg-background pb-4">
          <div className="relative h-full min-w-0 overflow-hidden">
            <AnimatePresence initial={false} mode="sync" custom={panelMotionCustom}>
              <motion.div
                key={sidebarRouteKey}
                custom={panelMotionCustom}
                variants={SIDEBAR_PANEL_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                className="absolute inset-0 min-w-0 bg-background transform-gpu"
                style={{
                  willChange: "transform",
                  backfaceVisibility: "hidden",
                }}
              >
                <ScrollArea className="h-full w-full">
                  <div className="h-full min-w-0">{renderPage}</div>
                </ScrollArea>
              </motion.div>
            </AnimatePresence>
          </div>
        </aside>

        <div
          className="group relative -left-[3px] z-30 h-full w-[6px] cursor-col-resize bg-transparent"
          onMouseDown={() => {
            draggingRef.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          role="separator"
          aria-orientation="vertical"
          aria-label={t("resizeSidebarAriaLabel")}
        ></div>

        <main className="overflow-hidden bg-background">
          {isConversationPage ? (
            <div className="h-full min-h-0">{children}</div>
          ) : (
            <ScrollArea className="h-full w-full">
              <div className="h-full p-6">{children}</div>
            </ScrollArea>
          )}
        </main>
      </div>
    </div>
  );
};
