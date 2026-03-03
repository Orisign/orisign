"use client";

import { useSidebar } from "@/hooks/use-sidebar";
import { SIDEBAR_MAX, SIDEBAR_MIN } from "@/store/sidebar/sidebar.types";
import { AnimatePresence, motion } from "motion/react";
import { FC, PropsWithChildren, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { ScrollArea } from "../ui/scroll-area";
import { EditProfileSidebar } from "./sidebar/pages/edit-profile-sidebar";
import { MainSidebar } from "./sidebar/pages/main-sidebar";
import { SettingsSidebar } from "./sidebar/pages/settings-sidebar";

const slideVariants = {
  enter: (direction: 1 | -1) => ({
    x: direction === 1 ? "100%" : "-100%",
  }),
  center: {
    x: "0%",
  },
  exit: (direction: 1 | -1) => ({
    x: direction === 1 ? "-100%" : "100%",
  }),
};

export const AppShell: FC<PropsWithChildren> = ({ children }) => {
  const t = useTranslations("appShell");
  const { sidebarWidth, setSidebarWidth, current, stack } = useSidebar();
  const draggingRef = useRef(false);
  const previousStackLengthRef = useRef(stack.length);

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
  }, []);

  const gridStyles = useMemo(
    () => ({
      gridTemplateColumns: `${sidebarWidth}px 6px 1fr`,
    }),
    [sidebarWidth],
  );

  const direction: 1 | -1 = stack.length < previousStackLengthRef.current ? -1 : 1;

  useEffect(() => {
    previousStackLengthRef.current = stack.length;
  }, [stack.length]);

  const renderPage = (() => {
    switch (current.screen) {
      case "main":
        return <MainSidebar />
      case "settings":
        return <SettingsSidebar />
      case "edit-profile":
        return <EditProfileSidebar />
      default:
        return null;
    }
  })();

  return (
    <div className="min-h-screen">
      <div className="grid h-screen" style={gridStyles}>
        <aside className="relative border-r bg-accent/60 py-4">
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
                  duration: 0.2,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className="absolute inset-0"
              >
                <ScrollArea className="h-full w-full">
                  <div>{renderPage}</div>
                </ScrollArea>
              </motion.div>
            </AnimatePresence>
          </div>
        </aside>

        <div
          className="group relative cursor-col-resize bg-transparent"
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
          <ScrollArea className="h-full w-full">
            <div className="p-6">{children}</div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
};
