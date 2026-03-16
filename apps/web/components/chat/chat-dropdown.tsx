"use client";

import { useConversationsControllerLeave } from "@/api/generated";
import { useSetChatBlock } from "@/hooks/use-chat-block";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@repo/ui";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PropsWithChildren, useState } from "react";
import { FiSlash } from "react-icons/fi";
import { LuBellOff } from "react-icons/lu";
import { PiTrashSimple } from "react-icons/pi";
import { TbVideo } from "react-icons/tb";

export function ChatDropdown({
  children,
  conversationId,
  isDirect = false,
  directPeerId,
  isPeerBlockedByCurrentUser = false,
  onTogglePeerBlock,
  isTogglingPeerBlock = false,
}: PropsWithChildren & {
  conversationId: string;
  isDirect?: boolean;
  directPeerId?: string;
  isPeerBlockedByCurrentUser?: boolean;
  onTogglePeerBlock?: () => void;
  isTogglingPeerBlock?: boolean;
}) {
  const t = useTranslations("chat.dropdown");
  const router = useRouter();
  const { mutateAsync: leave, isPending: isLeaving } = useConversationsControllerLeave();
  const { mutateAsync: setUserBlock, isPending: isSetBlockPending } = useSetChatBlock();
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [deleteChatOnBlock, setDeleteChatOnBlock] = useState(false);
  const isBlockActionPending = isTogglingPeerBlock || isSetBlockPending || isLeaving;

  async function onLeave() {
    try {
      await leave({
        data: {
          conversationId,
        },
      });
      router.push("/");
    } catch {
      toast({
        title: t("deleteChatError"),
        type: "error",
      });
    }
  }

  async function handleToggleBlock() {
    if (!directPeerId || isBlockActionPending) return;

    try {
      if (isPeerBlockedByCurrentUser) {
        await setUserBlock({
          targetUserId: directPeerId,
          blocked: false,
        });
      } else {
        setIsBlockDialogOpen(true);
        return;
      }

      onTogglePeerBlock?.();
    } catch {
      toast({
        title: t("blockError"),
        type: "error",
      });
    }
  }

  async function handleConfirmBlock() {
    if (!directPeerId || isBlockActionPending) return;

    try {
      await setUserBlock({
        targetUserId: directPeerId,
        blocked: true,
      });
      onTogglePeerBlock?.();

      if (deleteChatOnBlock) {
        await onLeave();
      }

      setIsBlockDialogOpen(false);
      setDeleteChatOnBlock(false);
    } catch {
      toast({
        title: t("blockError"),
        type: "error",
      });
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <LuBellOff />
            {t("mute")}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <TbVideo />
            {t("startVideoChat")}
          </DropdownMenuItem>
          {isDirect && directPeerId ? (
            <DropdownMenuItem
              onClick={() => void handleToggleBlock()}
              disabled={isBlockActionPending}
            >
              <FiSlash />
              {isPeerBlockedByCurrentUser ? t("unblock") : t("block")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem variant="destructive" onClick={() => void onLeave()}>
            <PiTrashSimple />
            {isDirect ? t("deleteChat") : t("leave")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={isBlockDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsBlockDialogOpen(nextOpen);
          if (!nextOpen) {
            setDeleteChatOnBlock(false);
          }
        }}
      >
        <DialogContent className="max-w-[28rem]">
          <DialogHeader>
            <DialogTitle>{t("blockDialog.title")}</DialogTitle>
            <DialogDescription>{t("blockDialog.description")}</DialogDescription>
          </DialogHeader>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={deleteChatOnBlock}
              onCheckedChange={(checked) => setDeleteChatOnBlock(Boolean(checked))}
            />
            <span>{t("blockDialog.deleteChatCheckbox")}</span>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsBlockDialogOpen(false);
                setDeleteChatOnBlock(false);
              }}
              disabled={isBlockActionPending}
            >
              {t("blockDialog.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmBlock()}
              disabled={isBlockActionPending}
            >
              {t("blockDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
