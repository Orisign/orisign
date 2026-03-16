"use client";

import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";
import { useEffect } from "react";

const COLOR_THEME_ALIASES: Record<string, string> = {
  house: "default",
  duck: "forest",
  snowman: "frost",
  diamond: "ocean",
  artist: "sunset",
};

function normalizeColorTheme(value: string) {
  return COLOR_THEME_ALIASES[value] ?? value;
}

function clampMessageTextSize(value: number) {
  if (!Number.isFinite(value)) return 16;
  return Math.min(30, Math.max(12, Math.round(value)));
}

export function useGeneralSettingsSync() {
  const messageTextSize = useGeneralSettingsStore((state) => state.messageTextSize);
  const selectedWallpaper = useGeneralSettingsStore((state) => state.selectedWallpaper);
  const animationsEnabled = useGeneralSettingsStore((state) => state.animationsEnabled);
  const interfaceAnimationsEnabled = useGeneralSettingsStore(
    (state) => state.interfaceAnimationsEnabled,
  );
  const powerSavingEnabled = useGeneralSettingsStore((state) => state.powerSavingEnabled);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--chat-message-font-size",
      `${clampMessageTextSize(messageTextSize)}px`,
    );
  }, [messageTextSize]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-accent-theme", normalizeColorTheme(selectedWallpaper));
  }, [selectedWallpaper]);

  useEffect(() => {
    const root = document.documentElement;
    const uiAnimationsEnabled =
      animationsEnabled && interfaceAnimationsEnabled && !powerSavingEnabled;

    root.setAttribute("data-ui-animations", uiAnimationsEnabled ? "on" : "off");
  }, [animationsEnabled, interfaceAnimationsEnabled, powerSavingEnabled]);
}

