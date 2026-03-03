import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SidebarRoute } from "./sidebar-state.types";
import { SidebarStore } from "./sidebar.types";

const DEFAULT_ROUTE: SidebarRoute = { screen: "main" };

export const sidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      sidebarWidth: 320,
      navigation: {
        current: DEFAULT_ROUTE,
        stack: [],
        isOpen: true,
      },
      setSidebarWidth: (val: number) => set({ sidebarWidth: val }),
      setCurrent: (route: SidebarRoute) =>
        set((state) => ({
          navigation: {
            ...state.navigation,
            current: route,
          },
        })),
      push: (route: SidebarRoute) =>
        set((state) => ({
          navigation: {
            ...state.navigation,
            stack: [...state.navigation.stack, state.navigation.current],
            current: route,
          },
        })),
      pop: () =>
        set((state) => {
          if (state.navigation.stack.length === 0) {
            return state;
          }

          const nextStack = [...state.navigation.stack];
          const previousRoute = nextStack.pop() ?? DEFAULT_ROUTE;

          return {
            navigation: {
              ...state.navigation,
              stack: nextStack,
              current: previousRoute,
            },
          };
        }),
      reset: (route: SidebarRoute = DEFAULT_ROUTE) =>
        set((state) => ({
          navigation: {
            ...state.navigation,
            current: route,
            stack: [],
          },
        })),
      setOpen: (isOpen: boolean) =>
        set((state) => ({
          navigation: {
            ...state.navigation,
            isOpen,
          },
        })),
    }),
    {
      name: "sidebar",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        navigation: state.navigation,
      }),
    },
  ),
);
