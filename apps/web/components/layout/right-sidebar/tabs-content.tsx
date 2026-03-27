"use client";

import { ChatMessageLinkPreview } from "@/components/chat/chat-message-link-preview";
import {
  getMediaLabel,
  getUserDisplayName,
} from "@/lib/chat";
import { stripMessageFormatting } from "@/lib/chat-message-format";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, Skeleton, Ripple } from "@repo/ui";
import { AnimatePresence, motion } from "motion/react";
import { Fragment } from "react";
import {
  FiCopy,
  FiDownload,
  FiExternalLink,
} from "react-icons/fi";
import {
  IoDocumentTextOutline,
  IoLinkOutline,
} from "react-icons/io5";
import { RIGHT_SIDEBAR_TAB } from "@/store/right-sidebar/right-sidebar.types";
import { CHAT_MEDIA_KIND } from "@/lib/chat";
import { RightSidebarItemContextMenu } from "./primitives";
import type { RightSidebarTabsProps } from "./types";
import { RightSidebarVoiceRow } from "./voice-row";
import { RIGHT_SIDEBAR_TRANSITION } from "./utils";

function renderMonthLabel(label: string) {
  return label ? (
    <p className="mb-2 mt-4 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground first:mt-0">
      {label}
    </p>
  ) : null;
}

export function RightSidebarTabs({
  activeTab,
  setActiveTab,
  tabDirection,
  mediaMonthGroups,
  fileMonthGroups,
  linkMonthGroups,
  voiceMonthGroups,
  mediaEntries,
  fileEntries,
  linkEntries,
  voiceEntries,
  isSharedMediaLoading,
  authorsMap,
  isDirect,
  formatCreatedAt,
  renderEmptyState,
  openMessage,
  openImagePreview,
  openVideoPreview,
  playVoice,
  voiceProgress,
  voiceDuration,
  activeVoiceId,
  buildMessageContextActions,
  downloadByMediaKey,
  openExternalLink,
  copyText,
  t,
}: RightSidebarTabsProps) {
  const renderTabContent = () => {
    if (activeTab === RIGHT_SIDEBAR_TAB.MEDIA) {
      if (isSharedMediaLoading) {
        return (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton
                key={`media-skeleton-${index}`}
                className="aspect-square w-full rounded-xl"
              />
            ))}
          </div>
        );
      }

      if (mediaEntries.length === 0) {
        return renderEmptyState(t("empty.media"));
      }

      return (
        <div className="grid grid-cols-3 gap-1.5">
          {mediaMonthGroups.map((group) => (
            <Fragment key={group.key}>
              {group.label ? (
                <p className="col-span-3 mb-1 mt-4 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground first:mt-0">
                  {group.label}
                </p>
              ) : null}
              {group.items.map((item) => {
                const layoutId = `right-sidebar-media-${item.id}`;
                const actions = buildMessageContextActions(
                  {
                    messageId: item.messageId,
                    authorId: item.authorId,
                  },
                  [
                    {
                      key: `${item.id}:download`,
                      label: t("context.download"),
                      icon: <FiDownload />,
                      onSelect: () => void downloadByMediaKey(item.mediaKey),
                    },
                  ],
                );

                return (
                  <RightSidebarItemContextMenu key={item.id} actions={actions}>
                    <Ripple asChild>
                      <motion.button
                        type="button"
                        className="group relative aspect-square overflow-hidden rounded-xl bg-sidebar"
                        onClick={() => {
                          if (item.kind === CHAT_MEDIA_KIND.IMAGE) {
                            openImagePreview(item, layoutId);
                            return;
                          }

                          openVideoPreview(item, layoutId);
                        }}
                        whileTap={{ scale: 0.98 }}
                        transition={RIGHT_SIDEBAR_TRANSITION}
                      >
                        {item.kind === CHAT_MEDIA_KIND.IMAGE ? (
                          <motion.img
                            layoutId={layoutId}
                            src={item.url}
                            alt=""
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                        ) : (
                          <motion.video
                            layoutId={layoutId}
                            src={item.url}
                            className={cn(
                              "size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]",
                              item.kind === CHAT_MEDIA_KIND.RING && "rounded-full",
                            )}
                            muted
                            playsInline
                            preload="metadata"
                          />
                        )}
                        <span className="pointer-events-none absolute inset-x-1 bottom-1 rounded-md bg-black/55 px-1 py-0.5 text-[10px] text-white">
                          {formatCreatedAt(item.createdAt)}
                        </span>
                      </motion.button>
                    </Ripple>
                  </RightSidebarItemContextMenu>
                );
              })}
            </Fragment>
          ))}
        </div>
      );
    }

    if (activeTab === RIGHT_SIDEBAR_TAB.FILES) {
      if (isSharedMediaLoading) {
        return (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={`file-skeleton-${index}`} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        );
      }

      if (fileEntries.length === 0) {
        return renderEmptyState(t("empty.files"));
      }

      return (
        <div>
          {fileMonthGroups.map((group) => (
            <Fragment key={group.key}>
              {renderMonthLabel(group.label)}
              <div className="space-y-2">
                {group.items.map((item) => {
                  const actions = buildMessageContextActions(
                    {
                      messageId: item.messageId,
                      authorId: item.authorId,
                    },
                    [
                      {
                        key: `${item.id}:download`,
                        label: t("context.download"),
                        icon: <FiDownload />,
                        onSelect: () => void downloadByMediaKey(item.mediaKey),
                      },
                    ],
                  );

                  return (
                    <RightSidebarItemContextMenu key={item.id} actions={actions}>
                      <Ripple asChild>
                        <motion.button
                          type="button"
                          onClick={() => openMessage(item.messageId)}
                          className="flex w-full items-center gap-3 rounded-2xl bg-accent/30 px-3 py-2 text-left transition-colors hover:bg-accent/55"
                          whileTap={{ scale: 0.995 }}
                          transition={{ duration: 0.16 }}
                        >
                          <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
                            <IoDocumentTextOutline className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {getMediaLabel(item.mediaKey)}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {formatCreatedAt(item.createdAt)}
                            </span>
                          </span>
                        </motion.button>
                      </Ripple>
                    </RightSidebarItemContextMenu>
                  );
                })}
              </div>
            </Fragment>
          ))}
        </div>
      );
    }

    if (activeTab === RIGHT_SIDEBAR_TAB.LINKS) {
      if (isSharedMediaLoading) {
        return (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={`links-skeleton-${index}`} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        );
      }

      if (linkEntries.length === 0) {
        return renderEmptyState(t("empty.links"));
      }

      return (
        <div>
          {linkMonthGroups.map((group) => (
            <Fragment key={group.key}>
              {renderMonthLabel(group.label)}
              <div className="space-y-2">
                {group.items.map((entry) => {
                  const author = authorsMap?.[entry.authorId] ?? null;
                  const authorLabel = !isDirect
                    ? getUserDisplayName(author, t("unknownUser"))
                    : "";
                  const actions = buildMessageContextActions(
                    {
                      messageId: entry.messageId,
                      authorId: entry.authorId,
                    },
                    [
                      {
                        key: `${entry.id}:open-link`,
                        label: t("context.openLink"),
                        icon: <FiExternalLink />,
                        onSelect: () => openExternalLink(entry.url),
                      },
                      {
                        key: `${entry.id}:copy-link`,
                        label: t("context.copyLink"),
                        icon: <FiCopy />,
                        onSelect: () => void copyText(entry.url, t("context.linkCopied")),
                      },
                    ],
                  );

                  return (
                    <RightSidebarItemContextMenu key={entry.id} actions={actions}>
                      <motion.div
                        className="rounded-2xl bg-accent/25 p-2"
                        whileTap={{ scale: 0.995 }}
                        transition={{ duration: 0.16 }}
                      >
                        <button
                          type="button"
                          onClick={() => openMessage(entry.messageId)}
                          className="mb-1 inline-flex w-full items-center gap-2 rounded-xl px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent/55"
                        >
                          <IoLinkOutline className="size-4" />
                          <span className="truncate">{stripMessageFormatting(entry.url)}</span>
                          <span className="ml-auto shrink-0">{formatCreatedAt(entry.createdAt)}</span>
                        </button>
                        {authorLabel ? (
                          <p className="mb-1 px-2 text-[11px] text-muted-foreground">
                            {authorLabel}
                          </p>
                        ) : null}
                        <ChatMessageLinkPreview url={entry.url} isOwn={false} />
                      </motion.div>
                    </RightSidebarItemContextMenu>
                  );
                })}
              </div>
            </Fragment>
          ))}
        </div>
      );
    }

    if (isSharedMediaLoading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={`voice-skeleton-${index}`} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      );
    }

    if (voiceEntries.length === 0) {
      return renderEmptyState(t("empty.voice"));
    }

    return (
      <div>
        {voiceMonthGroups.map((group) => (
          <Fragment key={group.key}>
            {renderMonthLabel(group.label)}
            <div className="space-y-2">
              {group.items.map((entry) => {
                const voiceId = `${entry.messageId}:${entry.mediaKey}`;
                const progress = voiceProgress[voiceId] ?? 0;
                const duration = voiceDuration[voiceId] ?? 0;
                const isPlaying = activeVoiceId === voiceId;
                const actions = buildMessageContextActions(
                  {
                    messageId: entry.messageId,
                    authorId: entry.authorId,
                  },
                  [
                    {
                      key: `${voiceId}:download`,
                      label: t("context.download"),
                      icon: <FiDownload />,
                      onSelect: () => void downloadByMediaKey(entry.mediaKey),
                    },
                  ],
                );

                return (
                  <RightSidebarItemContextMenu key={voiceId} actions={actions}>
                    <motion.div whileTap={{ scale: 0.995 }} transition={{ duration: 0.16 }}>
                      <RightSidebarVoiceRow
                        id={voiceId}
                        duration={duration}
                        progress={progress}
                        isPlaying={isPlaying}
                        createdAt={formatCreatedAt(entry.createdAt)}
                        onToggle={() => void playVoice(voiceId, entry.url)}
                      />
                    </motion.div>
                  </RightSidebarItemContextMenu>
                );
              })}
            </div>
          </Fragment>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="sticky top-0 z-20 border-b bg-sidebar/96 backdrop-blur-md">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-4 gap-0 rounded-none px-0 pb-0.5">
            <TabsTrigger value={RIGHT_SIDEBAR_TAB.MEDIA} className="w-full rounded-none px-2 py-3 text-[13px]">
              {t("tabs.media")}
            </TabsTrigger>
            <TabsTrigger value={RIGHT_SIDEBAR_TAB.FILES} className="w-full rounded-none px-2 py-3 text-[13px]">
              {t("tabs.files")}
            </TabsTrigger>
            <TabsTrigger value={RIGHT_SIDEBAR_TAB.LINKS} className="w-full rounded-none px-2 py-3 text-[13px]">
              {t("tabs.links")}
            </TabsTrigger>
            <TabsTrigger value={RIGHT_SIDEBAR_TAB.VOICE} className="w-full rounded-none px-2 py-3 text-[13px]">
              {t("tabs.voice")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="px-3 pb-5 pt-3">
        <div className="grid min-h-[120px] overflow-hidden">
          <AnimatePresence initial={false} custom={tabDirection} mode="wait">
            <motion.div
              key={activeTab}
              custom={tabDirection}
              className="col-start-1 row-start-1"
              initial={{ x: tabDirection === 1 ? 24 : -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: tabDirection === 1 ? -24 : 24, opacity: 0 }}
              transition={RIGHT_SIDEBAR_TRANSITION}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
