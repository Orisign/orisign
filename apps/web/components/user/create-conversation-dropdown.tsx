"use client";

import { sidebarStore } from "@/store/sidebar/sidebar.store";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui";
import { Megaphone, Plus, User, Users, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";
import { iconSwap } from "@/lib/animations";

export const CreateConversationDropdown = () => {
  const t = useTranslations("conversationDropdown");
  const [open, setOpen] = useState(false);
  const { push } = sidebarStore();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size={"icon"}
          className="absolute bottom-2 right-2 size-14 rounded-full shadow-none"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={open ? "close" : "open"}
              layout
              layoutId="create-chat-fab-icon"
              variants={iconSwap}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {open ? (
                <X className="size-14" strokeWidth={3} />
              ) : (
                <Plus className="size-14" strokeWidth={3} />
              )}
            </motion.div>
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => {
              setOpen(false);
              push({
                screen: "create-conversation-details",
                type: "channel",
                memberIds: [],
              });
            }}
          >
            <Megaphone />
            {t("createChannel")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setOpen(false);
              push({
                screen: "create-conversation-members",
                type: "group",
                selectedUserIds: [],
              });
            }}
          >
            <Users />
            {t("createGroup")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setOpen(false);
              push({
                screen: "create-conversation-members",
                type: "direct",
                selectedUserIds: [],
              });
            }}
          >
            <User />
            {t("createDirect")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
