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
import {
  useChatFolders,
  useUpdateChatFolder,
} from "@/hooks/use-chat-folders";
import { useSidebar } from "@/hooks/use-sidebar";
import {
  CHAT_FOLDER_DRAFT_ID,
  type ExcludedChatType,
  type IncludedChatType,
  type UpdateChatFolderPayload,
} from "@/lib/chat-folders";
import { useChatFolderDraftStore } from "@/store/chat-folder-draft.store";
import {
  CHAT_CONVERSATION_TYPE,
  getConversationAvatarUrl,
  getConversationInitial,
  getConversationSubtitle,
  getConversationTitle,
} from "@/lib/chat";
import type { SidebarRoute } from "@/store/sidebar/sidebar-state.types";
import { Button, Checkbox, Input, cn } from "@repo/ui";
import {
  Archive,
  ArrowLeft,
  BellOff,
  Bot,
  Check,
  Megaphone,
  MessageSquareCheck,
  UserRound,
  UserRoundPlus,
  Users,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type ComponentType } from "react";

const INCLUDED_TYPE_META: Array<{
  id: IncludedChatType;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: "contacts", icon: UserRound },
  { id: "nonContacts", icon: UserRoundPlus },
  { id: "groups", icon: Users },
  { id: "channels", icon: Megaphone },
  { id: "bots", icon: Bot },
];

const EXCLUDED_TYPE_META: Array<{
  id: ExcludedChatType;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: "muted", icon: BellOff },
  { id: "archived", icon: Archive },
  { id: "read", icon: MessageSquareCheck },
];

export function ChatFolderChatsSidebar({
  route,
}: {
  route: Extract<SidebarRoute, { screen: "chat-folder-chats" }>;
}) {
  const t = useTranslations("chatFoldersChatsSidebar");
  const { pop } = useSidebar();
  const { data: foldersData } = useChatFolders();
  const { mutate: updateFolder } = useUpdateChatFolder();
  const draft = useChatFolderDraftStore((state) => state.draft);
  const initDraft = useChatFolderDraftStore((state) => state.initDraft);
  const patchDraft = useChatFolderDraftStore((state) => state.patchDraft);
  const { data } = useConversationsControllerMy();
  const [query, setQuery] = useState("");

  const folder = useMemo(
    () => (foldersData?.folders ?? []).find((item) => item.id === route.folderId),
    [foldersData?.folders, route.folderId],
  );
  const isDraftFolder = route.folderId === CHAT_FOLDER_DRAFT_ID && !folder;

  useEffect(() => {
    if (isDraftFolder && !draft) {
      initDraft("");
    }
  }, [draft, initDraft, isDraftFolder]);

  const isIncludedMode = route.mode === "included";

  const includedTypes = folder?.includedTypes ?? draft?.includedTypes ?? [];
  const excludedTypes = folder?.excludedTypes ?? draft?.excludedTypes ?? [];
  const selectedTypeIds = isIncludedMode ? includedTypes : excludedTypes;
  const selectedChatIds = useMemo(
    () =>
      isIncludedMode
        ? (folder?.includedChatIds ?? draft?.includedChatIds ?? [])
        : (folder?.excludedChatIds ?? draft?.excludedChatIds ?? []),
    [draft?.excludedChatIds, draft?.includedChatIds, folder, isIncludedMode],
  );

  const typeMeta = isIncludedMode ? INCLUDED_TYPE_META : EXCLUDED_TYPE_META;
  const conversations = useMemo(() => data?.conversations ?? [], [data?.conversations]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return conversations;

    return conversations.filter((conversation) => {
      const title = getConversationTitle(conversation).toLowerCase();
      const subtitle = getConversationSubtitle(conversation).toLowerCase();
      return title.includes(normalizedQuery) || subtitle.includes(normalizedQuery);
    });
  }, [conversations, query]);

  const selectedChatChips = useMemo(
    () =>
      conversations.filter((conversation) =>
        selectedChatIds.includes(conversation.id),
      ),
    [conversations, selectedChatIds],
  );

  function persistFolder(patch: UpdateChatFolderPayload) {
    if (folder) {
      const payload: UpdateChatFolderPayload = {
        name: patch.name ?? folder.name,
        includedChatIds: patch.includedChatIds ?? folder.includedChatIds ?? [],
        excludedChatIds: patch.excludedChatIds ?? folder.excludedChatIds ?? [],
        includedTypes: patch.includedTypes ?? folder.includedTypes ?? [],
        excludedTypes: patch.excludedTypes ?? folder.excludedTypes ?? [],
        inviteLink: patch.inviteLink ?? folder.inviteLink,
        sortOrder: patch.sortOrder ?? folder.sortOrder,
      };

      updateFolder({
        folderId: folder.id,
        payload,
      });
      return;
    }

    if (!isDraftFolder) {
      return;
    }

    patchDraft({
      name: patch.name ?? draft?.name ?? "",
      includedChatIds: patch.includedChatIds ?? draft?.includedChatIds ?? [],
      excludedChatIds: patch.excludedChatIds ?? draft?.excludedChatIds ?? [],
      includedTypes: patch.includedTypes ?? draft?.includedTypes ?? [],
      excludedTypes: patch.excludedTypes ?? draft?.excludedTypes ?? [],
      inviteLink: patch.inviteLink ?? draft?.inviteLink,
    });
  }

  function toggleType(id: IncludedChatType | ExcludedChatType, checked: boolean) {
    if (!folder && !isDraftFolder) return;

    if (isIncludedMode) {
      const nextTypes = checked
        ? [...includedTypes, id as IncludedChatType]
        : includedTypes.filter((typeId) => typeId !== id);
      persistFolder({ includedTypes: nextTypes });
      return;
    }

    const nextTypes = checked
      ? [...excludedTypes, id as ExcludedChatType]
      : excludedTypes.filter((typeId) => typeId !== id);
    persistFolder({ excludedTypes: nextTypes });
  }

  function toggleChat(chatId: string, checked: boolean) {
    if (!folder && !isDraftFolder) return;
    const current = isIncludedMode
      ? (folder?.includedChatIds ?? draft?.includedChatIds ?? [])
      : (folder?.excludedChatIds ?? draft?.excludedChatIds ?? []);
    const next = checked
      ? [...current, chatId]
      : current.filter((existingChatId) => existingChatId !== chatId);

    persistFolder(isIncludedMode ? { includedChatIds: next } : { excludedChatIds: next });
  }

  function removeSelectedChat(chatId: string) {
    if (!folder && !isDraftFolder) return;
    const next = selectedChatIds.filter((id) => id !== chatId);
    persistFolder(isIncludedMode ? { includedChatIds: next } : { excludedChatIds: next });
  }

  return (
    <SidebarPage>
      <SidebarPageHeader>
        <div className="flex items-center gap-3">
          <Button onClick={pop} variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft strokeWidth={3} className="size-6" />
          </Button>
          <SidebarPageTitle>
            {isIncludedMode ? t("titleInFolder") : t("titleNotInFolder")}
          </SidebarPageTitle>
        </div>
        <Button onClick={pop} variant="ghost" size="icon" className="rounded-full text-primary">
          <Check strokeWidth={3} className="size-6" />
        </Button>
      </SidebarPageHeader>

      <SidebarPageContent className="gap-2 pb-3">
        {selectedChatChips.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {selectedChatChips.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => removeSelectedChat(conversation.id)}
                className="group inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-accent px-2 text-base font-semibold"
              >
                <span className="relative size-6 shrink-0">
                  <Avatar className="size-6 transition-all duration-200 group-hover:scale-90 group-hover:opacity-0">
                    {getConversationAvatarUrl(conversation) ? (
                      <AvatarImage src={getConversationAvatarUrl(conversation) ?? ""} alt="" />
                    ) : null}
                    <AvatarFallback>{getConversationInitial(conversation)}</AvatarFallback>
                  </Avatar>
                  <span className="absolute inset-0 inline-flex scale-90 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
                    <X className="size-3.5 transition-transform duration-300 group-hover:rotate-90" />
                  </span>
                </span>
                <span className="max-w-28 truncate">{getConversationTitle(conversation)}</span>
              </button>
            ))}
          </div>
        ) : null}

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          wrapperClassName="h-12"
        />
      </SidebarPageContent>

      <SidebarPageSeparator />

      <SidebarPageContent className="gap-1 pb-4">
        <p className="px-1 text-xl font-semibold text-primary">{t("chatTypes")}</p>

        {typeMeta.map(({ id, icon: Icon }) => {
          const checked = selectedTypeIds.includes(id as never);
          return (
            <button
              key={id}
              type="button"
              className="flex w-full items-center justify-between rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-accent/70"
              onClick={() => toggleType(id, !checked)}
            >
              <span className="inline-flex items-center gap-4">
                <Icon className="size-5 text-muted-foreground" />
                <span className="text-[1.2rem] font-semibold">{t(`types.${id}`)}</span>
              </span>
              <Checkbox checked={checked} className="rounded-full" />
            </button>
          );
        })}
      </SidebarPageContent>

      <SidebarPageSeparator />

      <SidebarPageContent className="gap-1 pb-4">
        <p className="px-1 text-xl font-semibold text-primary">{t("chats")}</p>

        {filteredConversations.map((conversation) => {
          const checked = selectedChatIds.includes(conversation.id);
          const avatarUrl = getConversationAvatarUrl(conversation);
          const subtitle =
            conversation.type === CHAT_CONVERSATION_TYPE.DM
              ? t("labels.private")
              : conversation.type === CHAT_CONVERSATION_TYPE.GROUP
                ? t("labels.groups")
                : t("labels.channels");

          return (
            <button
              key={conversation.id}
              type="button"
              className={cn(
                "group flex w-full items-center justify-between rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent/70",
                checked && "bg-accent/55",
              )}
              onClick={() => toggleChat(conversation.id, !checked)}
            >
              <span className="inline-flex min-w-0 items-center gap-3">
                <span className="relative size-10 shrink-0">
                  <Avatar
                    size="lg"
                    className={cn(
                      "transition-all duration-200",
                      checked && "group-hover:scale-90 group-hover:opacity-0",
                    )}
                  >
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                    <AvatarFallback>{getConversationInitial(conversation)}</AvatarFallback>
                  </Avatar>
                  {checked ? (
                    <span className="absolute inset-0 inline-flex scale-90 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
                      <X className="size-4 transition-transform duration-300 group-hover:rotate-90" />
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0">
                  <p className="truncate text-[1.2rem] font-semibold">
                    {getConversationTitle(conversation)}
                  </p>
                  <p className="truncate text-base text-muted-foreground">{subtitle}</p>
                </span>
              </span>
              <Checkbox checked={checked} className="rounded-full" />
            </button>
          );
        })}
      </SidebarPageContent>
    </SidebarPage>
  );
}
