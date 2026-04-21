"use client";

import { SECTION_BUTTON_CLASSNAME } from "@/components/shared/shared.constants";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
  SidebarPageSeparator,
  SidebarPageTitle,
} from "@/components/ui/sidebar-page";
import { sidebarStore } from "@/store/sidebar/sidebar.store";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";
import {
  Button,
  Checkbox,
  cn,
  RadioGroup,
  RadioGroupItem,
  Ripple,
  Slider,
} from "@repo/ui";
import { ArrowLeft, ImageIcon, Leaf, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect } from "react";

const THEME_PRESETS = [
  { id: "default", emoji: "🏡", accent: "bg-violet-400" },
  { id: "forest", emoji: "🌿", accent: "bg-emerald-400" },
  { id: "frost", emoji: "❄️", accent: "bg-sky-400" },
  { id: "ocean", emoji: "🌊", accent: "bg-cyan-400" },
  { id: "sunset", emoji: "🌇", accent: "bg-orange-400" },
] as const;

const LEGACY_THEME_PRESET_ALIASES: Record<string, string> = {
  house: "default",
  duck: "forest",
  snowman: "frost",
  diamond: "ocean",
  artist: "sunset",
};

export const GeneralSettingsSidebar = () => {
  const t = useTranslations("generalSettingsSidebar");
  const { pop, push } = sidebarStore();
  const { setTheme } = useTheme();
  const {
    messageTextSize,
    animationsEnabled,
    interfaceAnimationsEnabled,
    selectedWallpaper,
    themeMode,
    sendShortcut,
    timeFormat,
    powerSavingEnabled,
    setMessageTextSize,
    setAnimationsEnabled,
    setSelectedWallpaper,
    setThemeMode,
    setSendShortcut,
    setTimeFormat,
  } = useGeneralSettingsStore();
  const activeThemePreset =
    LEGACY_THEME_PRESET_ALIASES[selectedWallpaper] ?? selectedWallpaper;
  const uiAnimationsEnabled =
    animationsEnabled && interfaceAnimationsEnabled && !powerSavingEnabled;

  useEffect(() => {
    setTheme(themeMode);
  }, [setTheme, themeMode]);

  return (
    <SidebarPage>
      <SidebarPageHeader className="justify-start gap-3">
        <Button onClick={pop} variant="ghost" size="icon" className="rounded-full">
          <ArrowLeft strokeWidth={3} className="size-6" />
        </Button>
        <SidebarPageTitle>{t("title")}</SidebarPageTitle>
      </SidebarPageHeader>

      <SidebarPageContent className="gap-2.5">
        <p className="px-1 text-lg font-semibold text-primary">{t("settingsLabel")}</p>

        <div className="min-w-0 space-y-2 px-1">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="min-w-0 break-words font-semibold leading-snug">
              {t("messageTextSize")}
            </span>
            <span className="shrink-0 text-sm text-muted-foreground">{messageTextSize}</span>
          </div>
          <Slider
            value={[messageTextSize]}
            min={12}
            max={30}
            step={1}
            onValueChange={(values) => setMessageTextSize(values[0] ?? 16)}
          />
        </div>

        <Ripple className={SECTION_BUTTON_CLASSNAME}>
          <div className="flex min-w-0 items-center gap-4">
            <ImageIcon className="size-5 text-muted-foreground" />
            <span className="min-w-0 break-words font-semibold">{t("chatWallpapers")}</span>
          </div>
        </Ripple>

        <Ripple
          className={cn(
            SECTION_BUTTON_CLASSNAME,
            "flex items-center justify-between",
          )}
          onClick={() => setAnimationsEnabled(!uiAnimationsEnabled)}
        >
          <div className="flex min-w-0 items-center gap-4">
            <Checkbox checked={uiAnimationsEnabled} />
            <span className="min-w-0 break-words font-semibold">{t("animations")}</span>
          </div>
        </Ripple>

        <Ripple className={cn(SECTION_BUTTON_CLASSNAME, "block")}>
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => push({ screen: "power-saving" })}
          >
            <span className="inline-flex min-w-0 items-center gap-4">
              <Leaf className="size-5 text-muted-foreground" />
              <span className="min-w-0 break-words font-semibold">{t("powerSavingMode")}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">
                {powerSavingEnabled ? t("enabled") : t("disabled")}
              </span>
              <ChevronRight className="size-4" />
            </span>
          </button>
        </Ripple>
      </SidebarPageContent>

      <SidebarPageSeparator />

      <SidebarPageContent className="gap-3">
        <p className="px-1 text-lg font-semibold text-primary">{t("colorTheme")}</p>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2 pb-1">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setSelectedWallpaper(preset.id)}
              className={cn(
                "relative h-28 w-full overflow-hidden rounded-2xl border transition-all",
                activeThemePreset === preset.id
                  ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary))]"
                  : "border-border/60",
              )}
            >
              <div className="absolute inset-0 bg-[url('/assets/chat/chicken-wallpaper.png')] bg-[length:220px_auto] opacity-35" />
              <div
                className={cn(
                  "absolute left-1.5 top-2 h-5 w-11 rounded-full opacity-90",
                  preset.accent,
                )}
              />
              <div className="absolute left-1.5 top-9 h-5 w-11 rounded-full bg-accent/90" />
              <div className="absolute bottom-2 left-0 right-0 text-center text-xl">
                {preset.emoji}
              </div>
            </button>
          ))}
        </div>

        <RadioGroup
          value={themeMode}
          onValueChange={(value) => setThemeMode(value as typeof themeMode)}
          className="gap-3"
        >
          {[
            { value: "light", label: t("theme.light") },
            { value: "dark", label: t("theme.dark") },
            { value: "system", label: t("theme.system") },
          ].map((option) => (
            <Ripple key={option.value} className={cn(SECTION_BUTTON_CLASSNAME, "py-2")}>
              <label className="flex min-w-0 cursor-pointer items-center gap-4">
                <RadioGroupItem value={option.value} />
                <span className="min-w-0 break-words font-semibold">{option.label}</span>
              </label>
            </Ripple>
          ))}
        </RadioGroup>
      </SidebarPageContent>

      <SidebarPageSeparator />

      <SidebarPageContent className="gap-3">
        <p className="px-1 text-lg font-semibold text-primary">{t("hotkeys")}</p>

        <RadioGroup
          value={sendShortcut}
          onValueChange={(value) => setSendShortcut(value as typeof sendShortcut)}
          className="gap-3"
        >
          {[
            {
              value: "enter",
              title: t("sendShortcut.enter.title"),
              description: t("sendShortcut.enter.description"),
            },
            {
              value: "ctrl-enter",
              title: t("sendShortcut.ctrlEnter.title"),
              description: t("sendShortcut.ctrlEnter.description"),
            },
          ].map((option) => (
            <Ripple key={option.value} className={cn(SECTION_BUTTON_CLASSNAME, "py-2")}>
              <label className="flex min-w-0 cursor-pointer items-center gap-4">
                <RadioGroupItem value={option.value} />
                <div className="min-w-0">
                  <p className="break-words font-semibold">{option.title}</p>
                  <p className="break-words text-sm text-muted-foreground">{option.description}</p>
                </div>
              </label>
            </Ripple>
          ))}
        </RadioGroup>
      </SidebarPageContent>

      <SidebarPageSeparator />

      <SidebarPageContent className="pb-4">
        <p className="px-1 text-lg font-semibold text-primary">{t("timeFormat")}</p>

        <RadioGroup
          value={timeFormat}
          onValueChange={(value) => setTimeFormat(value as typeof timeFormat)}
          className="gap-3"
        >
          {[
            { value: "12h", title: t("timeFormat12"), subtitle: "07:50 PM" },
            { value: "24h", title: t("timeFormat24"), subtitle: "19:50" },
          ].map((option) => (
            <Ripple key={option.value} className={cn(SECTION_BUTTON_CLASSNAME, "py-2")}>
              <label className="flex min-w-0 cursor-pointer items-center gap-4">
                <RadioGroupItem value={option.value} />
                <div className="min-w-0">
                  <p className="break-words font-semibold">{option.title}</p>
                  <p className="text-sm text-muted-foreground">{option.subtitle}</p>
                </div>
              </label>
            </Ripple>
          ))}
        </RadioGroup>
      </SidebarPageContent>
    </SidebarPage>
  );
};
