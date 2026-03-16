"use client";

import {
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  getConversationsControllerMyQueryKey,
  useMessagesControllerDelete,
} from "@/api/generated";
import {
  type ChatMessagesQueryData,
  bumpConversationInListData,
  bumpConversationQueryData,
  getChatMessagesQueryKey,
  getConversationQueryKey,
  removeChatMessageFromData,
} from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import {
  getMediaLabel,
  isImageMediaKey,
  resolveStorageFileUrl,
} from "@/lib/chat";
import { useQueryClient } from "@tanstack/react-query";
import { Button, toast } from "@repo/ui";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  IoAdd,
  IoClose,
  IoPause,
  IoPlay,
  IoRemove,
  IoTrashOutline,
  IoVolumeHigh,
  IoVolumeMute,
} from "react-icons/io5";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";

interface ChatMessageMediaProps {
  conversationId: string;
  messageId: string;
  canDelete?: boolean;
  mediaKeys: string[];
}

const VIDEO_MEDIA_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".mkv",
] as const;

function isVideoMediaKey(value: string | null | undefined) {
  if (!value) return false;

  const normalized = value.toLowerCase().split("?")[0];
  return VIDEO_MEDIA_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

function formatVideoTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "00:00";
  }

  const rounded = Math.floor(value);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const videoControlButtonClass = "inline-flex size-12 items-center justify-center border-0 bg-transparent p-0 text-primary outline-none ring-0 transition-colors duration-150 hover:text-primary/80 active:text-primary/70 focus-visible:text-primary [&_svg]:size-7";

export function ChatMessageMedia({
  conversationId,
  messageId,
  canDelete = false,
  mediaKeys,
}: ChatMessageMediaProps) {
  const t = useTranslations("chat.messages.mediaPreview");
  const queryClient = useQueryClient();
  const [activeImageKey, setActiveImageKey] = useState<string | null>(null);
  const [activeVideoKey, setActiveVideoKey] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const autoplayVideo = useGeneralSettingsStore(
    (state) => state.autoplayVideo && !state.powerSavingEnabled,
  );
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [shouldPreviewVideoPlay, setShouldPreviewVideoPlay] = useState(false);
  const [isPreviewVideoPlaying, setIsPreviewVideoPlaying] = useState(false);
  const [isPreviewVideoMuted, setIsPreviewVideoMuted] = useState(false);
  const [previewVideoDuration, setPreviewVideoDuration] = useState(0);
  const [previewVideoCurrentTime, setPreviewVideoCurrentTime] = useState(0);
  const { mutateAsync: deleteMessage, isPending: isDeleting } = useMessagesControllerDelete();

  const mediaItems = mediaKeys
    .filter(Boolean)
    .map((key) => ({
      key,
      url: resolveStorageFileUrl(key),
      isImage: isImageMediaKey(key),
      isVideo: isVideoMediaKey(key),
      label: getMediaLabel(key),
    }));

  const imageItems = mediaItems.filter((item) => item.isImage && item.url);
  const videoItems = mediaItems.filter((item) => item.isVideo && !item.isImage && item.url);
  const fileItems = mediaItems.filter((item) => !item.isImage && !item.isVideo);

  const activeImage = imageItems.find((item) => item.key === activeImageKey) ?? null;
  const activeVideo = videoItems.find((item) => item.key === activeVideoKey) ?? null;

  const activeImageLayoutId = activeImage
    ? (() => {
        const imageIndex = imageItems.findIndex((item) => item.key === activeImage.key);
        return imageIndex < 0 ? null : `chat-media-${messageId}-${imageIndex}`;
      })()
    : null;

  const activeVideoLayoutId = activeVideo
    ? (() => {
        const videoIndex = videoItems.findIndex((item) => item.key === activeVideo.key);
        return videoIndex < 0 ? null : `chat-video-${messageId}-${videoIndex}`;
      })()
    : null;

  const isPreviewOpen = Boolean(activeImage || activeVideo);

  const closePreview = () => {
    const video = previewVideoRef.current;
    if (video) {
      video.pause();
    }

    setActiveImageKey(null);
    setActiveVideoKey(null);
    setZoomed(false);
    setShouldPreviewVideoPlay(false);
    setIsPreviewVideoPlaying(false);
    setIsPreviewVideoMuted(false);
    setPreviewVideoCurrentTime(0);
    setPreviewVideoDuration(0);
  };

  useEffect(() => {
    if (!isPreviewOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isPreviewOpen]);

  useEffect(() => {
    if (!activeVideoKey) return;

    setIsPreviewVideoMuted(autoplayVideo);
    setShouldPreviewVideoPlay(autoplayVideo);
    setIsPreviewVideoPlaying(false);
  }, [activeVideoKey, autoplayVideo]);

  useEffect(() => {
    if (!activeVideoKey) return;

    const video = getPreviewVideoElement();
    if (!video) return;

    video.muted = isPreviewVideoMuted;
    video.defaultMuted = isPreviewVideoMuted;
  }, [activeVideoKey, isPreviewVideoMuted]);

  useEffect(() => {
    if (!activeVideoKey) return;

    const video = getPreviewVideoElement();
    if (!video) return;

    if (!shouldPreviewVideoPlay) {
      video.pause();
      return;
    }

    void video.play().catch(() => {
      setShouldPreviewVideoPlay(false);
    });
  }, [activeVideoKey, shouldPreviewVideoPlay]);

  function openImagePreview(key: string) {
    setActiveVideoKey(null);
    setActiveImageKey(key);
    setZoomed(false);
  }

  function openVideoPreview(key: string) {
    setActiveImageKey(null);
    setActiveVideoKey(key);
    setZoomed(false);
    setShouldPreviewVideoPlay(autoplayVideo);
    setIsPreviewVideoMuted(autoplayVideo);
    setIsPreviewVideoPlaying(false);
    setPreviewVideoCurrentTime(0);
    setPreviewVideoDuration(0);
  }

  function handleTogglePreviewVideoPlay() {
    setShouldPreviewVideoPlay((currentValue) => !currentValue);
  }

  function handleTogglePreviewVideoMute() {
    setIsPreviewVideoMuted((currentValue) => !currentValue);
  }

  function handlePreviewVideoTimelineClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    const video = getPreviewVideoElement();
    if (!video || previewVideoDuration <= 0) return;

    const timelineRect = event.currentTarget.getBoundingClientRect();
    if (timelineRect.width <= 0) return;

    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - timelineRect.left) / timelineRect.width),
    );
    video.currentTime = ratio * previewVideoDuration;
    setPreviewVideoCurrentTime(video.currentTime);
  }

  function getPreviewVideoElement() {
    return previewVideoRef.current ??
      (document.getElementById("chat-video-preview-player") as HTMLVideoElement | null);
  }

  async function handleDeleteMessageFromPreview() {
    if (!canDelete || isDeleting) return;

    try {
      const response = await deleteMessage({
        data: {
          conversationId,
          messageId,
        },
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      queryClient.setQueryData<ChatMessagesQueryData>(
        getChatMessagesQueryKey(conversationId),
        (currentData) => removeChatMessageFromData(currentData, messageId),
      );

      const nextTimestamp = Date.now();

      queryClient.setQueryData<GetConversationResponseDto>(
        getConversationQueryKey(conversationId),
        (currentData) => bumpConversationQueryData(currentData, nextTimestamp),
      );

      queryClient.setQueriesData<ListMyConversationsResponseDto>(
        { queryKey: getConversationsControllerMyQueryKey() },
        (currentData) =>
          bumpConversationInListData(currentData, conversationId, nextTimestamp),
      );

      closePreview();
    } catch {
      toast({
        title: t("deleteError"),
        type: "error",
      });
    }
  }

  const previewVideoProgress = previewVideoDuration > 0
    ? Math.min(100, Math.max(0, (previewVideoCurrentTime / previewVideoDuration) * 100))
    : 0;
  const canUsePortal = typeof document !== "undefined";

  if (mediaItems.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-2">
        {imageItems.length > 0 ? (
          <div
            className={cn(
              "grid gap-1.5 overflow-hidden rounded-2xl",
              imageItems.length === 1 ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {imageItems.map((item, index) => {
              const layoutId = `chat-media-${messageId}-${index}`;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => openImagePreview(item.key)}
                  className="relative block overflow-hidden"
                >
                  <motion.img
                    layoutId={layoutId}
                    src={item.url}
                    alt=""
                    loading="lazy"
                    className={cn(
                      "w-full object-cover",
                      imageItems.length === 1 ? "max-h-[26rem]" : "aspect-square",
                    )}
                  />
                </button>
              );
            })}
          </div>
        ) : null}

        {fileItems.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {fileItems.map((item) => (
              <a
                key={item.key}
                href={item.url || undefined}
                target="_blank"
                rel="noreferrer"
                download
                className="rounded-xl border border-border/60 bg-background/50 px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {item.label}
              </a>
            ))}
          </div>
        ) : null}

        {videoItems.length > 0 ? (
          <div className="grid gap-1.5">
            {videoItems.map((item, index) => {
              const layoutId = `chat-video-${messageId}-${index}`;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => openVideoPreview(item.key)}
                  className="group relative overflow-hidden rounded-2xl bg-black"
                >
                  <motion.video
                    layoutId={layoutId}
                    src={item.url}
                    muted
                    preload="metadata"
                    playsInline
                    className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />

                  <div className="pointer-events-none absolute inset-0 bg-black/25" />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/0.5)]">
                      <IoPlay className="size-7 translate-x-[1px]" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {canUsePortal
        ? createPortal(
            <AnimatePresence>
              {activeImage ? (
                <motion.div
                  className="fixed inset-0 z-[120] flex h-screen w-screen items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.button
                    type="button"
                    aria-label={t("close")}
                    className="absolute inset-0 bg-black/80 backdrop-blur-[1px]"
                    onClick={closePreview}
                  />

                  <div className="pointer-events-none absolute inset-x-0 top-0 z-[130] flex justify-end p-3 sm:p-4">
                    <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/55 p-1.5 backdrop-blur-xl">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-full text-white hover:bg-white/15 hover:text-white"
                        onClick={closePreview}
                        aria-label={t("close")}
                      >
                        <IoClose className="size-5" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-full text-white hover:bg-white/15 hover:text-white"
                        onClick={() => setZoomed((currentValue) => !currentValue)}
                        aria-label={zoomed ? t("zoomOut") : t("zoomIn")}
                      >
                        {zoomed ? (
                          <IoRemove className="size-5" />
                        ) : (
                          <IoAdd className="size-5" />
                        )}
                      </Button>

                      {canDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-10 rounded-full text-red-300 hover:bg-red-400/20 hover:text-red-200"
                          onClick={() => void handleDeleteMessageFromPreview()}
                          disabled={isDeleting}
                          aria-label={t("delete")}
                        >
                          <IoTrashOutline className="size-5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <motion.img
                    layoutId={activeImageLayoutId ?? undefined}
                    src={activeImage.url}
                    alt=""
                    className={cn(
                      "relative z-[122] max-h-[84vh] max-w-[84vw] rounded-2xl object-contain transition-transform duration-250 ease-out",
                      zoomed ? "scale-[1.15] cursor-zoom-out" : "scale-100 cursor-zoom-in",
                    )}
                    onClick={() => setZoomed((currentValue) => !currentValue)}
                  />
                </motion.div>
              ) : null}

              {activeVideo ? (
                <motion.div
                  className="fixed inset-0 z-[120] flex h-screen w-screen items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.button
                    type="button"
                    aria-label={t("close")}
                    className="absolute inset-0 bg-black/85 backdrop-blur-[1px]"
                    onClick={closePreview}
                  />

                  <div className="relative z-[122] flex w-full flex-col items-center px-4 pb-5 pt-16">
                    <motion.video
                      id="chat-video-preview-player"
                      ref={previewVideoRef}
                      layoutId={activeVideoLayoutId ?? undefined}
                      src={activeVideo.url}
                      playsInline
                      preload="metadata"
                      className="max-h-[70vh] w-full max-w-[84vw] rounded-2xl bg-black object-contain"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleTogglePreviewVideoPlay();
                      }}
                      onLoadedMetadata={(event) =>
                        setPreviewVideoDuration(
                          Number.isFinite(event.currentTarget.duration)
                            ? event.currentTarget.duration
                            : 0,
                        )}
                      onTimeUpdate={(event) =>
                        setPreviewVideoCurrentTime(
                          Number.isFinite(event.currentTarget.currentTime)
                            ? event.currentTarget.currentTime
                            : 0,
                        )}
                      onPlay={() => {
                        setIsPreviewVideoPlaying(true);
                        setShouldPreviewVideoPlay(true);
                      }}
                      onPause={() => {
                        setIsPreviewVideoPlaying(false);
                        setShouldPreviewVideoPlay(false);
                      }}
                      onVolumeChange={(event) =>
                        setIsPreviewVideoMuted(event.currentTarget.muted)}
                    />

                    <div
                      className="mt-4 w-full max-w-[84vw] rounded-[1.3rem] border border-white/15 bg-black/55 p-3 backdrop-blur-xl sm:max-w-3xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="relative block h-2.5 w-full overflow-hidden rounded-full bg-white/20"
                        onClick={handlePreviewVideoTimelineClick}
                        aria-label="Seek video"
                      >
                        <span
                          className="absolute inset-y-0 left-0 rounded-full bg-primary"
                          style={{ width: `${previewVideoProgress}%` }}
                        />
                      </button>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className={videoControlButtonClass}
                              onClick={handleTogglePreviewVideoPlay}
                              aria-label={isPreviewVideoPlaying ? "Pause video" : "Play video"}
                            >
                              {isPreviewVideoPlaying ? (
                                <IoPause />
                              ) : (
                                <IoPlay className="translate-x-[1px]" />
                              )}
                            </button>

                            <button
                              type="button"
                              className={videoControlButtonClass}
                              onClick={handleTogglePreviewVideoMute}
                              aria-label={isPreviewVideoMuted ? "Unmute video" : "Mute video"}
                            >
                              {isPreviewVideoMuted ? <IoVolumeMute /> : <IoVolumeHigh />}
                            </button>
                          </div>

                        <span className="text-sm font-semibold tabular-nums text-white/90">
                          {formatVideoTime(previewVideoCurrentTime)} / {formatVideoTime(previewVideoDuration)}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className={videoControlButtonClass}
                            onClick={closePreview}
                            aria-label={t("close")}
                          >
                            <IoClose />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
