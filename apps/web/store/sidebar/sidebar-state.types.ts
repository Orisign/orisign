export type SidebarScreen =
  | "main"
  | "select-members"
  | "settings"
  | "edit-profile"
  | "general-settings"
  | "chat-wallpaper"
  | "notifications"
  | "data-and-storage"
  | "privacy-and-security"
  | "chat-folders"
  | "sessions"
  | "language"
  | "stickers-and-emoji";

export type SidebarRoute =
  | { screen: "main" }
  | { screen: "select-members"; chatId: string }
  | { screen: "settings" }
  | { screen: "edit-profile"; userId: string }
  | { screen: "general-settings" }
  | { screen: "chat-wallpaper" }
  | { screen: "notifications" }
  | { screen: "data-and-storage" }
  | { screen: "privacy-and-security" }
  | { screen: "chat-folders" }
  | { screen: "sessions" }
  | { screen: "language" }
  | { screen: "stickers-and-emoji" };

export type SidebarNavigationAction =
  | "set-current"
  | "push"
  | "pop"
  | "reset";

export interface SidebarNavigationState {
  stack: SidebarRoute[];
  current: SidebarRoute;
  isOpen: boolean;
  lastAction?: SidebarNavigationAction;
}

export interface SidebarStateStore {
  navigation: SidebarNavigationState;
  setCurrent: (route: SidebarRoute) => void;
  push: (route: SidebarRoute) => void;
  pop: () => void;
  reset: (route?: SidebarRoute) => void;
  setOpen: (isOpen: boolean) => void;
}

export interface PersistedSidebarNavigation {
  version: 1;
  current: SidebarRoute;
  stack: SidebarRoute[];
  isOpen: boolean;
  lastAction?: SidebarNavigationAction;
}
