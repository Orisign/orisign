"use client";

import { cn } from "@repo/ui";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import {
  IoClose,
  IoPause,
  IoPlay,
  IoPlaySkipBack,
  IoPlaySkipForward,
  IoRepeat,
  IoVolumeHigh,
  IoVolumeMute,
} from "react-icons/io5";
import { musicPlayerStore } from "@/store/music-player.store";

function formatPlayerTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0:00";

  const seconds = Math.floor(value);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function ChatMusicPlayer() {
  const t = useTranslations("chat.musicPlayer");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeButtonRef = useRef<HTMLDivElement | null>(null);
  const closeVolumeTimeoutRef = useRef<number | null>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [volumePanelPosition, setVolumePanelPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const currentTrack = musicPlayerStore((state) => state.currentTrack);
  const queue = musicPlayerStore((state) => state.queue);
  const isPlaying = musicPlayerStore((state) => state.isPlaying);
  const repeatMode = musicPlayerStore((state) => state.repeatMode);
  const volume = musicPlayerStore((state) => state.volume);
  const currentTime = musicPlayerStore((state) => state.currentTime);
  const duration = musicPlayerStore((state) => state.duration);
  const toggle = musicPlayerStore((state) => state.toggle);
  const close = musicPlayerStore((state) => state.close);
  const previous = musicPlayerStore((state) => state.previous);
  const next = musicPlayerStore((state) => state.next);
  const cycleRepeatMode = musicPlayerStore((state) => state.cycleRepeatMode);
  const setPlayerVolume = musicPlayerStore((state) => state.setVolume);
  const toggleMute = musicPlayerStore((state) => state.toggleMute);
  const setPlayingState = musicPlayerStore((state) => state.setPlayingState);
  const setPlaybackPosition = musicPlayerStore((state) => state.setPlaybackPosition);
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const canSwitchTracks = queue.length > 1;
  const iconButtonClass = "flex size-8 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:text-primary/80 active:text-primary/70 disabled:cursor-default disabled:opacity-40";

  useEffect(() => {
    setPlaybackPosition(0, 0);
  }, [currentTrack?.key, setPlaybackPosition]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    audio.volume = volume;

    if (!isPlaying) {
      audio.pause();
      return;
    }

    void audio.play().catch(() => {
      setPlayingState(false);
    });
  }, [currentTrack, isPlaying, volume, setPlayingState]);

  useEffect(() => {
    return () => {
      if (closeVolumeTimeoutRef.current !== null) {
        window.clearTimeout(closeVolumeTimeoutRef.current);
      }
    };
  }, []);

  function openVolumeSlider() {
    if (closeVolumeTimeoutRef.current !== null) {
      window.clearTimeout(closeVolumeTimeoutRef.current);
      closeVolumeTimeoutRef.current = null;
    }

    const rect = volumeButtonRef.current?.getBoundingClientRect();
    if (rect) {
      setVolumePanelPosition({
        left: rect.left + rect.width / 2,
        top: rect.bottom + 8,
      });
    }

    setShowVolumeSlider(true);
  }

  function scheduleCloseVolumeSlider() {
    if (closeVolumeTimeoutRef.current !== null) {
      window.clearTimeout(closeVolumeTimeoutRef.current);
    }

    closeVolumeTimeoutRef.current = window.setTimeout(() => {
      setShowVolumeSlider(false);
    }, 120);
  }

  function handleTimelineClick(event: MouseEvent<HTMLButtonElement>) {
    const audio = audioRef.current;
    if (!audio || duration <= 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;

    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setPlaybackPosition(audio.currentTime, duration);
  }

  function handleVolumeChange(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    const newVolume = 1 - ratio;
    setPlayerVolume(newVolume);
  }

  function handleEnded() {
    const audio = audioRef.current;
    if (!audio) return;

    if (repeatMode === "one") {
      audio.currentTime = 0;
      setPlaybackPosition(0, duration);
      void audio.play().catch(() => setPlayingState(false));
      return;
    }

    if (queue.length > 1) {
      next(repeatMode === "all");
      return;
    }

    setPlayingState(false);
    setPlaybackPosition(0, duration);
  }

  return (
    <AnimatePresence initial={false}>
      {currentTrack ? (
        <motion.div
          key="chat-music-player"
          initial={{ opacity: 0, height: 0, y: 10 }}
          animate={{ opacity: 1, height: 48, y: 0 }}
          exit={{ opacity: 0, height: 0, y: 10 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "bottom" }}
          className="relative z-20 w-full shrink-0 overflow-visible border-b border-border bg-sidebar"
        >
          <audio
            ref={audioRef}
            src={currentTrack.url}
            preload="metadata"
            onLoadedMetadata={(event) => {
              const nextDuration = Number.isFinite(event.currentTarget.duration)
                ? event.currentTarget.duration
                : 0;
              setPlaybackPosition(event.currentTarget.currentTime || 0, nextDuration);
            }}
            onTimeUpdate={(event) => {
              setPlaybackPosition(
                Number.isFinite(event.currentTarget.currentTime)
                  ? event.currentTarget.currentTime
                  : 0,
              );
            }}
            onEnded={handleEnded}
          />

          <div className="relative flex h-12 items-center gap-2 px-3">
            <button
              type="button"
              className="absolute inset-x-0 bottom-0 h-[2px] cursor-pointer bg-transparent"
              onClick={handleTimelineClick}
              aria-label={t("seek")}
            >
              <span
                className="block h-full bg-primary transition-[width] duration-100"
                style={{ width: `${progress}%` }}
              />
            </button>

            <button
              type="button"
              className={iconButtonClass}
              disabled={!canSwitchTracks}
              onClick={() => previous()}
              aria-label={t("previous")}
            >
              <IoPlaySkipBack className="size-5" />
            </button>

            <button
              type="button"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:text-primary/80 active:text-primary/70"
              onClick={toggle}
              aria-label={isPlaying ? t("pause") : t("play")}
            >
              {isPlaying ? (
                <IoPause className="size-5" />
              ) : (
                <IoPlay className="size-5 translate-x-[1px]" />
              )}
            </button>

            <button
              type="button"
              className={iconButtonClass}
              disabled={!canSwitchTracks}
              onClick={() => next(true)}
              aria-label={t("next")}
            >
              <IoPlaySkipForward className="size-5" />
            </button>

            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-[14px] font-semibold leading-[17px] text-foreground">
                {currentTrack.title}
              </div>
              <div className="mt-0.5 truncate text-[12px] leading-[14px] text-muted-foreground">
                {formatPlayerTime(currentTime)} · {currentTrack.artist || t("unknownArtist")}
              </div>
            </div>

            <div
              ref={volumeButtonRef}
              className="relative"
              onMouseEnter={openVolumeSlider}
              onMouseLeave={scheduleCloseVolumeSlider}
            >
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:text-primary/80 active:text-primary/70"
                onClick={toggleMute}
                aria-label={volume === 0 ? t("unmute") : t("mute")}
              >
                {volume === 0 ? (
                  <IoVolumeMute className="size-[18px]" />
                ) : (
                  <IoVolumeHigh className="size-[18px]" />
                )}
              </button>
            </div>

            <button
              type="button"
              className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                repeatMode !== "off"
                  ? "text-primary hover:text-primary/80"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={cycleRepeatMode}
              aria-label={t(`repeat.${repeatMode}`)}
            >
              <IoRepeat className="size-[18px]" />
              {repeatMode === "one" ? (
                <span className="absolute right-[7px] top-[7px] text-[9px] font-bold leading-none">
                  1
                </span>
              ) : null}
            </button>

            <button
              type="button"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              onClick={close}
              aria-label={t("close")}
            >
              <IoClose className="size-5" />
            </button>
          </div>

          {typeof document !== "undefined"
            ? createPortal(
                <AnimatePresence>
                  {showVolumeSlider && volumePanelPosition ? (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="fixed z-[300] -translate-x-1/2 rounded-lg border border-border bg-popover p-2"
                      style={{
                        left: volumePanelPosition.left,
                        top: volumePanelPosition.top,
                      }}
                      onMouseEnter={openVolumeSlider}
                      onMouseLeave={scheduleCloseVolumeSlider}
                    >
                      <div
                        className="relative h-24 w-7 cursor-pointer rounded-full bg-muted"
                        onClick={handleVolumeChange}
                      >
                        <span
                          className="absolute inset-x-0 bottom-0 rounded-full bg-primary"
                          style={{ height: `${volume * 100}%` }}
                        />
                        <span
                          className="absolute left-1/2 size-3 -translate-x-1/2 rounded-full border border-background bg-primary"
                          style={{ bottom: `calc(${volume * 100}% - 6px)` }}
                        />
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>,
                document.body,
              )
            : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
