"use client";

import { CreateConversationDropdown } from "@/components/user/create-conversation-dropdown";
import { UserDropdown } from "@/components/user/user-dropdown";
import { Input } from "@repo/ui";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

export const MainSidebar = () => {
  const t = useTranslations("appShell");

  return (
    <>
      <div className="flex w-full items-center justify-between gap-3 px-5">
        <UserDropdown />
        <Input
          leftSlot={<Search className="size-5" />}
          placeholder={t("searchPlaceholder")}
        />
      </div>

      <CreateConversationDropdown />
    </>
  );
};
