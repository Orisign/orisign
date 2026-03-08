"use client";

import {
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  SendMessageRequestDtoKind,
  getConversationsControllerMyQueryKey,
  useMessagesControllerSend,
} from "@/api/generated";
import {
  sendMessageSchema,
  TypeSendMessageSchema,
} from "@/schemas/chat/send-message.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Field } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect } from "react";
import { HiPaperAirplane } from "react-icons/hi2";
import { FiX } from "react-icons/fi";
import { TiMicrophone } from "react-icons/ti";
import { EmojiInput } from "@/components/ui/emoji-input";
import { useTranslations } from "next-intl";
import {
  bumpConversationInListData,
  bumpConversationQueryData,
  getConversationQueryKey,
} from "@/hooks/use-chat";
import { cn } from "@/lib/utils";

import { AnimatePresence, motion } from "motion/react";
import type { ChatReplyTarget } from "./chat.types";

export function SendMessageForm({
  conversationId,
  replyTarget,
  onCancelReply,
}: {
  conversationId: string;
  replyTarget: ChatReplyTarget | null;
  onCancelReply: () => void;
}) {
  const t = useTranslations("chat.sendMessageForm");
  const form = useForm<TypeSendMessageSchema>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: {
      text: "",
      replyToId: "",
    },
  });
  const queryClient = useQueryClient();

  const { mutate: sendMessage } = useMessagesControllerSend({
    mutation: {
      onSuccess: async () => {
        form.reset();
        onCancelReply();

        const nextTimestamp = Date.now();

        queryClient.setQueryData<GetConversationResponseDto>(
          getConversationQueryKey(conversationId),
          (currentData) => bumpConversationQueryData(currentData, nextTimestamp),
        );

        queryClient.setQueriesData<ListMyConversationsResponseDto>(
          { queryKey: getConversationsControllerMyQueryKey() },
          (currentData) =>
            bumpConversationInListData(currentData, conversationId, nextTimestamp),
        );
      },
    },
  });

  const textValue = useWatch({
    control: form.control,
    name: "text",
    defaultValue: "",
  });

  const replyToIdValue = useWatch({
    control: form.control,
    name: "replyToId",
    defaultValue: "",
  });

  const isReplying = Boolean(replyTarget && replyToIdValue);
  const replyFocusToken = replyTarget?.id ?? null;

  useEffect(() => {
    form.setValue("replyToId", replyTarget?.id ?? "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [form, replyTarget]);

  function onSubmit(data: TypeSendMessageSchema) {
    const text = data.text.trim();

    if (!conversationId || text.length === 0) return;

    sendMessage({
      data: {
        conversationId,
        kind: SendMessageRequestDtoKind.NUMBER_1,
        text,
        replyToId: data.replyToId || undefined,
      },
    });
  }

  function handleCancelReply() {
    form.setValue("replyToId", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    onCancelReply();
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex items-end justify-center gap-2"
    >
      <div className="flex-1">
        <AnimatePresence initial={false}>
          {isReplying ? (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-t-[20px] rounded-b-none border-2 border-border/60 border-b-0 bg-secondary/85 px-3 py-2.5 backdrop-blur-sm"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-0.5 shrink-0 bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold leading-none text-primary">
                    {replyTarget?.authorName}
                  </p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-[14px] leading-[1.15] text-muted-foreground">
                    {replyTarget?.text || t("replyFallback")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 rounded-full"
                  onClick={handleCancelReply}
                >
                  <FiX className="size-4" />
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Controller
          control={form.control}
          name="text"
          render={({ field }) => (
            <Field className="flex-1">
              <EmojiInput
                placeholder={t("placeholder")}
                className={cn(
                  "max-w-none",
                  isReplying && "rounded-t-none border-t-0",
                )}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                showEmojiPicker
                autoGrow
                focusToken={replyFocusToken}
                onSubmit={() => {
                  void form.handleSubmit(onSubmit)();
                }}
              />
            </Field>
          )}
        />
      </div>

      <Button
        type="submit"
        className="size-12 shrink-0 rounded-full self-end [&_svg]:size-6"
      >
        <AnimatePresence mode="wait" initial={false}>
          {textValue.trim().length > 0 ? (
            <motion.div
              key={"text"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >
              <HiPaperAirplane />
            </motion.div>
          ) : (
            <motion.div
              key={"audio"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >
              <TiMicrophone />
            </motion.div>
          )}
        </AnimatePresence>
      </Button>
    </form>
  );
}
