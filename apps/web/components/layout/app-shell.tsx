"use client";

import { useSidebar } from "@/hooks/use-sidebar";
import { SIDEBAR_MAX, SIDEBAR_MIN } from "@/store/sidebar/sidebar.types";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { FC, PropsWithChildren, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { ScrollArea } from "../ui/scroll-area";
import { EditProfileSidebar } from "./sidebar/pages/edit-profile-sidebar";
import { MainSidebar } from "./sidebar/pages/main-sidebar";
import { SettingsSidebar } from "./sidebar/pages/settings-sidebar";
import { LanguageSidebar } from "./sidebar/pages/language-sidebar";

const slideVariants = {
  enter: (direction: 1 | -1) => ({
    x: direction === 1 ? "100%" : "-100%",
    zIndex: 20,
  }),
  center: {
    x: "0%",
    zIndex: 20,
  },
  exit: {
    x: "0%",
    zIndex: 10,
  },
};

export const AppShell: FC<PropsWithChildren> = ({ children }) => {
  const t = useTranslations("appShell");
  const pathname = usePathname();
  const { sidebarWidth, setSidebarWidth, current, navigation } = useSidebar();
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

  const gridStyles = useMemo(
    () => ({
      gridTemplateColumns: `${sidebarWidth}px 0px 1fr`,
    }),
    [sidebarWidth],
  );

  const direction: 1 | -1 = navigation.lastAction === "pop" ? -1 : 1;

  const renderPage = (() => {
    switch (current.screen) {
      case "main":
        return <MainSidebar />;
      case "settings":
        return <SettingsSidebar />;
      case "edit-profile":
        return <EditProfileSidebar />;
      case "language":
        return <LanguageSidebar />;
      default:
        return null;
    }
  })();

  return (
    <div className="min-h-screen">
      <div className="grid h-screen" style={gridStyles}>
        <aside className="relative border-r bg-accent/60 pb-4">
          <div className="relative h-full overflow-hidden">
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={current.screen}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  duration: 0.34,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
                className="absolute inset-0"
              >
                <ScrollArea className="h-full w-full">
                  <div className="h-full">{renderPage}</div>
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

        <main className="overflow-hidden">
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
