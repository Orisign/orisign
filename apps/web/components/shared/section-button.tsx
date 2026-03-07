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
      <div className="flex items-center justify-center gap-5">
        {icon}
        <div className="flex flex-1 flex-col space-y-1">
          <p className="font-semibold">{title}</p>
        </div>
      </div>
    </Ripple>
  );
}
