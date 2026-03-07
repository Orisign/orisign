"use client";

import { useMessagesControllerSend } from "@/api/generated";
import {
  sendMessageSchema,
  TypeSendMessageSchema,
} from "@/schemas/chat/send-message.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Field } from "@repo/ui";
import { Controller, useForm, useWatch } from "react-hook-form";
import { HiPaperAirplane } from "react-icons/hi2";
import { TiMicrophone } from "react-icons/ti";
import { EmojiInput } from "@/components/ui/emoji-input";
import { useTranslations } from "next-intl";

import { AnimatePresence, motion } from "motion/react";

export function SendMessageForm({
  conversationId,
}: {
  conversationId: string;
}) {
  const t = useTranslations("chat.sendMessageForm");
  const { mutate: sendMessage } = useMessagesControllerSend({
    mutation: {
      onSuccess: () => {
        form.reset();
      },
    },
  });

  const form = useForm<TypeSendMessageSchema>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: {
      text: "",
      replyToId: "",
    },
  });

  const textValue = useWatch({
    control: form.control,
    name: "text",
    defaultValue: "",
  });

  function onSubmit(data: TypeSendMessageSchema) {
    sendMessage({
      data: {
        conversationId,
        kind: 0,
        text: data.text,
        replyToId: data.replyToId,
      },
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex items-end justify-center gap-2"
    >
      <Controller
        control={form.control}
        name="text"
        render={({ field }) => (
          <Field className="flex-1">
            <EmojiInput
              placeholder={t("placeholder")}
              className="max-w-none"
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
            />
          </Field>
        )}
      />

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
