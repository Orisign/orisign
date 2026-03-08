"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  formatChatDayLabel,
  formatTimestampTime,
  getConversationParticipantVisual,
} from "@/lib/chat";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { CheckCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

export interface ChatMessageReadReceipt {
  userId: string;
  displayName: string;
  avatarUrl: string;
  avatarInitial: string;
  readAt: number;
}

interface ChatMessageReadDialogProps {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readReceipts: ChatMessageReadReceipt[];
}

export function ChatMessageReadDialog({
  conversationId,
  open,
  onOpenChange,
  readReceipts,
}: ChatMessageReadDialogProps) {
  const t = useTranslations("chat.messages.readDialog");
  const td = useTranslations("chat.messages.dayDivider");
  const locale = useLocale();

  const sortedReceipts = useMemo(
    () => [...readReceipts].sort((left, right) => right.readAt - left.readAt),
    [readReceipts],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[28rem] gap-0 overflow-hidden border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex min-w-10 items-center justify-center gap-1 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">
              <CheckCheck className="size-4" strokeWidth={2.6} />
              <span>{sortedReceipts.length}</span>
            </div>
            <DialogTitle>{t("title", { count: sortedReceipts.length })}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="max-h-[26rem] overflow-y-auto px-5 py-3">
          {sortedReceipts.length > 0 ? (
            <div className="space-y-3">
              {sortedReceipts.map((receipt) => {
                const dayLabel = formatChatDayLabel(receipt.readAt, locale, {
                  today: td("today"),
                  yesterday: td("yesterday"),
                });
                const timeLabel = formatTimestampTime(receipt.readAt, locale);
                const participantVisual = getConversationParticipantVisual(
                  conversationId,
                  receipt.userId,
                );

                return (
                  <div
                    key={receipt.userId}
                    className="flex items-center gap-3 rounded-2xl px-1 py-1"
                  >
                    <Avatar
                      size="lg"
                      className={!receipt.avatarUrl ? participantVisual.avatarClassName : ""}
                    >
                      {receipt.avatarUrl ? (
                        <AvatarImage src={receipt.avatarUrl} alt="" />
                      ) : null}
                      <AvatarFallback
                        className={!receipt.avatarUrl ? "bg-transparent text-white" : ""}
                      >
                        {receipt.avatarInitial}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">
                        {receipt.displayName}
                      </p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <CheckCheck className="size-3.5 shrink-0" strokeWidth={2.4} />
                        <span>
                          {t("readAt", {
                            day: dayLabel,
                            time: timeLabel,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">{t("empty")}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
