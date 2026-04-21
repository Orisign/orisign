"use client";

import { SECTION_BUTTON_CLASSNAME } from "@/components/shared/shared.constants";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
  SidebarPageSeparator,
  SidebarPageTitle,
} from "@/components/ui/sidebar-page";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { sidebarStore } from "@/store/sidebar/sidebar.store";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";
import { Button, Checkbox, Switch, cn } from "@repo/ui";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

const STICKERS_MASK = 0b11;
const EFFECTS_MASK = 0b111;
const CHAT_MASK = 0b11;

function countBits(value: number) {
  let count = 0;
  let current = Math.max(0, Math.floor(value));
  while (current > 0) {
    count += current & 1;
    current >>= 1;
  }
  return count;
}

function isBitEnabled(value: number, bit: number) {
  return (value & (1 << bit)) !== 0;
}

function setBitEnabled(value: number, bit: number, checked: boolean) {
  return checked ? value | (1 << bit) : value & ~(1 << bit);
}

export const PowerSavingSidebar = () => {
  const t = useTranslations("powerSavingSidebar");
  const { pop } = sidebarStore();
  const [expanded, setExpanded] = useState<string[]>([]);
  const {
    powerSavingEnabled,
    autoplayVideo,
    autoplayGif,
    animatedStickersLevel,
    interactiveEffectsLevel,
    chatAnimationsLevel,
    interfaceAnimationsEnabled,
    setPowerSavingEnabled,
    setAutoplayVideo,
    setAutoplayGif,
    setAnimatedStickersLevel,
    setInteractiveEffectsLevel,
    setChatAnimationsLevel,
    setInterfaceAnimationsEnabled,
  } = useGeneralSettingsStore();

  const stickersOptions = [
    t("animatedStickersOptions.inPanel"),
    t("animatedStickersOptions.inChats"),
  ];
  const effectsOptions = [
    t("interactiveEffectsOptions.reactions"),
    t("interactiveEffectsOptions.premiumStickers"),
    t("interactiveEffectsOptions.emoji"),
  ];
  const chatAnimationOptions = [
    t("chatAnimationsOptions.wallpaperRotation"),
    t("chatAnimationsOptions.spoilerAnimation"),
  ];

  const stickersCount = useMemo(
    () => countBits(animatedStickersLevel & STICKERS_MASK),
    [animatedStickersLevel],
  );
  const effectsCount = useMemo(
    () => countBits(interactiveEffectsLevel & EFFECTS_MASK),
    [interactiveEffectsLevel],
  );
  const chatCount = useMemo(
    () => countBits(chatAnimationsLevel & CHAT_MASK),
    [chatAnimationsLevel],
  );

  return (
    <SidebarPage>
      <SidebarPageHeader className="justify-start gap-3">
        <Button onClick={pop} variant="ghost" size="icon" className="rounded-full">
          <ArrowLeft strokeWidth={3} className="size-6" />
        </Button>
        <SidebarPageTitle>{t("title")}</SidebarPageTitle>
      </SidebarPageHeader>

      <SidebarPageContent className="gap-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-base font-semibold">{t("modeTitle")}</span>
          <Switch checked={powerSavingEnabled} onCheckedChange={setPowerSavingEnabled} />
        </div>
      </SidebarPageContent>

      <SidebarPageSeparator className="h-auto py-3">
        <p className="px-4 text-sm text-muted-foreground">{t("modeDescription")}</p>
      </SidebarPageSeparator>

      <SidebarPageContent className="gap-0.5 pb-4">
        <div className={cn(SECTION_BUTTON_CLASSNAME, "flex items-center justify-between")}>
          <span className="font-semibold">{t("autoplayVideo")}</span>
          <Switch checked={autoplayVideo} onCheckedChange={setAutoplayVideo} />
        </div>

        <div className={cn(SECTION_BUTTON_CLASSNAME, "flex items-center justify-between")}>
          <span className="font-semibold">{t("autoplayGif")}</span>
          <Switch checked={autoplayGif} onCheckedChange={setAutoplayGif} />
        </div>

        <Accordion
          type="multiple"
          value={expanded}
          onValueChange={setExpanded}
          className="space-y-0.5"
        >
          <AccordionItem value="stickers">
            <div className={cn(SECTION_BUTTON_CLASSNAME, "flex items-center justify-between")}>
              <AccordionTrigger className="w-auto flex-none justify-start gap-2 p-0 text-left text-base font-semibold">
                {t("animatedStickers", { value: `${stickersCount}/2` })}
              </AccordionTrigger>
              <Switch
                checked={stickersCount > 0}
                onCheckedChange={(checked) => {
                  setAnimatedStickersLevel(checked ? STICKERS_MASK : 0);
                }}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
            <AccordionContent className="pb-1 pl-2">
              {stickersOptions.map((label, idx) => (
                <div key={label} className={cn(SECTION_BUTTON_CLASSNAME, "py-2")}>
                  <label className="flex cursor-pointer items-center gap-4">
                    <Checkbox
                      checked={isBitEnabled(animatedStickersLevel, idx)}
                      onCheckedChange={(checked) => {
                        setAnimatedStickersLevel(
                          setBitEnabled(
                            animatedStickersLevel & STICKERS_MASK,
                            idx,
                            Boolean(checked),
                          ),
                        );
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                    <span className="font-semibold">{label}</span>
                  </label>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="effects">
            <div className={cn(SECTION_BUTTON_CLASSNAME, "flex items-center justify-between")}>
              <AccordionTrigger className="w-auto flex-none justify-start gap-2 p-0 text-left text-base font-semibold">
                {t("interactiveEffects", { value: `${effectsCount}/3` })}
              </AccordionTrigger>
              <Switch
                checked={effectsCount > 0}
                onCheckedChange={(checked) => {
                  setInteractiveEffectsLevel(checked ? EFFECTS_MASK : 0);
                }}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
            <AccordionContent className="pb-1 pl-2">
              {effectsOptions.map((label, idx) => (
                <div key={label} className={cn(SECTION_BUTTON_CLASSNAME, "py-2")}>
                  <label className="flex cursor-pointer items-center gap-4">
                    <Checkbox
                      checked={isBitEnabled(interactiveEffectsLevel, idx)}
                      onCheckedChange={(checked) => {
                        setInteractiveEffectsLevel(
                          setBitEnabled(
                            interactiveEffectsLevel & EFFECTS_MASK,
                            idx,
                            Boolean(checked),
                          ),
                        );
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                    <span className="font-semibold">{label}</span>
                  </label>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="chat">
            <div className={cn(SECTION_BUTTON_CLASSNAME, "flex items-center justify-between")}>
              <AccordionTrigger className="w-auto flex-none justify-start gap-2 p-0 text-left text-base font-semibold">
                {t("chatAnimations", { value: `${chatCount}/2` })}
              </AccordionTrigger>
              <Switch
                checked={chatCount > 0}
                onCheckedChange={(checked) => {
                  setChatAnimationsLevel(checked ? CHAT_MASK : 0);
                }}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
            <AccordionContent className="pb-1 pl-2">
              {chatAnimationOptions.map((label, idx) => (
                <div key={label} className={cn(SECTION_BUTTON_CLASSNAME, "py-2")}>
                  <label className="flex cursor-pointer items-center gap-4">
                    <Checkbox
                      checked={isBitEnabled(chatAnimationsLevel, idx)}
                      onCheckedChange={(checked) => {
                        setChatAnimationsLevel(
                          setBitEnabled(
                            chatAnimationsLevel & CHAT_MASK,
                            idx,
                            Boolean(checked),
                          ),
                        );
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                    <span className="font-semibold">{label}</span>
                  </label>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className={cn(SECTION_BUTTON_CLASSNAME, "flex items-center justify-between")}>
          <span className="font-semibold">{t("interfaceAnimations")}</span>
          <Switch
            checked={interfaceAnimationsEnabled}
            onCheckedChange={setInterfaceAnimationsEnabled}
          />
        </div>
      </SidebarPageContent>
    </SidebarPage>
  );
};
