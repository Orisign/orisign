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
import { downloadMediaByKey } from "@/lib/download-media";
import { cn } from "@/lib/utils";
import {
  CHAT_MEDIA_KIND,
  getMediaLabel,
  resolveChatMediaKind,
  resolveStorageFileUrl,
} from "@/lib/chat";
import { useQueryClient } from "@tanstack/react-query";
import { Button, toast } from "@repo/ui";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  IoAdd,
  IoClose,
  IoDownloadOutline,
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
  inlineMeta?: ReactNode;
}

function formatMediaTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "00:00";
  }

  const rounded = Math.floor(value);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function hashValue(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function buildFallbackWaveform(seed: string, bars = 34) {
  const base = hashValue(seed);
  return Array.from({ length: bars }, (_, index) => {
    const value = Math.abs(Math.sin((base + index * 17) * 0.00019));
    return Math.round(26 + value * 74);
  });
}

function buildWaveformFromBufferData(channelData: Float32Array, bars = 34) {
  if (channelData.length === 0 || bars <= 0) {
    return buildFallbackWaveform("empty", bars);
  }

  const blockSize = Math.max(1, Math.floor(channelData.length / bars));
  const peaks: number[] = [];

  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const start = barIndex * blockSize;
    const end = Math.min(channelData.length, start + blockSize);

    let peak = 0;
    for (let index = start; index < end; index += 1) {
      const sample = Math.abs(channelData[index] ?? 0);
      if (sample > peak) {
        peak = sample;
      }
    }

    peaks.push(peak);
  }

  const maxPeak = Math.max(...peaks, 0.0001);
  return peaks.map((peak) => Math.round(22 + (peak / maxPeak) * 78));
}

async function extractWaveformFromAudioUrl(url: string, bars = 34) {
  if (typeof window === "undefined") {
    return buildFallbackWaveform(url, bars);
  }

  const response = await fetch(url);
  const audioData = await response.arrayBuffer();

  const AudioContextConstructor = window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    return buildFallbackWaveform(url, bars);
  }

  const context = new AudioContextConstructor();
  try {
    const decoded = await context.decodeAudioData(audioData.slice(0));
    const channelData = decoded.getChannelData(0);
    return buildWaveformFromBufferData(channelData, bars);
  } finally {
    void context.close().catch(() => undefined);
  }
}

const videoControlButtonClass = "inline-flex size-11 items-center justify-center border-0 bg-transparent p-0 text-primary outline-none ring-0 transition-colors duration-150 hover:text-primary/80 active:text-primary/70 focus-visible:text-primary [&_svg]:size-7";

export function ChatMessageMedia({
  conversationId,
  messageId,
  canDelete = false,
  mediaKeys,
  inlineMeta = null,
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

  const voiceRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [activeVoiceKey, setActiveVoiceKey] = useState<string | null>(null);
  const [voiceCurrentTime, setVoiceCurrentTime] = useState<Record<string, number>>({});
  const [voiceDuration, setVoiceDuration] = useState<Record<string, number>>({});

  const ringRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [activeRingKey, setActiveRingKey] = useState<string | null>(null);
  const [ringCurrentTime, setRingCurrentTime] = useState<Record<string, number>>({});
  const [ringDuration, setRingDuration] = useState<Record<string, number>>({});

  const mediaItems = mediaKeys
    .filter(Boolean)
    .map((key) => ({
      key,
      url: resolveStorageFileUrl(key),
      kind: resolveChatMediaKind(key),
      label: getMediaLabel(key),
    }));

  const imageItems = mediaItems.filter(
    (item) => item.kind === CHAT_MEDIA_KIND.IMAGE && item.url,
  );
  const voiceItems = mediaItems.filter(
    (item) => item.kind === CHAT_MEDIA_KIND.VOICE && item.url,
  );
  const ringItems = mediaItems.filter(
    (item) => item.kind === CHAT_MEDIA_KIND.RING && item.url,
  );
  const videoItems = mediaItems.filter(
    (item) => item.kind === CHAT_MEDIA_KIND.VIDEO && item.url,
  );
  const fileItems = mediaItems.filter((item) => item.kind === CHAT_MEDIA_KIND.FILE && item.url);

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
  const canUsePortal = typeof document !== "undefined";

  const shouldInlineMetaWithVoice = Boolean(inlineMeta) &&
    voiceItems.length === 1 &&
    ringItems.length === 0 &&
    imageItems.length === 0 &&
    videoItems.length === 0 &&
    fileItems.length === 0;
  const shouldInlineMetaWithRing = Boolean(inlineMeta) &&
    ringItems.length === 1 &&
    voiceItems.length === 0 &&
    imageItems.length === 0 &&
    videoItems.length === 0 &&
    fileItems.length === 0;

  const [waveformByKey, setWaveformByKey] = useState<Record<string, number[]>>({});
  const [ringReadyByKey, setRingReadyByKey] = useState<Record<string, boolean>>({});
  const [ringBufferingByKey, setRingBufferingByKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isCancelled = false;
    const missingVoiceItems = voiceItems.filter(
      (item) => !waveformByKey[item.key] && Boolean(item.url),
    );

    if (missingVoiceItems.length === 0) {
      return;
    }

    void (async () => {
      for (const item of missingVoiceItems) {
        if (!item.url) continue;

        try {
          const waveform = await extractWaveformFromAudioUrl(item.url);
          if (isCancelled) return;

          setWaveformByKey((currentValue) => ({
            ...currentValue,
            [item.key]: waveform,
          }));
        } catch {
          if (isCancelled) return;
          setWaveformByKey((currentValue) => ({
            ...currentValue,
            [item.key]: buildFallbackWaveform(item.key),
          }));
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [voiceItems, waveformByKey]);

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

  useEffect(() => {
    const voiceNodes = voiceRefs.current;
    const ringNodes = ringRefs.current;

    return () => {
      Object.values(voiceNodes).forEach((audio) => {
        audio?.pause();
      });
      Object.values(ringNodes).forEach((video) => {
        video?.pause();
      });
    };
  }, []);

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

  function pauseAllVoices(exceptKey?: string) {
    Object.entries(voiceRefs.current).forEach(([mediaKey, audio]) => {
      if (!audio) return;
      if (exceptKey && mediaKey === exceptKey) return;
      audio.pause();
    });
  }

  async function handleToggleVoice(mediaKey: string) {
    const audio = voiceRefs.current[mediaKey];
    if (!audio) return;

    if (activeVoiceKey === mediaKey && !audio.paused) {
      audio.pause();
      setActiveVoiceKey(null);
      return;
    }

    pauseAllVoices(mediaKey);
    pauseAllRings();
    try {
      await audio.play();
      setActiveVoiceKey(mediaKey);
    } catch {
      setActiveVoiceKey(null);
    }
  }

  function pauseAllRings(exceptKey?: string) {
    Object.entries(ringRefs.current).forEach(([mediaKey, video]) => {
      if (!video) return;
      if (exceptKey && mediaKey === exceptKey) return;
      video.pause();
    });
  }

  async function handleToggleRing(mediaKey: string) {
    const video = ringRefs.current[mediaKey];
    if (!video) return;

    if (activeRingKey === mediaKey && !video.paused) {
      video.pause();
      setActiveRingKey(null);
      return;
    }

    pauseAllVoices();
    pauseAllRings(mediaKey);
    try {
      await video.play();
      setActiveRingKey(mediaKey);
    } catch {
      setActiveRingKey(null);
    }
  }

  async function handleDownloadByKey(mediaKey: string) {
    try {
      await downloadMediaByKey(mediaKey);
    } catch {
      toast({
        title: t("downloadError"),
        type: "error",
      });
    }
  }

  async function handleDownloadFromPreview() {
    const mediaKey = activeImage?.key ?? activeVideo?.key;
    if (!mediaKey) return;

    await handleDownloadByKey(mediaKey);
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
              const isSingleImage = imageItems.length === 1;

              return (
                <motion.button
                  key={item.key}
                  type="button"
                  onClick={() => openImagePreview(item.key)}
                  whileTap={{ scale: 0.985 }}
                  className={cn(
                    "relative block overflow-hidden",
                    isSingleImage
                      ? "h-[min(26rem,52vh)] w-[min(24rem,80vw)] max-w-full"
                      : "aspect-square",
                  )}
                >
                  <motion.img
                    layoutId={layoutId}
                    src={item.url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </motion.button>
              );
            })}
          </div>
        ) : null}

        {voiceItems.length > 0 ? (
          <div className="space-y-1.5">
            {voiceItems.map((item) => {
              const waveform = waveformByKey[item.key] ?? buildFallbackWaveform(item.key);
              const duration = voiceDuration[item.key] ?? 0;
              const current = voiceCurrentTime[item.key] ?? 0;
              const progress = duration > 0 ? Math.min(1, current / duration) : 0;
              const activeBars = Math.max(0, Math.round(waveform.length * progress));
              const isPlaying = activeVoiceKey === item.key;

              return (
                <motion.div
                  key={item.key}
                  layout
                  transition={{ type: "spring", stiffness: 360, damping: 30 }}
                  className="flex items-end gap-2"
                >
                  <audio
                    ref={(element) => {
                      voiceRefs.current[item.key] = element;
                    }}
                    src={item.url}
                    preload="metadata"
                    onLoadedMetadata={(event) => {
                      const durationValue = Number.isFinite(event.currentTarget.duration)
                        ? event.currentTarget.duration
                        : 0;
                      setVoiceDuration((currentValue) => ({
                        ...currentValue,
                        [item.key]: durationValue,
                      }));
                    }}
                    onTimeUpdate={(event) => {
                      const timeValue = Number.isFinite(event.currentTarget.currentTime)
                        ? event.currentTarget.currentTime
                        : 0;
                      setVoiceCurrentTime((currentValue) => ({
                        ...currentValue,
                        [item.key]: timeValue,
                      }));
                    }}
                    onEnded={() => {
                      setActiveVoiceKey((currentValue) =>
                        currentValue === item.key ? null : currentValue
                      );
                      setVoiceCurrentTime((currentValue) => ({
                        ...currentValue,
                        [item.key]: 0,
                      }));
                    }}
                  />

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => void handleToggleVoice(item.key)}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
                    aria-label={isPlaying ? t("pauseVoice") : t("playVoice")}
                  >
                    {isPlaying ? (
                      <IoPause className="size-5" />
                    ) : (
                      <IoPlay className="size-5 translate-x-[1px]" />
                    )}
                  </motion.button>

                  <div className="min-w-[8.5rem] flex-1">
                    <div className="flex h-8 items-end gap-[2px]">
                      {waveform.map((height, index) => (
                        <span
                          key={`${item.key}-${index}`}
                          className={cn(
                            "w-[2px] rounded-full transition-colors duration-200",
                            index < activeBars
                              ? "bg-primary"
                              : "bg-muted-foreground/40",
                          )}
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                    <div className="mt-1 text-[11px] font-medium tabular-nums text-muted-foreground">
                      {formatMediaTime(isPlaying ? current : duration || current)}
                    </div>
                  </div>

                  {shouldInlineMetaWithVoice ? (
                    <div className="pb-[2px]">
                      {inlineMeta}
                    </div>
                  ) : null}
                </motion.div>
              );
            })}
          </div>
        ) : null}

        {ringItems.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            {ringItems.map((item) => {
              const duration = ringDuration[item.key] ?? 0;
              const current = ringCurrentTime[item.key] ?? 0;
              const progress = duration > 0
                ? Math.min(100, Math.max(0, (current / duration) * 100))
                : 0;
              const isPlaying = activeRingKey === item.key;

              return (
                <div key={item.key} className="flex items-end gap-2">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    onClick={() => void handleToggleRing(item.key)}
                    className="relative block size-[19.2rem] overflow-hidden rounded-full bg-black"
                    aria-label={isPlaying ? t("pauseCircle") : t("playCircle")}
                  >
                    <video
                      ref={(element) => {
                        ringRefs.current[item.key] = element;
                      }}
                      src={item.url}
                      preload="metadata"
                      playsInline
                      className={cn(
                        "size-full object-cover transition-transform duration-180",
                        isPlaying ? "scale-100" : "scale-[1.01]",
                      )}
                      onLoadedMetadata={(event) => {
                        const durationValue = Number.isFinite(event.currentTarget.duration)
                          ? event.currentTarget.duration
                          : 0;
                        setRingDuration((currentValue) => ({
                          ...currentValue,
                          [item.key]: durationValue,
                        }));
                        setRingReadyByKey((currentValue) => ({
                          ...currentValue,
                          [item.key]: true,
                        }));
                        setRingBufferingByKey((currentValue) => ({
                          ...currentValue,
                          [item.key]: false,
                        }));
                      }}
                      onTimeUpdate={(event) => {
                        const timeValue = Number.isFinite(event.currentTarget.currentTime)
                          ? event.currentTarget.currentTime
                          : 0;
                        setRingCurrentTime((currentValue) => ({
                          ...currentValue,
                          [item.key]: timeValue,
                        }));
                      }}
                      onEnded={() => {
                        setActiveRingKey((currentValue) =>
                          currentValue === item.key ? null : currentValue
                        );
                        setRingCurrentTime((currentValue) => ({
                          ...currentValue,
                          [item.key]: 0,
                        }));
                        setRingBufferingByKey((currentValue) => ({
                          ...currentValue,
                          [item.key]: false,
                        }));
                      }}
                      onPlay={() =>
                        setRingBufferingByKey((currentValue) => ({
                          ...currentValue,
                          [item.key]: false,
                        }))}
                      onWaiting={() =>
                        setRingBufferingByKey((currentValue) => ({
                          ...currentValue,
                          [item.key]: true,
                        }))}
                      onCanPlay={() =>
                        setRingBufferingByKey((currentValue) => ({
                          ...currentValue,
                          [item.key]: false,
                        }))}
                      onError={() => {
                        setRingReadyByKey((currentValue) => ({
                          ...currentValue,
                          [item.key]: true,
                        }));
                        setRingBufferingByKey((currentValue) => ({
                          ...currentValue,
                          [item.key]: false,
                        }));
                      }}
                    />

                    <span
                      className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/20"
                      style={{
                        background:
                          progress > 0
                            ? `conic-gradient(hsl(var(--primary)) ${progress}%, transparent ${progress}%)`
                            : "transparent",
                        maskImage: "radial-gradient(circle at center, transparent 87%, black 88%)",
                      }}
                    />
                    <span className="pointer-events-none absolute bottom-1.5 right-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/90">
                      Orisign
                    </span>
                    <AnimatePresence initial={false}>
                      {(!ringReadyByKey[item.key] || ringBufferingByKey[item.key]) ? (
                        <motion.span
                          key="ring-loading-overlay"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/32"
                        >
                          <motion.span
                            className="size-4 rounded-full border-2 border-white/85 border-t-transparent"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.85, ease: "linear", repeat: Infinity }}
                          />
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </motion.button>

                  {shouldInlineMetaWithRing ? (
                    <div className="pb-[2px]">
                      {inlineMeta}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {fileItems.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {fileItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => void handleDownloadByKey(item.key)}
                className="rounded-xl border border-border/60 bg-background/50 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-background/70"
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}

        {videoItems.length > 0 ? (
          <div className="grid gap-1.5">
            {videoItems.map((item, index) => {
              const layoutId = `chat-video-${messageId}-${index}`;

              return (
                <motion.button
                  key={item.key}
                  type="button"
                  onClick={() => openVideoPreview(item.key)}
                  whileTap={{ scale: 0.99 }}
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
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                      <IoPlay className="size-7 translate-x-[1px]" />
                    </div>
                  </div>
                </motion.button>
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
                    className="absolute inset-0 bg-black/80"
                    onClick={closePreview}
                  />

                  <div className="pointer-events-none absolute inset-x-0 top-0 z-[130] flex justify-end p-3 sm:p-4">
                    <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/65 p-1.5">
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

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-full text-white hover:bg-white/15 hover:text-white"
                        onClick={() => void handleDownloadFromPreview()}
                        aria-label={t("download")}
                      >
                        <IoDownloadOutline className="size-5" />
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
                    className="absolute inset-0 bg-black/85"
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
                      className="mt-4 w-full max-w-[84vw] rounded-[1.3rem] border border-white/15 bg-black/65 p-3 sm:max-w-3xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="relative block h-2.5 w-full overflow-hidden rounded-full bg-white/20"
                        onClick={handlePreviewVideoTimelineClick}
                        aria-label={t("seekVideo")}
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
                            aria-label={isPreviewVideoPlaying ? t("pauseVideo") : t("playVideo")}
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
                            aria-label={isPreviewVideoMuted ? t("unmuteVideo") : t("muteVideo")}
                          >
                            {isPreviewVideoMuted ? <IoVolumeMute /> : <IoVolumeHigh />}
                          </button>

                          <button
                            type="button"
                            className={videoControlButtonClass}
                            onClick={() => void handleDownloadFromPreview()}
                            aria-label={t("download")}
                          >
                            <IoDownloadOutline />
                          </button>

                          {canDelete ? (
                            <button
                              type="button"
                              className={cn(videoControlButtonClass, "text-red-300 hover:text-red-200")}
                              onClick={() => void handleDeleteMessageFromPreview()}
                              aria-label={t("delete")}
                            >
                              <IoTrashOutline />
                            </button>
                          ) : null}
                        </div>

                        <span className="text-sm font-semibold tabular-nums text-white/90">
                          {formatMediaTime(previewVideoCurrentTime)} / {formatMediaTime(previewVideoDuration)}
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
