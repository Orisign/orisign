"use client";

import { rightSidebarStore } from "@/store/right-sidebar/right-sidebar.store";

export function useRightSidebar() {
  const isOpen = rightSidebarStore((state) => state.isOpen);
  const width = rightSidebarStore((state) => state.width);
  const conversationId = rightSidebarStore((state) => state.conversationId);
  const activeTab = rightSidebarStore((state) => state.activeTab);
  const setWidth = rightSidebarStore((state) => state.setWidth);
  const setActiveTab = rightSidebarStore((state) => state.setActiveTab);
  const open = rightSidebarStore((state) => state.open);
  const close = rightSidebarStore((state) => state.close);
  const toggle = rightSidebarStore((state) => state.toggle);
  const setConversation = rightSidebarStore((state) => state.setConversation);

  return {
    isOpen,
    width,
    conversationId,
    activeTab,
    setWidth,
    setActiveTab,
    open,
    close,
    toggle,
    setConversation,
  };
}
