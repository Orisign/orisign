"use client";

import { Button, Input, Skeleton, SkeletonGroup } from "@repo/ui";
import { IoMdMore } from "react-icons/io";
import { ChatDropdown } from "./chat-dropdown";
import { useState } from "react";
import { IoArrowBack, IoClose, IoSearch } from "react-icons/io5";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { SPRING_LAYOUT, fadeY } from "@/lib/animations";
import { FiPhone } from "react-icons/fi";

interface ChatHeaderProps {
  conversationId: string;
  title: string;
  members: number;
  subtitle?: string;
  avatarUrl?: string;
  avatarFallback?: string;
  avatarSeed?: string;
  isDirect?: boolean;
  showCallAction?: boolean;
  directPeerId?: string;
  isPeerBlockedByCurrentUser?: boolean;
  onTogglePeerBlock?: () => void;
  isTogglingPeerBlock?: boolean;
  onStartCall?: () => void;
  onEndCall?: () => void;
  callActive?: boolean;
  callDisabled?: boolean;
  onToggleRightSidebar?: () => void;
  commentsMode?: boolean;
  onBack?: () => void;
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
  isTogglingNotifications?: boolean;
  canToggleNotifications?: boolean;
  canLeaveConversation?: boolean;
  onViewDiscussion?: () => void;
  isLoading?: boolean;
}

export function ChatHeader({
  title,
  members,
  conversationId,
  subtitle,
  avatarUrl,
  avatarFallback,
  avatarSeed,
  isDirect = false,
  showCallAction = isDirect,
  directPeerId,
  isPeerBlockedByCurrentUser = false,
  onTogglePeerBlock,
  isTogglingPeerBlock = false,
  onStartCall,
  onEndCall,
  callActive = false,
  callDisabled = false,
  onToggleRightSidebar,
  commentsMode = false,
  onBack,
  notificationsEnabled = true,
  onToggleNotifications,
  isTogglingNotifications = false,
  canToggleNotifications = false,
  canLeaveConversation = true,
  onViewDiscussion,
  isLoading = false,
}: ChatHeaderProps) {
  const t = useTranslations("chat.header");
  const [searching, setSearching] = useState(false);
  const panelVariants = fadeY(8);
  const groupSubtitle = subtitle?.trim().length
    ? subtitle
    : t("members", { count: members });

  if (commentsMode) {
    return (
      <motion.div
        layout
        transition={SPRING_LAYOUT}
        className="z-20 flex w-full shrink-0 items-center gap-2 border-b border-border bg-sidebar px-3 py-2.5"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-12 rounded-full [&>svg]:size-8"
          onClick={onBack}
          aria-label={t("backAriaLabel")}
        >
          <IoArrowBack />
        </Button>
        <p className="truncate text-lg font-semibold">{title}</p>
      </motion.div>
    );
  }

  if (isLoading) {
    return (
      <motion.div
        layout
        transition={SPRING_LAYOUT}
        className="z-20 flex w-full shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4 py-2"
      >
        <SkeletonGroup durationMs={2100} className="flex w-full items-center gap-3">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-44 max-w-[55%] rounded-full" />
            <Skeleton className="h-3.5 w-28 max-w-[38%] rounded-full" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="size-10 rounded-full" />
          </div>
        </SkeletonGroup>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      transition={SPRING_LAYOUT}
      className="z-20 shrink-0 flex w-full items-center gap-2 border-b border-border bg-sidebar px-4 py-2"
    >
      <AnimatePresence mode="wait" initial={false}>
        {searching ? (
          <motion.div
            key="search"
            layout
            layoutId="chat-header-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full"
          >
            <Input
              leftSlot={<IoSearch className="text-muted-foreground" />}
              rightSlot={
                <Button
                  className="size-10 rounded-full [&_svg]:size-6"
                  variant={"ghost"}
                  onClick={() => setSearching(false)}
                >
                  <IoClose className="text-muted-foreground" />
                </Button>
              }
              placeholder={t("searchPlaceholder")}
              className="w-full flex-1"
            />
          </motion.div>
        ) : (
          <motion.div
            key="default"
            layout
            layoutId="chat-header-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex w-full items-center gap-2"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-accent/60"
              onClick={onToggleRightSidebar}
              disabled={!onToggleRightSidebar}
            >
              <Avatar
                size="lg"
                className={cn(
                  "shrink-0",
                  !avatarUrl && avatarSeed
                    ? `bg-linear-to-br ${avatarSeed} text-white`
                    : "",
                )}
              >
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                <AvatarFallback className={!avatarUrl ? "bg-transparent text-white" : ""}>
                  {avatarFallback || "#"}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 flex-col justify-center gap-1">
                <p className="truncate text-base font-semibold">{title}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {isDirect
                    ? (subtitle || t("directFallback"))
                    : groupSubtitle}
                </p>
              </div>
            </button>
            <div className="flex items-center justify-center gap-2">
              {showCallAction ? (
                <Button
                  className="rounded-full size-10 [&_svg]:size-6"
                  variant={callActive ? "destructive" : "ghost"}
                  onClick={callActive ? onEndCall : onStartCall}
                  disabled={callDisabled}
                >
                  <FiPhone className={cn(!callActive && "text-muted-foreground")} />
                </Button>
              ) : null}
              <Button
                className="rounded-full size-10 [&_svg]:size-6"
                variant={"ghost"}
                onClick={() => setSearching(true)}
              >
                <IoSearch strokeWidth={3} className="text-muted-foreground" />
              </Button>
                <ChatDropdown
                  conversationId={conversationId}
                  isDirect={isDirect}
                  showVideoCallAction={showCallAction}
                  directPeerId={directPeerId}
                isPeerBlockedByCurrentUser={isPeerBlockedByCurrentUser}
                onTogglePeerBlock={onTogglePeerBlock}
                isTogglingPeerBlock={isTogglingPeerBlock}
                notificationsEnabled={notificationsEnabled}
                onToggleNotifications={onToggleNotifications}
                isTogglingNotifications={isTogglingNotifications}
                canToggleNotifications={canToggleNotifications}
                canLeaveConversation={canLeaveConversation}
                onViewDiscussion={onViewDiscussion}
              >
                <Button
                  className="rounded-full size-10 [&_svg]:size-6"
                  variant={"ghost"}
                >
                  <IoMdMore strokeWidth={3} className="text-muted-foreground" />
                </Button>
              </ChatDropdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
