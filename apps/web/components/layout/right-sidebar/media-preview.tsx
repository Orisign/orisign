"use client";

import { Button, cn } from "@repo/ui";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import { FiTrash2 } from "react-icons/fi";
import {
  IoAdd,
  IoClose,
  IoDownloadOutline,
  IoPause,
  IoPlay,
  IoRemove,
  IoVolumeHigh,
  IoVolumeMute,
} from "react-icons/io5";
import type { MouseEventHandler, RefObject, SyntheticEvent } from "react";
import type { SidebarPreviewState } from "./types";
import { VIDEO_PREVIEW_CONTROL_BUTTON_CLASS } from "./utils";

export function RightSidebarMediaPreview({
  activeImagePreview,
  activeVideoPreview,
  canUsePortal,
  previewZoomed,
  setPreviewZoomed,
  closeMediaPreview,
  handleDownloadFromPreview,
  handleDeleteFromPreview,
  canDeleteActivePreviewMessage,
  isDeletingMessage,
  previewVideoRef,
  previewVideoProgress,
  previewVideoCurrentTimeLabel,
  previewVideoDurationLabel,
  handlePreviewVideoTimelineClick,
  handleTogglePreviewVideoPlay,
  handleTogglePreviewVideoMute,
  isPreviewVideoPlaying,
  isPreviewVideoMuted,
  onLoadedMetadata,
  onTimeUpdate,
  onPlay,
  onPause,
  onVolumeChange,
  t,
}: {
  activeImagePreview: SidebarPreviewState | null;
  activeVideoPreview: SidebarPreviewState | null;
  canUsePortal: boolean;
  previewZoomed: boolean;
  setPreviewZoomed: (value: boolean | ((current: boolean) => boolean)) => void;
  closeMediaPreview: () => void;
  handleDownloadFromPreview: () => Promise<void>;
  handleDeleteFromPreview: () => Promise<void>;
  canDeleteActivePreviewMessage: boolean;
  isDeletingMessage: boolean;
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  previewVideoProgress: number;
  previewVideoCurrentTimeLabel: string;
  previewVideoDurationLabel: string;
  handlePreviewVideoTimelineClick: MouseEventHandler<HTMLButtonElement>;
  handleTogglePreviewVideoPlay: () => void;
  handleTogglePreviewVideoMute: () => void;
  isPreviewVideoPlaying: boolean;
  isPreviewVideoMuted: boolean;
  onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void;
  onTimeUpdate: (event: SyntheticEvent<HTMLVideoElement>) => void;
  onPlay: () => void;
  onPause: () => void;
  onVolumeChange: (event: SyntheticEvent<HTMLVideoElement>) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  if (!canUsePortal) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {activeImagePreview ? (
        <motion.div
          className="fixed inset-0 z-[120] flex h-screen w-screen items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label={t("preview.close")}
            className="absolute inset-0 bg-black/80"
            onClick={closeMediaPreview}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-[130] flex justify-end p-3 sm:p-4">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/65 p-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 rounded-full text-white hover:bg-white/15 hover:text-white"
                onClick={closeMediaPreview}
                aria-label={t("preview.close")}
              >
                <IoClose className="size-5" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 rounded-full text-white hover:bg-white/15 hover:text-white"
                onClick={() => setPreviewZoomed((current) => !current)}
                aria-label={previewZoomed ? t("preview.zoomOut") : t("preview.zoomIn")}
              >
                {previewZoomed ? <IoRemove className="size-5" /> : <IoAdd className="size-5" />}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 rounded-full text-white hover:bg-white/15 hover:text-white"
                onClick={() => void handleDownloadFromPreview()}
                aria-label={t("preview.download")}
              >
                <IoDownloadOutline className="size-5" />
              </Button>

              {canDeleteActivePreviewMessage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-full text-destructive hover:bg-destructive/15 hover:text-destructive"
                  onClick={() => void handleDeleteFromPreview()}
                  disabled={isDeletingMessage}
                  aria-label={t("preview.delete")}
                >
                  <FiTrash2 className="size-5" />
                </Button>
              ) : null}
            </div>
          </div>

          <motion.img
            layoutId={activeImagePreview.layoutId}
            src={activeImagePreview.url}
            alt=""
            className={cn(
              "relative z-[122] max-h-[84vh] max-w-[84vw] rounded-2xl object-contain transition-transform duration-250 ease-out",
              previewZoomed ? "scale-[1.15] cursor-zoom-out" : "scale-100 cursor-zoom-in",
            )}
            onClick={() => setPreviewZoomed((current) => !current)}
          />
        </motion.div>
      ) : null}

      {activeVideoPreview ? (
        <motion.div
          className="fixed inset-0 z-[120] flex h-screen w-screen items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label={t("preview.close")}
            className="absolute inset-0 bg-black/85"
            onClick={closeMediaPreview}
          />

          <div className="relative z-[122] flex w-full flex-col items-center px-4 pb-5 pt-16">
            <motion.video
              ref={previewVideoRef}
              layoutId={activeVideoPreview.layoutId}
              src={activeVideoPreview.url}
              playsInline
              preload="metadata"
              className="max-h-[70vh] w-full max-w-[84vw] rounded-2xl bg-black object-contain"
              onClick={(event) => {
                event.stopPropagation();
                handleTogglePreviewVideoPlay();
              }}
              onLoadedMetadata={onLoadedMetadata}
              onTimeUpdate={onTimeUpdate}
              onPlay={onPlay}
              onPause={onPause}
              onVolumeChange={onVolumeChange}
            />

            <div
              className="mt-4 w-full max-w-[84vw] rounded-[1.3rem] border border-white/15 bg-black/65 p-3 sm:max-w-3xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="relative block h-2.5 w-full overflow-hidden rounded-full bg-white/20"
                onClick={handlePreviewVideoTimelineClick}
                aria-label={t("preview.seekVideo")}
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
                    className={VIDEO_PREVIEW_CONTROL_BUTTON_CLASS}
                    onClick={handleTogglePreviewVideoPlay}
                    aria-label={isPreviewVideoPlaying ? t("preview.pauseVideo") : t("preview.playVideo")}
                  >
                    {isPreviewVideoPlaying ? <IoPause /> : <IoPlay className="translate-x-[1px]" />}
                  </button>

                  <button
                    type="button"
                    className={VIDEO_PREVIEW_CONTROL_BUTTON_CLASS}
                    onClick={handleTogglePreviewVideoMute}
                    aria-label={isPreviewVideoMuted ? t("preview.unmuteVideo") : t("preview.muteVideo")}
                  >
                    {isPreviewVideoMuted ? <IoVolumeMute /> : <IoVolumeHigh />}
                  </button>

                  <button
                    type="button"
                    className={VIDEO_PREVIEW_CONTROL_BUTTON_CLASS}
                    onClick={() => void handleDownloadFromPreview()}
                    aria-label={t("preview.download")}
                  >
                    <IoDownloadOutline />
                  </button>

                  {canDeleteActivePreviewMessage ? (
                    <button
                      type="button"
                      className={cn(VIDEO_PREVIEW_CONTROL_BUTTON_CLASS, "text-destructive hover:text-destructive")}
                      onClick={() => void handleDeleteFromPreview()}
                      disabled={isDeletingMessage}
                      aria-label={t("preview.delete")}
                    >
                      <FiTrash2 />
                    </button>
                  ) : null}
                </div>

                <span className="text-sm font-semibold tabular-nums text-white/90">
                  {previewVideoCurrentTimeLabel} / {previewVideoDurationLabel}
                </span>

                <button
                  type="button"
                  className={VIDEO_PREVIEW_CONTROL_BUTTON_CLASS}
                  onClick={closeMediaPreview}
                  aria-label={t("preview.close")}
                >
                  <IoClose />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
