"use client";

import { Button, toast } from "@repo/ui";
import { memo } from "react";
import { useTranslations } from "next-intl";

import { type ChatReplyKeyboardMarkup } from "@/lib/bot-reply-markup";

interface ChatReplyKeyboardProps {
  markup: ChatReplyKeyboardMarkup;
  disabled?: boolean;
  onPressText: (text: string) => void;
}

/**
 * Renders the conversation-level reply keyboard exposed by a bot.
 * Button clicks are translated into regular outgoing user messages.
 */
export const ChatReplyKeyboard = memo(function ChatReplyKeyboard({
  markup,
  disabled = false,
  onPressText,
}: ChatReplyKeyboardProps) {
  const t = useTranslations("chat.sendMessageForm");

  return (
    <div className="bg-transparent px-2 pb-2 pt-1.5">
      <div className="flex flex-col gap-1.5">
        {markup.keyboard.map((row, rowIndex) => (
          <div key={`reply-keyboard-row-${rowIndex}`} className="flex gap-1.5">
            {row.map((button, buttonIndex) => (
              <Button
                key={`reply-keyboard-button-${rowIndex}-${buttonIndex}-${button.text}`}
                type="button"
                variant="ghost"
                className="h-11 flex-1 rounded-lg border border-border/40 bg-background/25 px-3 text-center text-[15px] font-semibold shadow-none backdrop-blur-sm transition-colors duration-150"
                disabled={disabled}
                onClick={() => {
                  if (button.requestContact) {
                    toast({
                      title: t("requestContactUnsupported"),
                      type: "error",
                    });
                    return;
                  }

                  if (button.requestLocation) {
                    toast({
                      title: t("requestLocationUnsupported"),
                      type: "error",
                    });
                    return;
                  }

                  onPressText(button.text);
                }}
              >
                <span className="truncate text-center">{button.text}</span>
              </Button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});
