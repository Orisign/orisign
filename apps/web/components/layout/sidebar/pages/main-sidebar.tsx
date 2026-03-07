"use client";

import { CreateConversationDropdown } from "@/components/user/create-conversation-dropdown";
import { UserDropdown } from "@/components/user/user-dropdown";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
} from "@/components/ui/sidebar-page";
import { Input } from "@repo/ui";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { ChatList } from "@/components/chat/chat-list";

export const MainSidebar = () => {
  const t = useTranslations("appShell");

  return (
    <SidebarPage className="h-full">
      <SidebarPageHeader className="gap-3">
        <UserDropdown />
        <Input
          leftSlot={<Search className="size-5" />}
          placeholder={t("searchPlaceholder")}
        />
      </SidebarPageHeader>

      <SidebarPageContent>
        <ChatList />
      </SidebarPageContent>

      <CreateConversationDropdown />
    </SidebarPage>
  );
};
