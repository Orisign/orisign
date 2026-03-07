"use client";

import { useConversationsControllerLeave } from "@/api/generated";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PropsWithChildren } from "react";
import { LuBellOff } from "react-icons/lu";
import { PiTrashSimple } from "react-icons/pi";
import { TbVideo } from "react-icons/tb";

export function ChatDropdown({
  children,
  conversationId,
}: PropsWithChildren & { conversationId: string }) {
  const t = useTranslations("chat.dropdown");
  const router = useRouter();
  const { mutate: leave } = useConversationsControllerLeave({
    mutation: {
      onSuccess: () => {
        router.push("/");
      },
    },
  });

  function onLeave() {
    leave({
      data: {
        conversationId,
      },
    });
  }

  return (
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
        <DropdownMenuItem variant="destructive" onClick={onLeave}>
          <PiTrashSimple />
          {t("leave")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
