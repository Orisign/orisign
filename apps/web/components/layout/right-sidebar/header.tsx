"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Button } from "@repo/ui";
import { AnimatePresence, motion } from "motion/react";
import { MdOutlineEdit } from "react-icons/md";
import { RightSidebarAnimatedCloseIcon } from "./animated-close-icon";
import { RIGHT_SIDEBAR_TRANSITION, SIDEBAR_FALLBACK_AVATAR_CLASS } from "./utils";

export interface RightSidebarHeaderProps {
  showBackAction: boolean;
  onLeadingAction: () => void;
  leadingAriaLabel: string;
  showHeaderAvatar: boolean;
  headerAvatarLayoutId: string;
  avatarUrl: string;
  avatarFallback: string;
  headerTitle: string;
  headerSubtitle: string;
  titleMotionKey: string;
  canEditInfo: boolean;
  onEditInfo: () => void;
  editAriaLabel: string;
}

export function RightSidebarHeader({
  showBackAction,
  onLeadingAction,
  leadingAriaLabel,
  showHeaderAvatar,
  headerAvatarLayoutId,
  avatarUrl,
  avatarFallback,
  headerTitle,
  headerSubtitle,
  titleMotionKey,
  canEditInfo,
  onEditInfo,
  editAriaLabel,
}: RightSidebarHeaderProps) {
  return (
    <div className="sticky top-0 z-30 border-b bg-sidebar/96 px-3 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-full text-muted-foreground [&>svg]:size-8 [&>svg]:shrink-0"
          onClick={onLeadingAction}
          aria-label={leadingAriaLabel}
        >
          <RightSidebarAnimatedCloseIcon isBack={showBackAction} />
        </Button>

        <AnimatePresence initial={false}>
          {showHeaderAvatar ? (
            <motion.div
              layoutId={headerAvatarLayoutId}
              key="header-avatar"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={RIGHT_SIDEBAR_TRANSITION}
            >
              <Avatar className={cn("size-10", !avatarUrl && SIDEBAR_FALLBACK_AVATAR_CLASS)}>
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                <AvatarFallback
                  className={!avatarUrl ? "bg-transparent text-primary-foreground" : ""}
                >
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={titleMotionKey}
              initial={{ x: 14, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -14, opacity: 0 }}
              transition={RIGHT_SIDEBAR_TRANSITION}
            >
              <p className="truncate text-base font-semibold">{headerTitle}</p>
              {headerSubtitle ? (
                <p className="truncate text-xs text-muted-foreground">{headerSubtitle}</p>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        {canEditInfo ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-full text-muted-foreground [&>svg]:size-8 [&>svg]:shrink-0"
            onClick={onEditInfo}
            aria-label={editAriaLabel}
          >
            <MdOutlineEdit />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
