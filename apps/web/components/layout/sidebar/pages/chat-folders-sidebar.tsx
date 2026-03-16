"use client";

import { SECTION_BUTTON_CLASSNAME } from "@/components/shared/shared.constants";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
  SidebarPageSeparator,
  SidebarPageTitle,
} from "@/components/ui/sidebar-page";
import {
  useChatFolders,
  useReorderChatFolders,
} from "@/hooks/use-chat-folders";
import { useSidebar } from "@/hooks/use-sidebar";
import type { ChatFolder } from "@/lib/chat-folders";
import { Button, Ripple, cn } from "@repo/ui";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { isSortableOperation, useSortable } from "@dnd-kit/react/sortable";
import { ArrowLeft, GripVertical, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { type ComponentProps, useMemo, useState } from "react";

const FOLDERS_DND_GROUP = "chat-folders";
const LottiePlayer = dynamic(
  () => import("@lottiefiles/react-lottie-player").then((module) => module.Player),
  { ssr: false },
);
type DragEndPayload = Parameters<
  NonNullable<ComponentProps<typeof DragDropProvider>["onDragEnd"]>
>[0];

function SortableFolderRow({
  folder,
  index,
  subtitle,
  onOpen,
}: {
  folder: ChatFolder;
  index: number;
  subtitle: string;
  onOpen: () => void;
}) {
  const { ref, handleRef, isDragSource, isDropTarget } = useSortable({
    id: folder.id,
    index,
    group: FOLDERS_DND_GROUP,
    transition: {
      duration: 170,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  });

  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded-xl transition-all duration-150",
        isDragSource && "z-10 scale-[0.985] opacity-70",
        isDropTarget && !isDragSource && "bg-primary/15",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-x-2 top-0 h-px rounded-full bg-primary transition-all duration-150",
          isDropTarget && !isDragSource
            ? "scale-x-100 opacity-100"
            : "scale-x-95 opacity-0",
        )}
      />

      <Ripple
        className={cn(SECTION_BUTTON_CLASSNAME, "w-full rounded-xl")}
        onClick={onOpen}
      >
        <div className="flex items-center gap-3">
          <button
            ref={handleRef}
            type="button"
            aria-label="Drag folder"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            className={cn(
              "inline-flex size-6 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground",
              "cursor-grab active:cursor-grabbing",
              isDragSource && "text-primary",
            )}
          >
            <GripVertical
              className={cn("size-4", isDragSource && "rotate-6")}
            />
          </button>

          <div className="min-w-0">
            <p className="truncate text-[1.2rem] font-semibold leading-tight">
              {folder.name}
            </p>
            <p className="truncate text-base text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>
      </Ripple>
    </div>
  );
}

export const ChatFoldersSidebar = () => {
  const t = useTranslations("chatFoldersSidebar");
  const { pop, push, sidebarWidth } = useSidebar();
  const { data } = useChatFolders();
  const { mutate: reorderFolders } = useReorderChatFolders();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const dragOverlayWidth = Math.min(416, Math.max(sidebarWidth - 40, 180));

  const folders = useMemo(() => {
    return [...(data?.folders ?? [])].sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.createdAt - right.createdAt,
    );
  }, [data?.folders]);

  const activeFolder = useMemo(
    () => folders.find((folder) => folder.id === activeFolderId) ?? null,
    [folders, activeFolderId],
  );

  function reorderLocallyAndPersistByIndex(fromIndex: number, toIndex: number) {
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) {
      return;
    }

    const folderIds = folders.map((folder) => folder.id);
    const lastIndex = folderIds.length - 1;
    const safeFromIndex = Math.max(0, Math.min(fromIndex, lastIndex));
    const safeToIndex = Math.max(0, Math.min(toIndex, lastIndex));

    if (safeFromIndex === safeToIndex) {
      return;
    }

    const nextOrder = [...folderIds];
    const [movedId] = nextOrder.splice(safeFromIndex, 1);
    nextOrder.splice(safeToIndex, 0, movedId);

    reorderFolders({ folderIds: nextOrder });
  }

  function handleDragEnd(event: DragEndPayload) {
    setActiveFolderId(null);

    if (event.canceled) {
      return;
    }

    if (isSortableOperation(event.operation)) {
      const sortableSource = event.operation.source;
      if (!sortableSource) {
        return;
      }

      const fromIndex = sortableSource.initialIndex;
      const targetIndex =
        typeof event.operation.target?.index === "number"
          ? event.operation.target.index
          : null;
      const toIndex =
        targetIndex !== null && targetIndex !== fromIndex
          ? targetIndex
          : sortableSource.index;

      reorderLocallyAndPersistByIndex(fromIndex, toIndex);
      return;
    }

    const fromId = event.operation.source?.id;
    const toId = event.operation.target?.id;

    if (fromId == null || toId == null || String(fromId) === String(toId)) {
      return;
    }

    const folderIds = folders.map((folder) => folder.id);
    const fromIndex = folderIds.indexOf(String(fromId));
    const toIndex = folderIds.indexOf(String(toId));

    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    reorderLocallyAndPersistByIndex(fromIndex, toIndex);
  }

  return (
    <SidebarPage>
      <SidebarPageHeader className="justify-start gap-3">
        <Button
          onClick={pop}
          variant="ghost"
          size="icon"
          className="rounded-full"
        >
          <ArrowLeft strokeWidth={3} className="size-6" />
        </Button>
        <SidebarPageTitle>{t("title")}</SidebarPageTitle>
      </SidebarPageHeader>

      <SidebarPageContent className="items-center gap-4 pb-6 pt-5 text-center">
        <LottiePlayer
          autoplay
          loop
          src={
            "https://chi2l3s.github.io/lottie-animations/folder%20not%20found.json"
          }
          className="size-28"
        />

        <p className="max-w-[20rem] text-lg text-muted-foreground">
          {t("description")}
        </p>

        <Button
          onClick={() => push({ screen: "chat-folder-edit" })}
          className="h-12 rounded-full px-6 text-xl font-semibold"
        >
          <Plus className="size-5" />
          {t("newFolder")}
        </Button>
      </SidebarPageContent>

      <SidebarPageSeparator />

      <SidebarPageContent className="gap-1 pb-4">
        <p className="px-1 text-xl font-semibold text-primary">
          {t("foldersLabel")}
        </p>
        {activeFolderId ? (
          <p className="px-1 pb-1 text-sm font-medium text-muted-foreground">
            {t("dragHint")}
          </p>
        ) : null}

        {folders.length === 0 ? (
          <p className="px-1 text-base text-muted-foreground">{t("empty")}</p>
        ) : null}

        <DragDropProvider
          onDragStart={(event) => {
            const sourceId = event.operation.source?.id;
            setActiveFolderId(sourceId != null ? String(sourceId) : null);
          }}
          onDragEnd={handleDragEnd}
        >
          {folders.map((folder, index) => {
            const subtitle = t("customFolderSummary", {
              included: folder.includedChatIds.length,
              excluded: folder.excludedChatIds.length,
            });

            return (
              <SortableFolderRow
                key={folder.id}
                folder={folder}
                index={index}
                subtitle={subtitle}
                onOpen={() =>
                  push({ screen: "chat-folder-edit", folderId: folder.id })
                }
              />
            );
          })}

          <DragOverlay
            className="pointer-events-none z-50"
            dropAnimation={null}
          >
            {activeFolder ? (
              <div
                className="rounded-xl bg-accent/95 px-3 py-3"
                style={{ width: dragOverlayWidth }}
              >
                <div className="flex items-center gap-3">
                  <div className="inline-flex size-6 items-center justify-center rounded-md text-primary">
                    <GripVertical className="size-4 rotate-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[1.2rem] font-semibold leading-tight">
                      {activeFolder.name}
                    </p>
                    <p className="truncate text-base text-muted-foreground">
                      {t("customFolderSummary", {
                        included: activeFolder.includedChatIds.length,
                        excluded: activeFolder.excludedChatIds.length,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DragDropProvider>
      </SidebarPageContent>
    </SidebarPage>
  );
};
