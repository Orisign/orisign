"use client";

import { sidebarStore } from "@/store/sidebar/sidebar.store";
import { rightSidebarStore } from "@/store/right-sidebar/right-sidebar.store";
import { decodeConversationLocator } from "@/lib/chat-routes";
import { cn } from "@/lib/utils";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";
import {
  RIGHT_SIDEBAR_DEFAULT_WIDTH,
  RIGHT_SIDEBAR_MAX_WIDTH,
  RIGHT_SIDEBAR_MIN_WIDTH,
} from "@/store/right-sidebar/right-sidebar.types";
import type { SidebarRoute } from "@/store/sidebar/sidebar-state.types";
import { SIDEBAR_MAX, SIDEBAR_MIN } from "@/store/sidebar/sidebar.types";
import { usePathname } from "next/navigation";
import {
  FC,
  PropsWithChildren,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { SessionsSidebar } from "./sidebar/pages/sessions-sidebar";
import { RightSidebar } from "./right-sidebar";

function buildSidebarRouteTransitionKey(route: SidebarRoute) {
  switch (route.screen) {
    case "create-conversation-members":
      return `${route.screen}:${route.type}`;
    case "create-conversation-details":
      return `${route.screen}:${route.type}`;
    case "edit-profile":
      return `${route.screen}:${route.userId}`;
    case "chat-folder-edit":
      return `${route.screen}:${route.folderId ?? "new"}`;
    case "chat-folder-chats":
      return `${route.screen}:${route.folderId}:${route.mode}`;
    case "chat-folder-share":
      return `${route.screen}:${route.folderId}`;
    default:
      return route.screen;
  }
}

function resolveConversationIdFromPathname(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  if (segments[0] === "c") {
    return decodeConversationLocator(segments[1] ?? null) || null;
  }

  return decodeConversationLocator(segments[0] ?? null) || null;
}

function renderSidebarPage(route: SidebarRoute) {
  switch (route.screen) {
    case "main":
      return <MainSidebar />;
    case "create-conversation-members":
      return <CreateConversationMembersSidebar route={route} />;
    case "create-conversation-details":
      return <CreateConversationDetailsSidebar route={route} />;
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
      return <ChatFolderEditorSidebar route={route} />;
    case "chat-folder-chats":
      return <ChatFolderChatsSidebar route={route} />;
    case "chat-folder-share":
      return <ChatFolderShareSidebar route={route} />;
    case "chat-search":
      return <ChatSearchSidebar />;
    case "sessions":
      return <SessionsSidebar />;
    default:
      return null;
  }
}

interface SidebarViewportProps {
  current: SidebarRoute;
  transitionKey: string;
  direction: 1 | -1;
  shouldSlide: boolean;
}

interface SidebarScene {
  id: number;
  key: string;
  route: SidebarRoute;
}

interface SidebarSceneTransition {
  id: string;
  from: SidebarScene;
  to: SidebarScene;
  direction: 1 | -1;
}

const SIDEBAR_NAV_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const SIDEBAR_NAV_FORWARD_DURATION_MS = 300;
const SIDEBAR_NAV_BACK_DURATION_MS = 250;
const SIDEBAR_NAV_PARALLAX = 0.25;

function resetSidebarLayerStyles(layer: HTMLDivElement) {
  layer.style.transition = "";
  layer.style.transform = "translate3d(0, 0, 0)";
  layer.style.filter = "";
  layer.style.willChange = "";
}

const SidebarViewport = memo(function SidebarViewport({
  current,
  transitionKey,
  direction,
  shouldSlide,
}: SidebarViewportProps) {
  const hasMountedRef = useRef(false);
  const sceneCounterRef = useRef(0);
  const baseLayerRef = useRef<HTMLDivElement | null>(null);
  const incomingLayerRef = useRef<HTMLDivElement | null>(null);
  const [displayedScene, setDisplayedScene] = useState<SidebarScene>(() => ({
    id: 0,
    key: transitionKey,
    route: current,
  }));
  const [transition, setTransition] = useState<SidebarSceneTransition | null>(
    null,
  );

  const displayedSceneRef = useRef(displayedScene);
  const transitionRef = useRef(transition);
  const scheduleStateUpdate = (updater: () => void) => {
    queueMicrotask(updater);
  };

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  useLayoutEffect(() => {
    displayedSceneRef.current = displayedScene;
    transitionRef.current = transition;
  }, [displayedScene, transition]);

  useLayoutEffect(() => {
    const activeScene = displayedSceneRef.current;
    const activeTransition = transitionRef.current;

    if (activeScene.key === transitionKey) {
      if (activeScene.route !== current) {
        scheduleStateUpdate(() => {
          setDisplayedScene((prevScene) =>
            prevScene.key === transitionKey
              ? { ...prevScene, route: current }
              : prevScene,
          );
        });
      }
      return;
    }

    if (
      activeTransition &&
      activeTransition.to.key === transitionKey &&
      activeTransition.to.route !== current
    ) {
      scheduleStateUpdate(() => {
        setTransition((prevTransition) => {
          if (!prevTransition || prevTransition.to.key !== transitionKey) {
            return prevTransition;
          }

          return {
            ...prevTransition,
            to: {
              ...prevTransition.to,
              route: current,
            },
          };
        });
      });
      return;
    }

    const nextScene: SidebarScene = {
      id: sceneCounterRef.current + 1,
      key: transitionKey,
      route: current,
    };
    sceneCounterRef.current = nextScene.id;

    if (!shouldSlide || !hasMountedRef.current) {
      scheduleStateUpdate(() => {
        setTransition(null);
        setDisplayedScene(nextScene);
      });
      return;
    }

    scheduleStateUpdate(() => {
      setTransition({
        id: `${activeScene.id}:${nextScene.id}:${direction}`,
        from: activeScene,
        to: nextScene,
        direction,
      });
    });
  }, [current, direction, shouldSlide, transitionKey]);

  useLayoutEffect(() => {
    if (!transition) {
      return;
    }

    const baseLayer = baseLayerRef.current;
    const incomingLayer = incomingLayerRef.current;

    if (!baseLayer || !incomingLayer) {
      scheduleStateUpdate(() => {
        setDisplayedScene(transition.to);
        setTransition(null);
      });
      return;
    }

    const width = Math.max(baseLayer.getBoundingClientRect().width, 1);
    const isForward = transition.direction === 1;
    const duration = isForward
      ? SIDEBAR_NAV_FORWARD_DURATION_MS
      : SIDEBAR_NAV_BACK_DURATION_MS;
    const transitionValue = `transform ${duration}ms ${SIDEBAR_NAV_EASING}, filter ${duration}ms ${SIDEBAR_NAV_EASING}`;

    resetSidebarLayerStyles(baseLayer);
    resetSidebarLayerStyles(incomingLayer);

    baseLayer.style.transition = "none";
    incomingLayer.style.transition = "none";

    baseLayer.style.transform = "translate3d(0, 0, 0)";
    baseLayer.style.filter = isForward ? "brightness(0.8)" : "";

    incomingLayer.style.transform = isForward
      ? `translate3d(${width}px, 0, 0)`
      : `translate3d(${-width * SIDEBAR_NAV_PARALLAX}px, 0, 0)`;
    incomingLayer.style.filter = isForward ? "" : "brightness(0.8)";

    baseLayer.style.willChange = "transform, filter";
    incomingLayer.style.willChange = "transform, filter";
    void incomingLayer.offsetHeight;

    baseLayer.style.transition = transitionValue;
    incomingLayer.style.transition = transitionValue;

    baseLayer.style.transform = isForward
      ? `translate3d(${-width * SIDEBAR_NAV_PARALLAX}px, 0, 0)`
      : `translate3d(${width}px, 0, 0)`;
    incomingLayer.style.transform = "translate3d(0, 0, 0)";
    incomingLayer.style.filter = "";

    const finishTransition = () => {
      setTransition((prevTransition) => {
        if (!prevTransition || prevTransition.id !== transition.id) {
          return prevTransition;
        }
        setDisplayedScene(prevTransition.to);
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

    const timeoutId = window.setTimeout(finishTransition, duration + 72);
    incomingLayer.addEventListener("transitionend", onTransitionEnd);

    return () => {
      window.clearTimeout(timeoutId);
      incomingLayer.removeEventListener("transitionend", onTransitionEnd);
      resetSidebarLayerStyles(baseLayer);
      resetSidebarLayerStyles(incomingLayer);
    };
  }, [transition]);

  const baseScene = transition ? transition.from : displayedScene;
  const basePage = useMemo(() => renderSidebarPage(baseScene.route), [baseScene]);
  const incomingPage = useMemo(
    () => (transition ? renderSidebarPage(transition.to.route) : null),
    [transition],
  );

  return (
    <div className="relative h-full min-w-0 overflow-hidden [contain:layout_paint]">
      <div
        key={baseScene.key}
        ref={baseLayerRef}
        className="absolute inset-0 min-w-0 bg-sidebar transform-gpu"
        style={{
          backfaceVisibility: "hidden",
          pointerEvents: transition ? "none" : "auto",
        }}
        aria-hidden={transition ? true : undefined}
      >
        <ScrollArea className="h-full w-full">
          <div className="h-full min-w-0">{basePage}</div>
        </ScrollArea>
      </div>

      {transition ? (
        <div
          key={transition.to.key}
          ref={incomingLayerRef}
          className="absolute inset-0 z-10 min-w-0 bg-sidebar transform-gpu"
          style={{
            backfaceVisibility: "hidden",
          }}
        >
          <ScrollArea className="h-full w-full">
            <div className="h-full min-w-0">{incomingPage}</div>
          </ScrollArea>
        </div>
      ) : null}
    </div>
  );
});

export const AppShell: FC<PropsWithChildren> = ({ children }) => {
  const t = useTranslations("appShell");
  const pathname = usePathname();
  const { sidebarWidth, setSidebarWidth, navigation } = sidebarStore();
  const {
    isOpen: rightSidebarOpen,
    conversationId: rightSidebarConversationId,
    setConversation: setRightSidebarConversation,
  } = rightSidebarStore();
  const sidebarAnimationsEnabled = useGeneralSettingsStore(
    (state) =>
      state.animationsEnabled &&
      state.interfaceAnimationsEnabled &&
      !state.powerSavingEnabled,
  );
  const leftDraggingRef = useRef(false);
  const mainShellRef = useRef<HTMLDivElement | null>(null);
  const activeConversationId = useMemo(
    () => resolveConversationIdFromPathname(pathname),
    [pathname],
  );
  const isConversationPage = Boolean(activeConversationId);

  useEffect(() => {
    setRightSidebarConversation(activeConversationId);
  }, [activeConversationId, setRightSidebarConversation]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (leftDraggingRef.current) {
        setSidebarWidth(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, e.clientX)));
      }
    };

    const onUp = () => {
      leftDraggingRef.current = false;
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

  const shouldShowRightSidebar = Boolean(
    activeConversationId &&
      rightSidebarOpen &&
      rightSidebarConversationId &&
      rightSidebarConversationId === activeConversationId,
  );
  const fixedRightSidebarWidth = Math.max(
    RIGHT_SIDEBAR_MIN_WIDTH,
    Math.min(RIGHT_SIDEBAR_MAX_WIDTH, RIGHT_SIDEBAR_DEFAULT_WIDTH),
  );
  const rightPanelWidth = activeConversationId ? fixedRightSidebarWidth : 0;
  const rightColumnWidth = shouldShowRightSidebar ? rightPanelWidth : 0;
  const rightSidebarTransition = sidebarAnimationsEnabled
    ? "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)"
    : "none";
  const rightSidebarOffset = shouldShowRightSidebar ? 0 : rightPanelWidth + 16;
  const chatContentStyle = useMemo(
    () => ({
      paddingRight: `${rightColumnWidth}px`,
      transition: sidebarAnimationsEnabled
        ? "padding-right 240ms cubic-bezier(0.22, 1, 0.36, 1)"
        : "none",
    }),
    [rightColumnWidth, sidebarAnimationsEnabled],
  );

  const gridStyles = useMemo(
    () => ({
      gridTemplateColumns: `${clampedSidebarWidth}px 0px minmax(0,1fr)`,
    }),
    [clampedSidebarWidth],
  );

  const current = navigation.current;
  const lastAction = navigation.lastAction;
  const direction: 1 | -1 = lastAction === "pop" ? -1 : 1;
  const shouldSlide =
    sidebarAnimationsEnabled &&
    (lastAction === "push" || lastAction === "pop");
  const sidebarRouteKey = useMemo(
    () => buildSidebarRouteTransitionKey(current),
    [current],
  );
  return (
    <div className="min-h-screen bg-background">
      <div className="grid h-screen" style={gridStyles}>
        <aside className="relative min-w-0 border-r bg-sidebar pb-4">
          <SidebarViewport
            current={current}
            transitionKey={sidebarRouteKey}
            direction={direction}
            shouldSlide={shouldSlide}
          />
        </aside>

        <div
          className="group relative -left-[3px] z-30 h-full w-[6px] cursor-col-resize bg-transparent"
          onMouseDown={() => {
            leftDraggingRef.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          role="separator"
          aria-orientation="vertical"
          aria-label={t("resizeSidebarAriaLabel")}
        ></div>

        <main
          ref={mainShellRef}
          className="relative min-w-0 overflow-hidden bg-background"
        >
          <div
            className="h-full min-h-0"
            style={chatContentStyle}
          >
            {isConversationPage ? (
              <div className="h-full min-h-0">{children}</div>
            ) : (
              <ScrollArea className="h-full w-full">
                <div className="h-full p-6">{children}</div>
              </ScrollArea>
            )}
          </div>

          <div
            className={cn(
              "absolute inset-y-0 z-30 h-full w-[6px] bg-transparent pointer-events-none",
            )}
            style={{
              right: `${Math.max(0, rightColumnWidth - 3)}px`,
              transition: sidebarAnimationsEnabled
                ? "right 240ms cubic-bezier(0.22, 1, 0.36, 1)"
                : "none",
            }}
            role="separator"
            aria-orientation="vertical"
            aria-label={t("resizeSidebarAriaLabel")}
          ></div>

          <aside
            className={cn(
              "absolute inset-y-0 right-0 z-20 min-w-0 overflow-hidden border-l bg-sidebar",
              !shouldShowRightSidebar && "pointer-events-none",
            )}
            style={{
              width: `${rightPanelWidth}px`,
              transform: `translate3d(${rightSidebarOffset}px, 0, 0)`,
              transition: rightSidebarTransition,
            }}
            aria-hidden={!shouldShowRightSidebar}
          >
            {activeConversationId ? (
              <RightSidebar key={activeConversationId} conversationId={activeConversationId} />
            ) : null}
          </aside>
        </main>
      </div>
    </div>
  );
};
