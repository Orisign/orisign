"use client";

import {
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  getConversationsControllerMyQueryKey,
  useMessagesControllerDelete,
} from "@/api/generated";
import { CHAT_MESSAGE_KIND, type ChatMessageDto } from "@/hooks/use-chat";
import {
  type ChatMessagesQueryData,
  bumpConversationQueryData,
  bumpConversationInListData,
  getChatMessagesQueryKey,
  getConversationQueryKey,
  removeChatMessageFromData,
} from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { type ReactNode, forwardRef, useMemo, useState } from "react";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";
import { FiCopy, FiCornerUpLeft, FiTrash2 } from "react-icons/fi";
import { toast } from "@repo/ui";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { getConversationParticipantVisual } from "@/lib/chat";
import { CheckCheck } from "lucide-react";
import {
  ChatMessageReadDialog,
  type ChatMessageReadReceipt,
} from "./chat-message-read-dialog";
import type { ChatReplyTarget } from "./chat.types";

const ChatMessageContextMenuContent = forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 max-h-(--radix-context-menu-content-available-height) min-w-32 overflow-y-auto overflow-x-hidden rounded-md bg-popover px-1.5 py-1 text-popover-foreground origin-[--radix-context-menu-content-transform-origin] [will-change:transform,opacity,filter] data-[state=open]:animate-[dropdown-in_280ms_cubic-bezier(.22,.8,.2,1)] data-[state=closed]:animate-[dropdown-out_200ms_cubic-bezier(.4,0,.2,1)]",
        className,
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
));
ChatMessageContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName;

const ChatMessageContextMenuItem = forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
    variant?: "default" | "destructive";
  }
>(({ className, variant = "default", children, ...props }, ref) => (
  <motion.div
    whileTap={{ scale: 0.95 }}
    transition={{ type: "spring", stiffness: 500, damping: 30 }}
  >
    <ContextMenuPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-5 rounded-md px-3 py-1.5 text-sm font-semibold outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:stroke-[2.5px] [&_svg]:size-5 [&_svg]:shrink-0",
        variant === "default" && "focus:bg-accent focus:text-accent-foreground",
        variant === "destructive" &&
          "text-destructive [&_svg]:text-destructive focus:bg-destructive/10 focus:text-destructive",
        className,
      )}
      {...props}
    >
      {children}
    </ContextMenuPrimitive.Item>
  </motion.div>
));
ChatMessageContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

interface ChatMessageContextMenuProps {
  conversationId: string;
  message: ChatMessageDto;
  canDelete: boolean;
  readReceipts?: ChatMessageReadReceipt[];
  onReply?: (message: ChatReplyTarget) => void;
  replyAuthorName: string;
  children: ReactNode;
}

export function ChatMessageContextMenu({
  children,
  message,
  conversationId,
  canDelete,
  readReceipts = [],
  onReply,
  replyAuthorName,
}: ChatMessageContextMenuProps) {
  const t = useTranslations("chat.messages.contextMenu");
  const queryClient = useQueryClient();
  const [isReadDialogOpen, setIsReadDialogOpen] = useState(false);

  const { mutate: deleteMessage, isPending } = useMessagesControllerDelete({
    mutation: {
      onSuccess: async () => {
        queryClient.setQueryData<ChatMessagesQueryData>(
          getChatMessagesQueryKey(conversationId),
          (currentData) =>
            removeChatMessageFromData(currentData, message.id),
        );

        queryClient.setQueryData<GetConversationResponseDto>(
          getConversationQueryKey(conversationId),
          (currentData) => bumpConversationQueryData(currentData, Date.now()),
        );

        queryClient.setQueriesData<ListMyConversationsResponseDto>(
          { queryKey: getConversationsControllerMyQueryKey() },
          (currentData) =>
            bumpConversationInListData(currentData, conversationId, Date.now()),
        );
      },
    },
  });

  const canCopy = message.text.trim().length > 0;
  const canViewReadReceipts = readReceipts.length > 0;
  const canReply = message.kind !== CHAT_MESSAGE_KIND.SYSTEM;
  const previewReadReceipts = useMemo(
    () => readReceipts.slice(0, 2),
    [readReceipts],
  );

  if (!canCopy && !canDelete && !canViewReadReceipts && !canReply) {
    return <>{children}</>;
  }

  async function onCopy() {
    if (!canCopy) return;

    await navigator.clipboard.writeText(message.text);
    toast({
      title: t("copied"),
      type: "info",
    });
  }

  function onDelete() {
    deleteMessage({
      data: {
        messageId: message.id,
      },
    });
  }

  function handleReply() {
    onReply?.({
      id: message.id,
      authorId: message.authorId,
      authorName: replyAuthorName,
      text: message.text,
    });
  }

  return (
    <>
      <ContextMenuPrimitive.Root>
        <ContextMenuPrimitive.Trigger asChild>
          {children}
        </ContextMenuPrimitive.Trigger>

        <ChatMessageContextMenuContent collisionPadding={12}>
          {canReply ? (
            <ChatMessageContextMenuItem onSelect={handleReply}>
              <FiCornerUpLeft />
              {t("reply")}
            </ChatMessageContextMenuItem>
          ) : null}

          {canCopy ? (
            <ChatMessageContextMenuItem onSelect={() => void onCopy()}>
              <FiCopy />
              {t("copy")}
            </ChatMessageContextMenuItem>
          ) : null}

          {canViewReadReceipts ? (
            <ChatMessageContextMenuItem onSelect={() => setIsReadDialogOpen(true)}>
              <CheckCheck />
              <span>{t("readBy", { count: readReceipts.length })}</span>
              <AvatarGroup className="ml-auto">
                {previewReadReceipts.map((receipt) => (
                  <Avatar
                    key={receipt.userId}
                    size="sm"
                    className={cn(
                      "ring-background",
                      !receipt.avatarUrl &&
                        getConversationParticipantVisual(
                          conversationId,
                          receipt.userId,
                        ).avatarClassName,
                    )}
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
                ))}
                {readReceipts.length > previewReadReceipts.length ? (
                  <AvatarGroupCount className="size-6 text-xs">
                    +{readReceipts.length - previewReadReceipts.length}
                  </AvatarGroupCount>
                ) : null}
              </AvatarGroup>
            </ChatMessageContextMenuItem>
          ) : null}

          {canDelete ? (
            <ChatMessageContextMenuItem
              variant="destructive"
              disabled={isPending}
              onSelect={onDelete}
            >
              <FiTrash2 />
              {t("delete")}
            </ChatMessageContextMenuItem>
          ) : null}
        </ChatMessageContextMenuContent>
      </ContextMenuPrimitive.Root>

      <ChatMessageReadDialog
        conversationId={conversationId}
        open={isReadDialogOpen}
        onOpenChange={setIsReadDialogOpen}
        readReceipts={readReceipts}
      />
    </>
  );
}
