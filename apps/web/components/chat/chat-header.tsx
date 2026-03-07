"use client";

import { Button, Input } from "@repo/ui";
import { IoMdMore } from "react-icons/io";
import { ChatDropdown } from "./chat-dropdown";
import { useState } from "react";
import { IoClose, IoSearch } from "react-icons/io5";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

interface ChatHeaderProps {
  conversationId: string;
  title: string;
  members: number;
}

export function ChatHeader({
  title,
  members,
  conversationId,
}: ChatHeaderProps) {
  const t = useTranslations("chat.header");
  const [searching, setSearching] = useState(false);

  return (
    <div className="sticky inset-x-0 top-0 z-30 flex w-full items-center gap-2 bg-muted/60 px-4 py-2">
      <AnimatePresence mode="wait" initial={false}>
        {searching ? (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: -6, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 6, filter: "blur(2px)" }}
            transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
            className="w-full"
          >
            <Input
              leftSlot={<IoSearch className="text-muted-foreground" />}
              rightSlot={
                <Button
                  className="rounded-full size-10 [&_svg]:size-6"
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
            initial={{ opacity: 0, y: -6, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 6, filter: "blur(2px)" }}
            transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
            className="flex w-full items-center gap-2"
          >
            <div className="min-w-0 flex-1 flex-col justify-center gap-1">
              <p className="truncate text-base font-semibold">{title}</p>
              <p className="text-muted-foreground text-sm">
                {t("members", { count: members })}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button
                className="rounded-full size-10 [&_svg]:size-6"
                variant={"ghost"}
                onClick={() => setSearching(true)}
              >
                <IoSearch strokeWidth={3} className="text-muted-foreground" />
              </Button>
              <ChatDropdown conversationId={conversationId}>
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
    </div>
  );
}
