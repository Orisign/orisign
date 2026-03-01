import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SidebarStore } from "./sidebar.types";

export const sidebarStore = create(
  persist<SidebarStore>(
    (set) => ({
      sidebarWidth: 320,
      setSidebarWidth: (val: number) => set({ sidebarWidth: val }),
    }),
    {
      name: "sidebar",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
