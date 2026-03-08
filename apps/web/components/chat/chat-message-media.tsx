"use client";
/* eslint-disable @next/next/no-img-element */

import { cn } from "@/lib/utils";
import {
  getMediaLabel,
  isImageMediaKey,
  resolveStorageFileUrl,
} from "@/lib/chat";

interface ChatMessageMediaProps {
  mediaKeys: string[];
}

export function ChatMessageMedia({ mediaKeys }: ChatMessageMediaProps) {
  const mediaItems = mediaKeys
    .filter(Boolean)
    .map((key) => ({
      key,
      url: resolveStorageFileUrl(key),
      isImage: isImageMediaKey(key),
      label: getMediaLabel(key),
    }));

  if (mediaItems.length === 0) return null;

  const imageItems = mediaItems.filter((item) => item.isImage && item.url);
  const fileItems = mediaItems.filter((item) => !item.isImage);

  return (
    <div className="space-y-2">
      {imageItems.length > 0 ? (
        <div
          className={cn(
            "grid gap-1.5 overflow-hidden rounded-2xl",
            imageItems.length === 1 ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {imageItems.map((item) => (
            <img
              key={item.key}
              src={item.url}
              alt=""
              loading="lazy"
              className={cn(
                "w-full object-cover",
                imageItems.length === 1 ? "max-h-[26rem]" : "aspect-square",
              )}
            />
          ))}
        </div>
      ) : null}

      {fileItems.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {fileItems.map((item) => (
            <div
              key={item.key}
              className="rounded-xl border border-border/60 bg-background/50 px-2.5 py-1 text-xs font-medium text-muted-foreground"
            >
              {item.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
