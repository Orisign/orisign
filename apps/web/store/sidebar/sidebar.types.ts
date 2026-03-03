import {
  SidebarNavigationState,
  SidebarRoute,
} from "./sidebar-state.types";

export const SIDEBAR_MIN = 220;
export const SIDEBAR_MAX = 520;

export interface SidebarStore {
  sidebarWidth: number;
  navigation: SidebarNavigationState;
  setSidebarWidth: (val: number) => void;
  setCurrent: (route: SidebarRoute) => void;
  push: (route: SidebarRoute) => void;
  pop: () => void;
  reset: (route?: SidebarRoute) => void;
  setOpen: (isOpen: boolean) => void;
}
