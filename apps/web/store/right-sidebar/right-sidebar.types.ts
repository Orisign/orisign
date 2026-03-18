export const RIGHT_SIDEBAR_MIN_WIDTH = 340;
export const RIGHT_SIDEBAR_MAX_WIDTH = 620;
export const RIGHT_SIDEBAR_DEFAULT_WIDTH = 420;

export const RIGHT_SIDEBAR_TAB = {
  MEDIA: "media",
  FILES: "files",
  LINKS: "links",
  VOICE: "voice",
  MEMBERS: "members",
} as const;

export type RightSidebarTab =
  (typeof RIGHT_SIDEBAR_TAB)[keyof typeof RIGHT_SIDEBAR_TAB];

export interface RightSidebarStoreState {
  isOpen: boolean;
  width: number;
  conversationId: string | null;
  activeTab: RightSidebarTab;
  setWidth: (value: number) => void;
  setActiveTab: (tab: RightSidebarTab) => void;
  open: (conversationId: string, tab?: RightSidebarTab) => void;
  close: () => void;
  toggle: (conversationId: string, tab?: RightSidebarTab) => void;
  setConversation: (conversationId: string | null) => void;
}
