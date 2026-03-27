"use client";

import { cn } from "@/lib/utils";
import { memo, useMemo } from "react";
import { IoPause, IoPlay } from "react-icons/io5";
import { buildWaveform, formatDuration } from "./utils";

export const RightSidebarVoiceRow = memo(function RightSidebarVoiceRow({
  id,
  duration,
  progress,
  isPlaying,
  createdAt,
  onToggle,
}: {
  id: string;
  duration: number;
  progress: number;
  isPlaying: boolean;
  createdAt: string;
  onToggle: () => void;
}) {
  const waveform = useMemo(() => buildWaveform(id), [id]);

  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex w-full items-center gap-2 rounded-2xl bg-accent/30 px-3 py-2 text-left transition-colors hover:bg-accent/55"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        {isPlaying ? (
          <IoPause className="size-4" />
        ) : (
          <IoPlay className="size-4 translate-x-[1px]" />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex h-8 items-end gap-px">
          {waveform.map((height, index) => {
            const threshold = ((index + 1) / waveform.length) * 100;
            const active = progress >= threshold;

            return (
              <span
                key={`${id}-wave-${index}`}
                className={cn(
                  "w-1 rounded-full transition-colors",
                  active ? "bg-primary" : "bg-muted-foreground/45",
                )}
                style={{ height: `${Math.max(2, Math.round((height / 100) * 30))}px` }}
              />
            );
          })}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {formatDuration((duration * progress) / 100)} / {formatDuration(duration)}
        </span>
      </span>

      <span className="shrink-0 text-xs text-muted-foreground">{createdAt}</span>
    </button>
  );
});
