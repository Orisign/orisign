"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, Ripple, Switch } from "@repo/ui";
import { AnimatePresence, motion } from "motion/react";
import type { RefObject, ReactNode } from "react";
import {
  IoAtOutline,
  IoGiftOutline,
  IoInformationCircleOutline,
  IoLinkOutline,
  IoNotificationsOutline,
  IoPhonePortraitOutline,
} from "react-icons/io5";
import { RightSidebarInfoIcon, RightSidebarInfoRow } from "./primitives";
import {
  RIGHT_SIDEBAR_TRANSITION,
  SIDEBAR_FALLBACK_AVATAR_CLASS,
} from "./utils";

export function RightSidebarInfoScreen({
  title,
  profileSubtitle,
  avatarUrl,
  avatarFallback,
  avatarCollapseProgress,
  isSharedView,
  headerAvatarLayoutId,
  infoViewportRef,
  tabsAnchorRef,
  onViewportScroll,
  aboutLabel,
  publicLink,
  phoneLabel,
  usernameLabel,
  birthDateLabel,
  isChannel,
  isGroup,
  notificationsEnabled,
  canToggleNotifications,
  isUpdatingNotifications,
  onToggleNotifications,
  onCopyValue,
  tabs,
  t,
}: {
  title: string;
  profileSubtitle: string;
  avatarUrl: string;
  avatarFallback: string;
  avatarCollapseProgress: number;
  isSharedView: boolean;
  headerAvatarLayoutId: string;
  infoViewportRef: RefObject<HTMLDivElement | null>;
  tabsAnchorRef: RefObject<HTMLDivElement | null>;
  onViewportScroll: () => void;
  aboutLabel: string;
  publicLink: string;
  phoneLabel: string;
  usernameLabel: string;
  birthDateLabel: string;
  isChannel: boolean;
  isGroup: boolean;
  notificationsEnabled: boolean;
  canToggleNotifications: boolean;
  isUpdatingNotifications: boolean;
  onToggleNotifications: (value: boolean) => void;
  onCopyValue: (value: string, title: string) => Promise<void>;
  tabs: ReactNode;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-sidebar">
      <ScrollArea
        className="h-full"
        viewportRef={infoViewportRef}
        onViewportScroll={onViewportScroll}
      >
        <section className="border-b px-4 pb-5 pt-6">
          <div className="flex flex-col items-center text-center">
            <AnimatePresence mode="wait" initial={false}>
              {!isSharedView ? (
                <motion.div
                  key="profile-avatar"
                  layoutId={headerAvatarLayoutId}
                  animate={{
                    scale: 1 - avatarCollapseProgress * 0.24,
                    y: -avatarCollapseProgress * 10,
                    opacity: 1 - avatarCollapseProgress * 0.12,
                  }}
                  exit={{ opacity: 0, scale: 0.84 }}
                  transition={RIGHT_SIDEBAR_TRANSITION}
                >
                  <Avatar className={`size-28 ${!avatarUrl ? SIDEBAR_FALLBACK_AVATAR_CLASS : ""}`}>
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                    <AvatarFallback className={!avatarUrl ? "bg-transparent text-[1.75rem] text-primary-foreground" : ""}>
                      {avatarFallback}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
              ) : (
                <motion.div
                  key="profile-avatar-space"
                  className="size-28"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.001 }}
                  exit={{ opacity: 0 }}
                />
              )}
            </AnimatePresence>

            <motion.h3
              className="mt-4 max-w-full truncate text-[1.2rem] font-semibold"
              animate={{ opacity: 1 - avatarCollapseProgress * 0.85 }}
              transition={{ duration: 0.12 }}
            >
              {title}
            </motion.h3>
            <motion.p
              className="mt-1 max-w-full truncate text-sm text-muted-foreground"
              animate={{ opacity: Math.max(0.25, 1 - avatarCollapseProgress * 1.15) }}
              transition={{ duration: 0.12 }}
            >
              {profileSubtitle}
            </motion.p>
          </div>
        </section>

        <section className="space-y-1 border-b px-2 py-2">
          {isChannel && aboutLabel ? (
            <RightSidebarInfoRow
              icon={<IoInformationCircleOutline />}
              value={aboutLabel}
              label={t("sections.about")}
              multiline
            />
          ) : null}

          {!isGroup && phoneLabel ? (
            <RightSidebarInfoRow
              icon={<IoPhonePortraitOutline />}
              value={phoneLabel}
              label={t("sections.phone")}
              onClick={() => void onCopyValue(phoneLabel, t("context.fieldCopied", { field: t("sections.phone") }))}
            />
          ) : null}

          {!isGroup && usernameLabel ? (
            <RightSidebarInfoRow
              icon={<IoAtOutline />}
              value={usernameLabel}
              label={t("sections.username")}
              onClick={() => void onCopyValue(usernameLabel, t("context.fieldCopied", { field: t("sections.username") }))}
            />
          ) : null}

          {isChannel && publicLink ? (
            <RightSidebarInfoRow
              icon={<IoLinkOutline />}
              value={publicLink}
              label={t("sections.publicLink")}
              onClick={() => void onCopyValue(publicLink, t("context.fieldCopied", { field: t("sections.publicLink") }))}
            />
          ) : null}

          {!isGroup && birthDateLabel ? (
            <RightSidebarInfoRow
              icon={<IoGiftOutline />}
              value={birthDateLabel}
              label={t("sections.birthDate")}
            />
          ) : null}

          <Ripple asChild>
            <label className="flex w-full cursor-pointer items-start gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-accent">
              <RightSidebarInfoIcon>
                <IoNotificationsOutline />
              </RightSidebarInfoIcon>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="block text-sm font-semibold">{t("members.notifications")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {notificationsEnabled ? t("sections.enabled") : t("sections.disabled")}
              </span>
            </span>
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={onToggleNotifications}
              disabled={!canToggleNotifications || isUpdatingNotifications}
            />
          </label>
        </Ripple>
      </section>

        <div ref={tabsAnchorRef}>
          {tabs}
        </div>
      </ScrollArea>
    </div>
  );
}
