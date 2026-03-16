"use client";

import { Button, Input } from "@repo/ui";
import { IoMdMore } from "react-icons/io";
import { ChatDropdown } from "./chat-dropdown";
import { useState } from "react";
import { IoClose, IoSearch } from "react-icons/io5";
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
  directPeerId?: string;
  isPeerBlockedByCurrentUser?: boolean;
  onTogglePeerBlock?: () => void;
  isTogglingPeerBlock?: boolean;
  onStartCall?: () => void;
  onEndCall?: () => void;
  callActive?: boolean;
  callDisabled?: boolean;
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
  directPeerId,
  isPeerBlockedByCurrentUser = false,
  onTogglePeerBlock,
  isTogglingPeerBlock = false,
  onStartCall,
  onEndCall,
  callActive = false,
  callDisabled = false,
}: ChatHeaderProps) {
  const t = useTranslations("chat.header");
  const [searching, setSearching] = useState(false);
  const panelVariants = fadeY(8);

  return (
    <motion.div
      layout
      transition={SPRING_LAYOUT}
      className="z-20 shrink-0 flex w-full items-center gap-2 border-b border-border/60 bg-muted/60 px-4 py-2 backdrop-blur-sm"
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
            <div className="flex min-w-0 flex-1 items-center gap-3">
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
                    : t("members", { count: members })}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              {isDirect ? (
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
                directPeerId={directPeerId}
                isPeerBlockedByCurrentUser={isPeerBlockedByCurrentUser}
                onTogglePeerBlock={onTogglePeerBlock}
                isTogglingPeerBlock={isTogglingPeerBlock}
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
