"use client";

import { useSidebar } from "@/hooks/use-sidebar";
import { SIDEBAR_MAX, SIDEBAR_MIN } from "@/store/sidebar/sidebar.types";
import { FC, PropsWithChildren, useEffect, useMemo, useRef } from "react";
import { UserDropdown } from "../user/user-dropdown";
import { Input } from "@repo/ui";
import { Search } from "lucide-react";
import { CreateConversationDropdown } from "../user/create-conversation-dropdown";
import { useTranslations } from "next-intl";

export const AppShell: FC<PropsWithChildren> = ({ children }) => {
  const t = useTranslations("appShell");
  const { sidebarWidth, setSidebarWidth } = useSidebar();
  const draggingRef = useRef(false);

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

  return (
    <div className="min-h-screen">
      <div className="grid h-screen" style={gridStyles}>
        <aside className="relative border-r bg-background px-5 py-4">
          <div className="flex w-full items-center justify-between gap-3">
            <UserDropdown />
            <Input
              leftSlot={<Search className="size-5" />}
              placeholder={t("searchPlaceholder")}
            />
          </div>

          <CreateConversationDropdown />
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

        <main className="overflow-auto">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
};
