"use client";

import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
  SidebarPageSeparator,
  SidebarPageTitle,
} from "@/components/ui/sidebar-page";
import {
  clearCacheForUser,
  getChatCacheStats,
} from "@/lib/cache/chat-cache-service";
import { clearMediaCache, getMediaCacheStats, type MediaCacheStats } from "@/lib/cache/media-cache";
import type { ChatCacheStats } from "@/lib/cache/chat-cache-types";
import { sidebarStore } from "@/store/sidebar/sidebar.store";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";
import { Button, Checkbox, Ripple, Slider } from "@repo/ui";
import {
  ArrowLeft,
  File,
  ImageIcon,
  MessageSquare,
  Play,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

const EMPTY_STATS: ChatCacheStats = {
  totalBytes: 0,
  conversationsBytes: 0,
  messagesBytes: 0,
  usersBytes: 0,
  mediaBytes: 0,
  otherBytes: 0,
  records: 0,
};
const EMPTY_MEDIA_STATS: MediaCacheStats = {
  totalBytes: 0,
  imageBytes: 0,
  videoBytes: 0,
  otherBytes: 0,
};

const TTL_OPTIONS = [1, 2, 3, 7, 14, 30, 90, 180, 365] as const;
const CACHE_SIZE_OPTIONS = [100, 200, 300, 500, 750, 1024, 2048, 4096, 0] as const;

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 Б";

  const units = ["Б", "КБ", "МБ", "ГБ"];
  let size = value;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function CacheRow({
  icon,
  title,
  value,
}: {
  icon: ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 px-1 py-1.5">
      <div className="flex size-10 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-semibold leading-snug text-foreground">{title}</p>
        <p className="text-sm leading-snug text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

export function DataAndStorageSidebar() {
  const t = useTranslations("dataAndStorageSidebar");
  const { pop } = sidebarStore();
  const {
    autoDownloadMedia,
    cacheTtlDays,
    cacheSizeLimitMb,
    setAutoDownloadMedia,
    setCacheTtlDays,
    setCacheSizeLimitMb,
  } = useGeneralSettingsStore();
  const [stats, setStats] = useState(EMPTY_STATS);
  const [mediaStats, setMediaStats] = useState(EMPTY_MEDIA_STATS);
  const [isClearing, setIsClearing] = useState(false);

  const ttlIndex = useMemo(() => {
    const index = TTL_OPTIONS.findIndex((value) => value >= cacheTtlDays);
    return index >= 0 ? index : 3;
  }, [cacheTtlDays]);
  const cacheSizeIndex = useMemo(() => {
    const index = CACHE_SIZE_OPTIONS.findIndex((value) => value === cacheSizeLimitMb);
    return index >= 0 ? index : CACHE_SIZE_OPTIONS.length - 1;
  }, [cacheSizeLimitMb]);

  const refreshStats = useCallback(() => {
    void getChatCacheStats().then(setStats);
    void getMediaCacheStats().then(setMediaStats);
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const clearCache = async () => {
    if (isClearing) return;

    setIsClearing(true);
    try {
      await clearCacheForUser();
      await clearMediaCache();
      setStats(EMPTY_STATS);
      setMediaStats(EMPTY_MEDIA_STATS);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <SidebarPage>
      <SidebarPageHeader className="justify-start gap-3">
        <Button onClick={pop} variant="ghost" size="icon" className="rounded-full">
          <ArrowLeft strokeWidth={3} className="size-6" />
        </Button>
        <SidebarPageTitle>{t("title")}</SidebarPageTitle>
      </SidebarPageHeader>

      <SidebarPageContent className="gap-4">
        <p className="px-1 text-lg font-semibold text-primary">{t("autoDownload.title")}</p>

        <Ripple
          className="flex min-h-12 items-center gap-4 rounded-xl px-1 py-2"
          onClick={() => setAutoDownloadMedia(!autoDownloadMedia)}
        >
          <Checkbox checked={autoDownloadMedia} />
          <p className="font-semibold text-foreground">{t("autoDownload.enabled")}</p>
        </Ripple>

        <div className="space-y-3 px-1">
          <div>
            <p className="font-semibold text-foreground">{t("autoDownload.photo")}</p>
            <p className="text-sm text-muted-foreground">{t("autoDownload.allChats")}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">{t("autoDownload.video")}</p>
            <p className="text-sm text-muted-foreground">{t("autoDownload.allChats")}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">{t("autoDownload.files")}</p>
            <p className="text-sm text-muted-foreground">{t("autoDownload.fileLimit")}</p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="justify-start gap-4 rounded-xl px-1 text-muted-foreground"
          disabled
        >
          <Trash2 className="size-5" />
          {t("autoDownload.reset")}
        </Button>
      </SidebarPageContent>

      <SidebarPageSeparator />

      <SidebarPageContent className="gap-4">
        <p className="px-1 text-lg font-semibold text-primary">{t("storage.title")}</p>

        <div className="flex items-start justify-between gap-4 px-1">
          <div>
            <p className="font-semibold text-foreground">{t("storage.cachedFiles")}</p>
            <p className="text-sm text-muted-foreground">
              {formatBytes(stats.totalBytes + mediaStats.totalBytes)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-0 font-semibold text-primary hover:bg-transparent"
            onClick={() => void clearCache()}
            disabled={isClearing}
          >
            {t("storage.delete")}
          </Button>
        </div>

        <div className="space-y-1">
          <CacheRow
            icon={<ImageIcon className="size-6" />}
            title={t("storage.photos")}
            value={formatBytes(mediaStats.imageBytes)}
          />
          <CacheRow
            icon={<Play className="size-6 fill-current" />}
            title={t("storage.video")}
            value={formatBytes(mediaStats.videoBytes)}
          />
          <CacheRow
            icon={<MessageSquare className="size-6" />}
            title={t("storage.messages")}
            value={formatBytes(stats.messagesBytes)}
          />
          <CacheRow
            icon={<File className="size-6" />}
            title={t("storage.other")}
            value={formatBytes(
              stats.conversationsBytes +
                stats.usersBytes +
                stats.otherBytes +
                stats.mediaBytes +
                mediaStats.otherBytes,
            )}
          />
        </div>

        <div className="space-y-3 px-1 pt-2">
          <div className="flex items-center justify-between gap-4">
            <p className="font-semibold text-foreground">{t("storage.autoDelete")}</p>
            <p className="text-sm text-muted-foreground">
              {t("storage.days", { count: TTL_OPTIONS[ttlIndex] })}
            </p>
          </div>
          <Slider
            value={[ttlIndex]}
            min={0}
            max={TTL_OPTIONS.length - 1}
            step={1}
            onValueChange={(values) => {
              const nextIndex = values[0] ?? ttlIndex;
              setCacheTtlDays(TTL_OPTIONS[nextIndex] ?? 7);
            }}
          />
        </div>

        <div className="space-y-3 px-1 pt-6">
          <div className="flex items-center justify-between gap-4">
            <p className="font-semibold text-foreground">{t("storage.maxSize")}</p>
            <p className="text-sm text-muted-foreground">
              {cacheSizeLimitMb === 0 ? t("storage.auto") : formatBytes(cacheSizeLimitMb * 1024 * 1024)}
            </p>
          </div>
          <Slider
            value={[cacheSizeIndex]}
            min={0}
            max={CACHE_SIZE_OPTIONS.length - 1}
            step={1}
            onValueChange={(values) => {
              const nextIndex = values[0] ?? cacheSizeIndex;
              setCacheSizeLimitMb(CACHE_SIZE_OPTIONS[nextIndex] ?? 0);
            }}
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          className="mt-4 justify-start gap-4 rounded-xl px-1 text-primary"
          onClick={() => void clearCache()}
          disabled={isClearing}
        >
          <Trash2 className="size-5" />
          {t("storage.clearAll")}
        </Button>
      </SidebarPageContent>

      <SidebarPageSeparator />

      <SidebarPageContent className="pb-4 pt-3">
        <p className="px-1 text-sm leading-snug text-muted-foreground">
          {t("storage.caption")}
        </p>
      </SidebarPageContent>
    </SidebarPage>
  );
}
