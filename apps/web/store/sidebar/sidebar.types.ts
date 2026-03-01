export const SIDEBAR_MIN = 220;
export const SIDEBAR_MAX = 520;

export interface SidebarStore {
  sidebarWidth: number;
  setSidebarWidth: (val: number) => void;
}
