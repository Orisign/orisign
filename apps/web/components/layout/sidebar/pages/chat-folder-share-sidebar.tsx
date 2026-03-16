"use client";

import { useConversationsControllerMy } from "@/api/generated";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
  SidebarPageSeparator,
  SidebarPageTitle,
} from "@/components/ui/sidebar-page";
import { useChatFolders, useUpdateChatFolder } from "@/hooks/use-chat-folders";
import { useSidebar } from "@/hooks/use-sidebar";
import {
  getConversationAvatarUrl,
  getConversationInitial,
  getConversationTitle,
} from "@/lib/chat";
import type { SidebarRoute } from "@/store/sidebar/sidebar-state.types";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  FolderOpen,
  Link2,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";

function createInviteLink(folderId: string) {
  const token = Math.random().toString(36).slice(2, 14);
  return `t.me/addlist/${folderId.replace("folder-", "")}${token}`;
}

export function ChatFolderShareSidebar({
  route,
}: {
  route: Extract<SidebarRoute, { screen: "chat-folder-share" }>;
}) {
  const t = useTranslations("chatFoldersShareSidebar");
  const { pop } = useSidebar();
  const { data: foldersData } = useChatFolders();
  const { mutateAsync: updateFolder } = useUpdateChatFolder();
  const { data } = useConversationsControllerMy();

  const folder = (foldersData?.folders ?? []).find((item) => item.id === route.folderId);
  const conversations = data?.conversations ?? [];
  const selectedConversations = conversations.filter((conversation) =>
    (folder?.includedChatIds ?? []).includes(conversation.id),
  );

  const inviteLink =
    folder?.inviteLink ?? (folder ? createInviteLink(folder.id) : "t.me/addlist/example");

  async function saveInviteLink(nextInviteLink: string | undefined) {
    if (!folder) {
      return;
    }

    await updateFolder({
      folderId: folder.id,
      payload: {
        name: folder.name,
        includedChatIds: folder.includedChatIds,
        excludedChatIds: folder.excludedChatIds,
        includedTypes: folder.includedTypes,
        excludedTypes: folder.excludedTypes,
        inviteLink: nextInviteLink ?? "",
        sortOrder: folder.sortOrder,
      },
    });
  }

  return (
    <SidebarPage>
      <SidebarPageHeader className="justify-start gap-3">
        <Button onClick={pop} variant="ghost" size="icon" className="rounded-full">
          <ArrowLeft strokeWidth={3} className="size-6" />
        </Button>
        <SidebarPageTitle>{t("title")}</SidebarPageTitle>
      </SidebarPageHeader>

      <SidebarPageContent className="items-center gap-4 pb-4 pt-5 text-center">
        <div className="inline-flex rounded-3xl bg-accent px-6 py-5">
          <FolderOpen className="size-14 text-primary" />
        </div>

        <p className="max-w-[22rem] text-lg text-muted-foreground">{t("description")}</p>
      </SidebarPageContent>

      <SidebarPageSeparator />

      <SidebarPageContent className="gap-3 pb-4">
        <p className="px-1 text-xl font-semibold text-primary">{t("inviteLinkLabel")}</p>
        <div className="flex items-center rounded-xl border-2 border-border/60 bg-secondary/80 px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-[1.2rem] font-semibold">{inviteLink}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <MoreVertical className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  await saveInviteLink(inviteLink);
                  await navigator.clipboard.writeText(inviteLink);
                }}
              >
                <Copy className="size-4" />
                {t("copyLink")}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={async () => {
                  await saveInviteLink(undefined);
                }}
              >
                <Trash2 className="size-4" />
                {t("removeLink")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button
          className="h-12 text-xl font-semibold"
          onClick={async () => {
            await saveInviteLink(inviteLink);
            await navigator.clipboard.writeText(inviteLink);
          }}
        >
          <Link2 className="size-5" />
          {t("shareLink")}
        </Button>
      </SidebarPageContent>

      <SidebarPageSeparator />

      <SidebarPageContent className="gap-1 pb-4">
        <p className="px-1 text-xl font-semibold text-primary">
          {t("selectedChats", { count: selectedConversations.length })}
        </p>

        {selectedConversations.map((conversation) => {
          const avatarUrl = getConversationAvatarUrl(conversation);
          return (
            <div
              key={conversation.id}
              className="flex items-center justify-between rounded-xl px-2 py-2"
            >
              <div className="inline-flex min-w-0 items-center gap-3">
                <Avatar size="lg">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                  <AvatarFallback>{getConversationInitial(conversation)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-[1.2rem] font-semibold">
                    {getConversationTitle(conversation)}
                  </p>
                  <p className="text-base text-muted-foreground">{t("subscribersLabel")}</p>
                </div>
              </div>
              <CheckCircle2 className="size-5 text-primary" />
            </div>
          );
        })}

        {selectedConversations.length === 0 ? (
          <p className="px-1 text-base text-muted-foreground">{t("emptySelection")}</p>
        ) : null}
      </SidebarPageContent>
    </SidebarPage>
  );
}
