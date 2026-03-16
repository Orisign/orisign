"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type SendShortcutMode = "enter" | "ctrl-enter";
export type TimeFormatMode = "12h" | "24h";

interface GeneralSettingsState {
  messageTextSize: number;
  animationsEnabled: boolean;
  selectedWallpaper: string;
  themeMode: ThemeMode;
  sendShortcut: SendShortcutMode;
  timeFormat: TimeFormatMode;
  powerSavingEnabled: boolean;
  autoplayVideo: boolean;
  autoplayGif: boolean;
  animatedStickersLevel: number;
  interactiveEffectsLevel: number;
  chatAnimationsLevel: number;
  interfaceAnimationsEnabled: boolean;
  setMessageTextSize: (value: number) => void;
  setAnimationsEnabled: (value: boolean) => void;
  setSelectedWallpaper: (value: string) => void;
  setThemeMode: (value: ThemeMode) => void;
  setSendShortcut: (value: SendShortcutMode) => void;
  setTimeFormat: (value: TimeFormatMode) => void;
  setPowerSavingEnabled: (value: boolean) => void;
  setAutoplayVideo: (value: boolean) => void;
  setAutoplayGif: (value: boolean) => void;
  setAnimatedStickersLevel: (value: number) => void;
  setInteractiveEffectsLevel: (value: number) => void;
  setChatAnimationsLevel: (value: number) => void;
  setInterfaceAnimationsEnabled: (value: boolean) => void;
}

export const useGeneralSettingsStore = create<GeneralSettingsState>()(
  persist(
    (set) => ({
      messageTextSize: 16,
      animationsEnabled: true,
      selectedWallpaper: "default",
      themeMode: "system",
      sendShortcut: "enter",
      timeFormat: "24h",
      powerSavingEnabled: false,
      autoplayVideo: true,
      autoplayGif: true,
      animatedStickersLevel: 3,
      interactiveEffectsLevel: 7,
      chatAnimationsLevel: 3,
      interfaceAnimationsEnabled: true,
      setMessageTextSize: (value) => set({ messageTextSize: value }),
      setAnimationsEnabled: (value) =>
        set((state) =>
          value
            ? {
                ...state,
                animationsEnabled: true,
                powerSavingEnabled: false,
                interfaceAnimationsEnabled: true,
              }
            : { animationsEnabled: false },
        ),
      setSelectedWallpaper: (value) => set({ selectedWallpaper: value }),
      setThemeMode: (value) => set({ themeMode: value }),
      setSendShortcut: (value) => set({ sendShortcut: value }),
      setTimeFormat: (value) => set({ timeFormat: value }),
      setPowerSavingEnabled: (value) =>
        set((state) =>
          value
            ? {
                ...state,
                powerSavingEnabled: true,
                animationsEnabled: false,
                autoplayVideo: false,
                autoplayGif: false,
                animatedStickersLevel: 0,
                interactiveEffectsLevel: 0,
                chatAnimationsLevel: 0,
                interfaceAnimationsEnabled: false,
              }
            : { powerSavingEnabled: false },
        ),
      setAutoplayVideo: (value) => set({ autoplayVideo: value }),
      setAutoplayGif: (value) => set({ autoplayGif: value }),
      setAnimatedStickersLevel: (value) => set({ animatedStickersLevel: value }),
      setInteractiveEffectsLevel: (value) => set({ interactiveEffectsLevel: value }),
      setChatAnimationsLevel: (value) => set({ chatAnimationsLevel: value }),
      setInterfaceAnimationsEnabled: (value) =>
        set({ interfaceAnimationsEnabled: value }),
    }),
    {
      name: "general-settings",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState as GeneralSettingsState;
        }

        if (version >= 2) {
          return persistedState as GeneralSettingsState;
        }

        const state = persistedState as Partial<GeneralSettingsState>;
        const countToMask = (value: unknown, maxCount: number) => {
          const count = Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0;
          const clamped = Math.min(maxCount, count);
          return clamped <= 0 ? 0 : (1 << clamped) - 1;
        };

        return {
          ...state,
          animatedStickersLevel: countToMask(state.animatedStickersLevel, 2),
          interactiveEffectsLevel: countToMask(state.interactiveEffectsLevel, 3),
          chatAnimationsLevel: countToMask(state.chatAnimationsLevel, 2),
        } as GeneralSettingsState;
      },
    },
  ),
);
