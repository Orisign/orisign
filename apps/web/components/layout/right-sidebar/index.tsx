"use client";

import { LayoutGroup } from "motion/react";
import { RightSidebarHeader } from "./header";
import { RightSidebarLoadingState } from "./loading-state";
import { RightSidebarMediaPreview } from "./media-preview";
import { RightSidebarScreenViewport } from "./screen-viewport";
import type { RightSidebarProps } from "./types";
import { useRightSidebarController } from "./use-right-sidebar-controller";

export function RightSidebar({ conversationId }: RightSidebarProps) {
  const controller = useRightSidebarController(conversationId);

  if (controller.isLoading) {
    return <RightSidebarLoadingState />;
  }

  return (
    <LayoutGroup id={controller.layoutGroupId}>
      <div className="flex h-full min-h-0 flex-col bg-sidebar">
        <RightSidebarHeader {...controller.headerProps} />

        <div className="grid min-h-0 flex-1 overflow-hidden">
          <div className="col-start-1 row-start-1 min-h-0">
            <RightSidebarScreenViewport {...controller.viewportProps} />
          </div>
        </div>
      </div>

      <RightSidebarMediaPreview {...controller.mediaPreviewProps} />
    </LayoutGroup>
  );
}
