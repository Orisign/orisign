"use client";

import { useSidebar } from "@/hooks/use-sidebar";
import { SidebarRoute } from "@/store/sidebar/sidebar-state.types";
import { SECTION_BUTTON_CLASSNAME } from "./shared.constants";
import { Ripple } from "@repo/ui";
import { ReactNode } from "react";

interface SectionButtonProps {
  icon: ReactNode;
  route: SidebarRoute;
  title: string;
}

export function SectionButton({ icon, title, route }: SectionButtonProps) {
  const { push } = useSidebar();

  return (
    <Ripple
      onClick={() => push(route)}
      className={SECTION_BUTTON_CLASSNAME}
    >
      <div className="flex min-w-0 items-start justify-center gap-5">
        <span className="shrink-0">{icon}</span>
        <div className="flex min-w-0 flex-1 flex-col space-y-1">
          <p className="break-words [overflow-wrap:anywhere] font-semibold leading-snug">
            {title}
          </p>
        </div>
      </div>
    </Ripple>
  );
}
