"use client";

import { SECTION_BUTTON_CLASSNAME } from "@/components/shared/shared.constants";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
  SidebarPageTitle,
} from "@/components/ui/sidebar-page";
import { EmojiInput } from "@/components/ui/emoji-input";
import {
  useChatFolders,
  useCreateChatFolder,
  useDeleteChatFolder,
  useUpdateChatFolder,
} from "@/hooks/use-chat-folders";
import { useSidebar } from "@/hooks/use-sidebar";
import { CHAT_FOLDER_DRAFT_ID } from "@/lib/chat-folders";
import {
  createChatFolderEditorSchema,
  type TypeChatFolderEditorSchema,
} from "@/schemas/chat/chat-folder-editor.schema";
import type { SidebarRoute } from "@/store/sidebar/sidebar-state.types";
import { useChatFolderDraftStore } from "@/store/chat-folder-draft.store";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
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
  Ripple,
  cn,
} from "@repo/ui";
import { ArrowLeft, Check, EllipsisVertical, Folder, Minus, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

export function ChatFolderEditorSidebar({
  route,
}: {
  route: Extract<SidebarRoute, { screen: "chat-folder-edit" }>;
}) {
  const t = useTranslations("chatFoldersEditorSidebar");
  const { pop, push } = useSidebar();
  const { data } = useChatFolders();
  const { mutateAsync: createFolder, isPending: isCreating } = useCreateChatFolder();
  const { mutateAsync: updateFolder, isPending: isUpdating } = useUpdateChatFolder();
  const { mutateAsync: deleteFolder, isPending: isDeleting } = useDeleteChatFolder();
  const draft = useChatFolderDraftStore((state) => state.draft);
  const initDraft = useChatFolderDraftStore((state) => state.initDraft);
  const setDraftName = useChatFolderDraftStore((state) => state.setName);
  const clearDraft = useChatFolderDraftStore((state) => state.clearDraft);

  const existingFolder = useMemo(
    () => (data?.folders ?? []).find((folder) => folder.id === route.folderId),
    [data?.folders, route.folderId],
  );

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const schema = useMemo(
    () => createChatFolderEditorSchema((key) => t(`errors.${key}`)),
    [t],
  );
  const form = useForm<TypeChatFolderEditorSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existingFolder?.name ?? draft?.name ?? "",
    },
  });
  const { control, formState, handleSubmit, getValues, reset } = form;
  const currentNameValue = useWatch({ control, name: "name" }) ?? "";
  const normalizedName = currentNameValue.trim();

  const selectedIncludedCount = existingFolder
    ? existingFolder.includedChatIds.length
    : (draft?.includedChatIds.length ?? 0);
  const selectedExcludedCount = existingFolder
    ? existingFolder.excludedChatIds.length
    : (draft?.excludedChatIds.length ?? 0);
  const canShare = Boolean(existingFolder?.id);
  const isPending = isCreating || isUpdating || isDeleting;
  const isExistingFolderDirty = Boolean(existingFolder) && formState.isDirty;
  const shouldShowSaveAction = !existingFolder || isExistingFolderDirty;

  useEffect(() => {
    if (existingFolder) {
      reset({ name: existingFolder.name });
      clearDraft();
      return;
    }

    initDraft();
  }, [clearDraft, existingFolder, initDraft, reset]);

  useEffect(() => {
    if (!existingFolder) {
      setDraftName(currentNameValue);
    }
  }, [currentNameValue, existingFolder, setDraftName]);

  async function ensureFolderId() {
    if (existingFolder) {
      return existingFolder.id;
    }

    initDraft(getValues("name"));
    return CHAT_FOLDER_DRAFT_ID;
  }

  const handleSave = handleSubmit(async (values) => {
    if (isPending) {
      return;
    }
    const nextName = values.name.trim();

    if (existingFolder) {
      await updateFolder({
        folderId: existingFolder.id,
        payload: {
          name: nextName,
          includedChatIds: existingFolder.includedChatIds ?? [],
          excludedChatIds: existingFolder.excludedChatIds ?? [],
          includedTypes: existingFolder.includedTypes ?? [],
          excludedTypes: existingFolder.excludedTypes ?? [],
          inviteLink: existingFolder.inviteLink,
          sortOrder: existingFolder.sortOrder,
        },
      });
      reset({ name: nextName });
      pop();
      return;
    }

    await createFolder({
      name: nextName,
      includedChatIds: draft?.includedChatIds ?? [],
      excludedChatIds: draft?.excludedChatIds ?? [],
      includedTypes: draft?.includedTypes ?? [],
      excludedTypes: draft?.excludedTypes ?? [],
      inviteLink: draft?.inviteLink,
    });
    clearDraft();
    pop();
  });

  async function handleDeleteFolder() {
    if (!existingFolder || isDeleting) {
      return;
    }

    await deleteFolder(existingFolder.id);
    setIsDeleteDialogOpen(false);
    pop();
  }

  function handleBack() {
    if (!existingFolder) {
      clearDraft();
    }

    pop();
  }

  return (
    <SidebarPage className="gap-4">
      <SidebarPageHeader>
        <div className="flex items-center gap-3">
          <Button onClick={handleBack} variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft strokeWidth={3} className="size-6" />
          </Button>
          <SidebarPageTitle>
            {existingFolder ? t("titleEdit") : t("titleNew")}
          </SidebarPageTitle>
        </div>
        <div className="flex items-center gap-1">
          {shouldShowSaveAction && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-primary disabled:text-muted-foreground"
              disabled={normalizedName.length === 0 || isPending}
              onClick={() => void handleSave()}
            >
              <Check className="size-6" strokeWidth={3} />
            </Button>
          )}
          {!shouldShowSaveAction && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <EllipsisVertical className="size-6" strokeWidth={3} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="size-4" />
                  {t("deleteFolderAction")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </SidebarPageHeader>

      <SidebarPageContent className="gap-0 px-0">
        <div className="w-full bg-accent px-4 py-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="inline-flex rounded-3xl bg-background/60 px-6 py-5">
              <Folder className="size-14 text-primary" />
            </div>

            <p className="text-base text-muted-foreground">{t("description")}</p>
          </div>

          <div className="pt-4">
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <EmojiInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  placeholder={t("folderNamePlaceholder")}
                  showEmojiPicker
                  submitOnEnter={false}
                  aria-label={t("folderNamePlaceholder")}
                />
              )}
            />
            {formState.errors.name?.message ? (
              <p className="pt-2 text-sm text-destructive">{formState.errors.name.message}</p>
            ) : null}
          </div>
        </div>
      </SidebarPageContent>

      <SidebarPageContent className="gap-0 px-0 pb-4">
        <div className="w-full bg-accent px-3 py-3">
          <p className="px-1 text-lg font-semibold text-primary">{t("includedChats")}</p>
          <Ripple
            className={cn(SECTION_BUTTON_CLASSNAME, "mt-2 w-full rounded-xl bg-background/45")}
            onClick={async () => {
              const folderId = await ensureFolderId();
              push({
                screen: "chat-folder-chats",
                folderId,
                mode: "included",
              });
            }}
          >
            <div className="flex items-center gap-3">
              <Plus className="size-5 text-primary" />
              <span className="text-lg font-semibold text-primary">{t("addChats")}</span>
            </div>
          </Ripple>
          <p className="px-1 pt-2 text-sm text-muted-foreground">
            {selectedIncludedCount > 0
              ? t("selectedChatsCount", { count: selectedIncludedCount })
              : t("includedDescription")}
          </p>
        </div>

        <div className="mt-2 w-full bg-accent px-3 py-3">
          <p className="px-1 text-lg font-semibold text-primary">{t("excludedChats")}</p>
          <Ripple
            className={cn(SECTION_BUTTON_CLASSNAME, "mt-2 w-full rounded-xl bg-background/45")}
            onClick={async () => {
              const folderId = await ensureFolderId();
              push({
                screen: "chat-folder-chats",
                folderId,
                mode: "excluded",
              });
            }}
          >
            <div className="flex items-center gap-3">
              <Minus className="size-5 text-primary" />
              <span className="text-lg font-semibold text-primary">
                {t("addExclusions")}
              </span>
            </div>
          </Ripple>
          <p className="px-1 pt-2 text-sm text-muted-foreground">
            {selectedExcludedCount > 0
              ? t("excludedChatsCount", { count: selectedExcludedCount })
              : t("excludedDescription")}
          </p>
        </div>

        <div className="mt-2 w-full bg-accent px-3 py-3">
          <p className="px-1 text-lg font-semibold text-primary">{t("inviteLinks")}</p>
          <Ripple
            className={cn(
              SECTION_BUTTON_CLASSNAME,
              "mt-2 w-full rounded-xl bg-background/45",
              !canShare && "cursor-not-allowed opacity-70",
            )}
            onClick={async () => {
              if (!canShare || !existingFolder) {
                return;
              }

              const folderId = await ensureFolderId();
              push({ screen: "chat-folder-share", folderId });
            }}
          >
            <div className="flex items-center gap-3">
              <Plus className="size-5 text-primary" />
              <span
                className={cn(
                  "text-lg font-semibold",
                  canShare ? "text-primary" : "text-muted-foreground",
                )}
              >
                {t("createLink")}
              </span>
            </div>
          </Ripple>
          <p className="px-1 pt-2 text-sm text-muted-foreground">{t("inviteDescription")}</p>
        </div>
      </SidebarPageContent>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-border/60 bg-background p-5">
          <DialogHeader>
            <DialogTitle className="text-xl">{t("deleteDialogTitle")}</DialogTitle>
            <DialogDescription className="pt-1 text-base">
              {t("deleteDialogDescription", { name: existingFolder?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 flex-row justify-end gap-2 sm:space-x-0">
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>
              {t("deleteDialogCancel")}
            </Button>
            <Button variant="destructive" onClick={() => void handleDeleteFolder()}>
              {t("deleteDialogConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarPage>
  );
}
