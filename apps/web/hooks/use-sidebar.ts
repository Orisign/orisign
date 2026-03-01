import { sidebarStore } from "@/store/sidebar/sidebar.store";

export function useSidebar() {
  const sidebarWidth = sidebarStore((state) => state.sidebarWidth);
  const setSidebarWidth = sidebarStore((state) => state.setSidebarWidth);

  return {
    sidebarWidth,
    setSidebarWidth,
  };
}
