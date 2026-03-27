"use client";

import { Button, toast } from "@repo/ui";
import { memo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { buildApiUrl } from "@/lib/app-config";
import {
  type ChatInlineKeyboardMarkup,
  type ChatInlineKeyboardButton,
} from "@/lib/bot-reply-markup";
import { customFetch } from "@/lib/fetcher";

interface MessageCallbackResponseDto {
  ok: boolean;
  callbackQueryId?: string;
}

interface ChatMessageReplyMarkupProps {
  conversationId: string;
  messageId: string;
  markup: ChatInlineKeyboardMarkup;
  disabled?: boolean;
}

/**
 * Renders inline buttons attached to a single bot message and dispatches
 * callback queries back into the messenger transport.
 */
export const ChatMessageReplyMarkup = memo(function ChatMessageReplyMarkup({
  conversationId,
  messageId,
  markup,
  disabled = false,
}: ChatMessageReplyMarkupProps) {
  const t = useTranslations("chat.messages");
  const locale = useLocale();
  const [pendingButtonKey, setPendingButtonKey] = useState("");

  async function handleButtonClick(
    button: ChatInlineKeyboardButton,
    buttonKey: string,
  ) {
    if (disabled) {
      return;
    }

    if (button.url) {
      window.open(button.url, "_blank", "noopener,noreferrer");
      return;
    }

    if (button.webApp?.url) {
      window.open(button.webApp.url, "_blank", "noopener,noreferrer");
      return;
    }

    if (button.switchInlineQuery) {
      toast({
        title: t("unsupportedButtonAction"),
        type: "error",
      });
      return;
    }

    if (!button.callbackData) {
      return;
    }

    setPendingButtonKey(buttonKey);
    try {
      await customFetch<MessageCallbackResponseDto>(buildApiUrl("/messages/callback"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          messageId,
          callbackData: button.callbackData,
          locale,
        }),
      });
    } catch {
      toast({
        title: t("callbackError"),
        type: "error",
      });
    } finally {
      setPendingButtonKey((currentValue) =>
        currentValue === buttonKey ? "" : currentValue,
      );
    }
  }

  const buttons = markup.inlineKeyboard.flatMap((row, rowIndex) =>
    row.map((button, buttonIndex) => ({
      button,
      buttonKey: `${rowIndex}:${buttonIndex}:${button.text}`,
    })),
  );
  const useTwoColumnGrid = buttons.length >= 6;
  const sharedButtonClassName =
    "h-9 w-full justify-center rounded-[0.7rem] border border-primary/18 bg-primary/14 px-3 text-[14px] font-medium text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-[background-color,border-color,color] duration-150 hover:border-primary/28 hover:bg-primary/20 hover:text-primary active:bg-primary/24";

  return (
    <div className="w-full min-w-0">
      <div
        className={
          useTwoColumnGrid
            ? "grid grid-cols-2 gap-1.5"
            : "flex w-full min-w-0 flex-col gap-1.5"
        }
      >
        {buttons.map(({ button, buttonKey }, index) => {
          const isLastOddButton =
            useTwoColumnGrid && buttons.length % 2 === 1 && index === buttons.length - 1;

          return (
            <Button
              key={`${messageId}-inline-button-${buttonKey}`}
              type="button"
              variant="ghost"
              className={[
                sharedButtonClassName,
                isLastOddButton ? "col-span-2" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={disabled || pendingButtonKey === buttonKey}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void handleButtonClick(button, buttonKey);
              }}
            >
              <span className="block w-full truncate text-center leading-none">
                {button.text}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
});
