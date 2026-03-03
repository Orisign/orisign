import { sidebarStore } from "@/store/sidebar/sidebar.store";

export function useSidebar() {
  const sidebarWidth = sidebarStore((state) => state.sidebarWidth);
  const navigation = sidebarStore((state) => state.navigation);
  const current = sidebarStore((state) => state.navigation.current);
  const stack = sidebarStore((state) => state.navigation.stack);
  const isOpen = sidebarStore((state) => state.navigation.isOpen);
  const setSidebarWidth = sidebarStore((state) => state.setSidebarWidth);
  const setCurrent = sidebarStore((state) => state.setCurrent);
  const push = sidebarStore((state) => state.push);
  const pop = sidebarStore((state) => state.pop);
  const reset = sidebarStore((state) => state.reset);
  const setOpen = sidebarStore((state) => state.setOpen);

  return {
    sidebarWidth,
    navigation,
    current,
    stack,
    isOpen,
    setSidebarWidth,
    setCurrent,
    push,
    pop,
    reset,
    setOpen,
  };
}
