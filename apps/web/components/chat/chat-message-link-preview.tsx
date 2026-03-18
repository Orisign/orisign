"use client";

import { normalizeMessageUrl } from "@/lib/chat-message-format";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

interface LinkPreviewResponse {
  url: string;
  hostname: string;
  siteName: string;
  title: string;
  description: string;
}

interface ChatMessageLinkPreviewProps {
  url: string;
  isOwn: boolean;
}

async function fetchLinkPreview(url: string): Promise<LinkPreviewResponse> {
  const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load link preview");
  }

  return (await response.json()) as LinkPreviewResponse;
}

export function ChatMessageLinkPreview({
  url,
  isOwn,
}: ChatMessageLinkPreviewProps) {
  const normalizedUrl = normalizeMessageUrl(url);
  const hostFallback = useMemo(() => {
    if (!normalizedUrl) return "";

    try {
      return new URL(normalizedUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }, [normalizedUrl]);

  const previewQuery = useQuery({
    queryKey: ["chat", "link-preview", normalizedUrl],
    queryFn: () => fetchLinkPreview(normalizedUrl ?? ""),
    enabled: Boolean(normalizedUrl),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });

  if (!normalizedUrl) {
    return null;
  }

  const previewData = previewQuery.data;
  const title = previewData?.title || previewData?.siteName || hostFallback;
  const description = previewData?.description ?? "";
  const siteName = previewData?.siteName || hostFallback;

  return (
    <a
      href={normalizedUrl}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "group block rounded-xl border px-3 py-2 transition-colors duration-150",
        isOwn
          ? "border-primary-foreground/28 bg-primary-foreground/10 hover:bg-primary-foreground/14"
          : "border-border/65 bg-background/65 hover:bg-background/80",
      )}
    >
      <p
        className={cn(
          "truncate text-[11px] font-semibold uppercase tracking-wide",
          isOwn ? "text-primary-foreground/80" : "text-primary",
        )}
      >
        {siteName}
      </p>
      <p
        className={cn(
          "mt-0.5 line-clamp-2 text-[13px] font-semibold leading-[1.2]",
          isOwn ? "text-primary-foreground" : "text-foreground",
        )}
      >
        {title}
      </p>
      {description ? (
        <p
          className={cn(
            "mt-1 line-clamp-2 text-[12px] leading-[1.25]",
            isOwn ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      ) : null}
      {previewQuery.isFetching ? (
        <p
          className={cn(
            "mt-1 text-[11px]",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          Загрузка превью...
        </p>
      ) : null}
    </a>
  );
}
