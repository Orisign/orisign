"use client";

import { useSidebar } from "@/hooks/use-sidebar";
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

export const CreateConversationDropdown = () => {
  const t = useTranslations("conversationDropdown");
  const [open, setOpen] = useState(false);
  const { push } = useSidebar();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size={"icon"}
          className="absolute bottom-2 right-2 rounded-full size-14 shadow-none"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={open ? "close" : "open"}
              initial={{ scale: 0.82, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.82, opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
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
