import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  RIGHT_SIDEBAR_DEFAULT_WIDTH,
  RIGHT_SIDEBAR_MAX_WIDTH,
  RIGHT_SIDEBAR_MIN_WIDTH,
  RIGHT_SIDEBAR_TAB,
  type RightSidebarStoreState,
  type RightSidebarTab,
} from "./right-sidebar.types";

function clampRightSidebarWidth(value: number) {
  return Math.max(RIGHT_SIDEBAR_MIN_WIDTH, Math.min(RIGHT_SIDEBAR_MAX_WIDTH, value));
}

function resolveTab(tab?: RightSidebarTab) {
  return tab ?? RIGHT_SIDEBAR_TAB.MEDIA;
}

export const rightSidebarStore = create<RightSidebarStoreState>()(
  persist(
    (set) => ({
      isOpen: false,
      width: RIGHT_SIDEBAR_DEFAULT_WIDTH,
      conversationId: null,
      activeTab: RIGHT_SIDEBAR_TAB.MEDIA,
      setWidth: (value) =>
        set(() => ({
          width: clampRightSidebarWidth(value),
        })),
      setActiveTab: (tab) =>
        set(() => ({
          activeTab: tab,
        })),
      open: (conversationId, tab) =>
        set(() => ({
          isOpen: true,
          conversationId,
          activeTab: resolveTab(tab),
        })),
      close: () =>
        set(() => ({
          isOpen: false,
        })),
      toggle: (conversationId, tab) =>
        set((state) => {
          const shouldClose = state.isOpen && state.conversationId === conversationId;
          if (shouldClose) {
            return {
              isOpen: false,
            };
          }

          return {
            isOpen: true,
            conversationId,
            activeTab: resolveTab(tab),
          };
        }),
      setConversation: (conversationId) =>
        set((state) => {
          if (!conversationId) {
            return {
              conversationId: null,
              isOpen: false,
            };
          }

          if (state.conversationId === conversationId) {
            return state;
          }

          return {
            conversationId,
            isOpen: false,
            activeTab: RIGHT_SIDEBAR_TAB.MEDIA,
          };
        }),
    }),
    {
      name: "right-sidebar",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        width: state.width,
      }),
    },
  ),
);
