"use client";
/* eslint-disable @next/next/no-img-element */

import {
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  SendMessageRequestDtoKind,
  getConversationsControllerMyQueryKey,
  useMessagesControllerEdit,
  useMessagesControllerSend,
} from "@/api/generated";
import {
  sendMessageSchema,
  TypeSendMessageSchema,
} from "@/schemas/chat/send-message.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Field, toast } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { HiPaperAirplane } from "react-icons/hi2";
import { FiFileText, FiPaperclip, FiVideo, FiX } from "react-icons/fi";
import { TiMicrophone } from "react-icons/ti";
import { EmojiInput } from "@/components/ui/emoji-input";
import { useTranslations } from "next-intl";
import {
  type ChatMessagesQueryData,
  bumpConversationInListData,
  bumpConversationQueryData,
  getChatMessagesQueryKey,
  getConversationQueryKey,
} from "@/hooks/use-chat";
import { playChatSound } from "@/lib/chat-sound-manager";
import { cn } from "@/lib/utils";
import {
  SPRING_LAYOUT,
  replyPanelVariants,
  swapYVariants,
} from "@/lib/animations";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";
import { getMediaLabel } from "@/lib/chat";
import {
  deleteConversationMedia,
  uploadConversationMedia,
} from "@/lib/upload-conversation-media";
import { ApiError } from "@/lib/fetcher";

import { AnimatePresence, motion } from "motion/react";
import type { ChatEditTarget, ChatReplyTarget } from "./chat.types";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl: string | null;
  uploadedKey: string | null;
  progress: number;
  status: "pending" | "uploading" | "uploaded" | "error";
};

function createAttachmentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/");
}

export function SendMessageForm({
  conversationId,
  isBlockedByCurrentUser = false,
  isBlockedByPeer = false,
  replyTarget,
  editTarget,
  onCancelReply,
  onCancelEdit,
}: {
  conversationId: string;
  isBlockedByCurrentUser?: boolean;
  isBlockedByPeer?: boolean;
  replyTarget: ChatReplyTarget | null;
  editTarget: ChatEditTarget | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
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
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef<PendingAttachment[]>([]);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  const { mutateAsync: sendMessage, isPending: isSendingMessage } = useMessagesControllerSend({
    mutation: {
      onSuccess: async () => {
        form.reset();
        onCancelReply();
        onCancelEdit();
        setAttachments((currentAttachments) => {
          currentAttachments.forEach((attachment) => {
            if (attachment.previewUrl) {
              URL.revokeObjectURL(attachment.previewUrl);
            }
          });
          return [];
        });

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
      onError: (error) => {
        const errorMessage =
          error instanceof ApiError &&
          error.body &&
          typeof error.body === "object"
            ? String(
                (error.body as Record<string, unknown>).details ??
                  (error.body as Record<string, unknown>).message ??
                  "",
              )
            : (error instanceof Error ? error.message : "");
        const isBlockedError = errorMessage.toLowerCase().includes("block");

        toast({
          title: isBlockedError ? t("blockedByPeerHint") : t("sendError"),
          type: "error",
        });
      },
    },
  });
  const { mutate: editMessage } = useMessagesControllerEdit({
    mutation: {
      onSuccess: async (_data, variables) => {
        const nextTimestamp = Date.now();
        const nextText = variables.data.text.trim();
        const messageId = variables.data.messageId;

        queryClient.setQueryData<ChatMessagesQueryData>(
          getChatMessagesQueryKey(conversationId),
          (currentData) => {
            if (!currentData) return currentData;

            return {
              messages: currentData.messages.map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      text: nextText,
                      editedAt: nextTimestamp,
                    }
                  : message,
              ),
            };
          },
        );

        queryClient.setQueryData<GetConversationResponseDto>(
          getConversationQueryKey(conversationId),
          (currentData) => bumpConversationQueryData(currentData, nextTimestamp),
        );

        queryClient.setQueriesData<ListMyConversationsResponseDto>(
          { queryKey: getConversationsControllerMyQueryKey() },
          (currentData) =>
            bumpConversationInListData(currentData, conversationId, nextTimestamp),
        );

        form.reset({
          text: "",
          replyToId: "",
        });
        onCancelEdit();
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

  const isEditing = Boolean(editTarget);
  const sendShortcut = useGeneralSettingsStore((state) => state.sendShortcut);
  const isReplying = !isEditing && Boolean(replyTarget && replyToIdValue);
  const hasUploadingAttachments = attachments.some(
    (attachment) => attachment.status === "uploading",
  );
  const hasErroredAttachments = attachments.some(
    (attachment) => attachment.status === "error",
  );
  const hasAttachedMedia = attachments.length > 0;
  const canSubmit =
    (textValue.trim().length > 0 || hasAttachedMedia || isEditing) &&
    !hasUploadingAttachments &&
    !isBlockedByCurrentUser &&
    !isBlockedByPeer &&
    !hasErroredAttachments &&
    !isSendingMessage;
  const inputFocusToken = isEditing
    ? `edit:${editTarget?.id ?? ""}`
    : (replyTarget?.id ?? null);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    form.setValue("replyToId", replyTarget?.id ?? "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [form, replyTarget]);

  useEffect(() => {
    if (!editTarget) return;

    form.setValue("replyToId", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    form.setValue("text", editTarget.text ?? "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [editTarget, form]);

  async function onSubmit(data: TypeSendMessageSchema) {
    const text = data.text.trim();

    if (!conversationId || isBlockedByCurrentUser || isBlockedByPeer) return;
    if (hasUploadingAttachments || hasErroredAttachments) return;
    if (!isEditing && text.length === 0 && !hasAttachedMedia) return;

    if (isEditing && editTarget?.id) {
      editMessage({
        data: {
          messageId: editTarget.id,
          text,
          conversationId,
        },
      });
      return;
    }

    let uploadedMediaKeys: string[] = [];

    try {
      if (hasAttachedMedia) {
        uploadedMediaKeys = await uploadPendingAttachments(attachments);
      }

      playChatSound("send");

      await sendMessage({
        data: {
          conversationId,
          kind: uploadedMediaKeys.length > 0
            ? SendMessageRequestDtoKind.NUMBER_2
            : SendMessageRequestDtoKind.NUMBER_1,
          text: text || undefined,
          replyToId: data.replyToId || undefined,
          mediaKeys: uploadedMediaKeys.length > 0 ? uploadedMediaKeys : undefined,
        },
      });
    } catch {
      if (uploadedMediaKeys.length > 0) {
        await Promise.allSettled(
          uploadedMediaKeys.map(async (key) => {
            await deleteConversationMedia(key);
          }),
        );

        setAttachments((currentAttachments) =>
          currentAttachments.map((attachment) =>
            attachment.uploadedKey && uploadedMediaKeys.includes(attachment.uploadedKey)
              ? {
                  ...attachment,
                  status: "pending",
                  progress: 0,
                  uploadedKey: null,
                }
              : attachment,
          ),
        );
      }
    }
  }

  function handleCancelReply() {
    form.setValue("replyToId", "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    onCancelReply();
  }

  function handleCancelEdit() {
    form.reset({
      text: "",
      replyToId: "",
    });
    onCancelEdit();
  }

  async function uploadAttachment(attachment: PendingAttachment): Promise<string> {
    if (attachment.uploadedKey) {
      return attachment.uploadedKey;
    }

    const attachmentId = attachment.id;

    try {
      setAttachments((currentAttachments) =>
        currentAttachments.map((currentAttachment) =>
          currentAttachment.id === attachmentId
            ? {
                ...currentAttachment,
                progress: 0,
                status: "uploading",
              }
            : currentAttachment,
        ),
      );

      const uploaded = await uploadConversationMedia(attachment.file, (progress) => {
        setAttachments((currentAttachments) =>
          currentAttachments.map((currentAttachment) =>
            currentAttachment.id === attachmentId
              ? { ...currentAttachment, progress, status: "uploading" }
              : currentAttachment,
          ),
        );
      });

      setAttachments((currentAttachments) =>
        currentAttachments.map((currentAttachment) =>
          currentAttachment.id === attachmentId
            ? {
                ...currentAttachment,
                progress: 100,
                status: "uploaded",
                uploadedKey: uploaded.key,
              }
            : currentAttachment,
        ),
      );

      return uploaded.key;
    } catch {
      setAttachments((currentAttachments) =>
        currentAttachments.map((currentAttachment) =>
          currentAttachment.id === attachmentId
            ? { ...currentAttachment, status: "error" }
            : currentAttachment,
        ),
      );
      throw new Error("Attachment upload failed");
    }
  }

  async function uploadPendingAttachments(sourceAttachments: PendingAttachment[]) {
    const snapshot = [...sourceAttachments];
    const uploadedKeys: string[] = [];

    for (const attachment of snapshot) {
      const uploadedKey = await uploadAttachment(attachment);
      uploadedKeys.push(uploadedKey);
    }

    return uploadedKeys;
  }

  function handleSelectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const nextAttachments: PendingAttachment[] = files.map((file) => ({
      id: createAttachmentId(),
      file,
      previewUrl: isImageFile(file) || isVideoFile(file) ? URL.createObjectURL(file) : null,
      uploadedKey: null,
      progress: 0,
      status: "pending",
    }));

    setAttachments((currentAttachments) => [...currentAttachments, ...nextAttachments]);

    event.currentTarget.value = "";
  }

  function handleRemoveAttachment(attachmentId: string) {
    setAttachments((currentAttachments) => {
      const attachment = currentAttachments.find((entry) => entry.id === attachmentId);
      if (!attachment) {
        return currentAttachments;
      }

      if (attachment?.uploadedKey) {
        void deleteConversationMedia(attachment.uploadedKey);
      }
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }

      return currentAttachments.filter((entry) => entry.id !== attachmentId);
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex items-end justify-center gap-2"
    >
      <motion.div layout transition={SPRING_LAYOUT} className="flex-1">
        {attachments.length > 0 ? (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-background/85"
              >
                {attachment.previewUrl && isImageFile(attachment.file) ? (
                  <img
                    src={attachment.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}

                {attachment.previewUrl && isVideoFile(attachment.file) ? (
                  <video
                    src={attachment.previewUrl}
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : null}

                {!attachment.previewUrl ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1.5 text-center">
                    {attachment.file.type.startsWith("video/") ? (
                      <FiVideo className="size-5 text-muted-foreground" />
                    ) : (
                      <FiFileText className="size-5 text-muted-foreground" />
                    )}
                    <p className="line-clamp-2 text-[10px] font-medium leading-tight text-muted-foreground">
                      {getMediaLabel(attachment.file.name)}
                    </p>
                  </div>
                ) : null}

                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-1 top-1 size-6 rounded-full"
                  onClick={() => handleRemoveAttachment(attachment.id)}
                  disabled={attachment.status === "uploading" || isSendingMessage}
                >
                  <FiX className="size-3.5" />
                </Button>

                <div className="absolute inset-x-1.5 bottom-1.5 overflow-hidden rounded-full bg-background/70">
                  <div
                    className={cn(
                      "h-1.5 transition-[width] duration-150",
                      attachment.status === "error" ? "bg-destructive" : "bg-primary",
                    )}
                    style={{
                      width: `${attachment.status === "error" ? 100 : attachment.progress}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {isReplying ? (
            <motion.div
              layout
              layoutId="composer-reply-panel"
              variants={replyPanelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
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

          {isEditing ? (
            <motion.div
              layout
              layoutId="composer-reply-panel"
              variants={replyPanelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="rounded-t-[20px] rounded-b-none border-2 border-border/60 border-b-0 bg-secondary/85 px-3 py-2.5 backdrop-blur-sm"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-0.5 shrink-0 bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold leading-none text-primary">
                    {t("editingLabel")}
                  </p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-[14px] leading-[1.15] text-muted-foreground">
                    {editTarget?.text || t("replyFallback")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 rounded-full"
                  onClick={handleCancelEdit}
                >
                  <FiX className="size-4" />
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div layout transition={SPRING_LAYOUT} layoutId="composer-input-shell">
          <Controller
            control={form.control}
            name="text"
            render={({ field }) => (
              <Field className="flex-1">
                <EmojiInput
                  placeholder={t("placeholder")}
                  className={cn(
                    "max-w-none",
                    (isReplying || isEditing) && "rounded-t-none border-t-0",
                  )}
                  disabled={isBlockedByCurrentUser || isBlockedByPeer}
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
                  focusToken={inputFocusToken}
                  onSubmit={() => {
                    void form.handleSubmit(onSubmit)();
                  }}
                  submitOnEnter={sendShortcut === "enter"}
                  onKeyDown={(event) => {
                    if (
                      sendShortcut === "ctrl-enter" &&
                      event.key === "Enter" &&
                      event.ctrlKey
                    ) {
                      event.preventDefault();
                      void form.handleSubmit(onSubmit)();
                    }
                  }}
                  rightSlot={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 rounded-full [&_svg]:size-5"
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={
                        isEditing ||
                        isBlockedByCurrentUser ||
                        isBlockedByPeer
                      }
                    >
                      <FiPaperclip />
                    </Button>
                  }
                />
              </Field>
            )}
          />
        </motion.div>

        {isBlockedByCurrentUser ? (
          <p className="px-2 pt-1 text-xs text-destructive/90">{t("blockedHint")}</p>
        ) : null}

        {isBlockedByPeer ? (
          <p className="px-2 pt-1 text-xs text-destructive/90">{t("blockedByPeerHint")}</p>
        ) : null}
      </motion.div>

      <input
        ref={attachmentInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleSelectFiles}
      />

      <Button
        type="submit"
        className="size-12 shrink-0 rounded-full self-end [&_svg]:size-6"
        disabled={!canSubmit}
      >
        <AnimatePresence mode="wait" initial={false}>
          {textValue.trim().length > 0 || isEditing || hasAttachedMedia ? (
            <motion.div
              key={"text"}
              variants={swapYVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <HiPaperAirplane />
            </motion.div>
          ) : (
            <motion.div
              key={"audio"}
              variants={swapYVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <TiMicrophone />
            </motion.div>
          )}
        </AnimatePresence>
      </Button>
    </form>
  );
}
