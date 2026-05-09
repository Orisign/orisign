"use client";

const MEDIA_CACHE_NAME = "orisign-media-cache-v1";

export interface MediaCacheStats {
  totalBytes: number;
  imageBytes: number;
  videoBytes: number;
  otherBytes: number;
}

export type MediaCacheProgress = {
  loaded: number;
  total: number;
  percent: number;
};

function canUseCache() {
  return typeof window !== "undefined" && "caches" in window;
}

async function createCachedObjectUrl(response: Response) {
  return URL.createObjectURL(await response.blob());
}

export async function readCachedMedia(url: string) {
  if (!url) return "";

  if (!canUseCache()) return "";

  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const cached = await cache.match(url);
    return cached ? createCachedObjectUrl(cached) : "";
  } catch {
    return "";
  }
}

export async function cacheMedia(
  url: string,
  onProgress?: (progress: MediaCacheProgress) => void,
) {
  if (!url) return "";

  if (!canUseCache()) return url;

  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      return url;
    }

    const length = Number(response.headers.get("content-length") ?? 0);
    const total = Number.isFinite(length) && length > 0 ? length : 0;

    if (!response.body) {
      await cache.put(url, response.clone());
      return createCachedObjectUrl(response);
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.({
        loaded,
        total,
        percent: total > 0 ? Math.min(100, (loaded / total) * 100) : 0,
      });
    }

    const blob = new Blob(chunks, {
      type: response.headers.get("content-type") ?? undefined,
    });
    await cache.put(url, new Response(blob, { headers: response.headers }));
    onProgress?.({
      loaded: total || blob.size,
      total: total || blob.size,
      percent: 100,
    });

    return URL.createObjectURL(blob);
  } catch {
    return url;
  }
}

export async function loadCachedMedia(url: string) {
  const cachedUrl = await readCachedMedia(url);
  return cachedUrl || cacheMedia(url);
}

export async function clearMediaCache() {
  if (!canUseCache()) return;

  await caches.delete(MEDIA_CACHE_NAME);
}

export async function getMediaCacheStats(): Promise<MediaCacheStats> {
  const stats: MediaCacheStats = {
    totalBytes: 0,
    imageBytes: 0,
    videoBytes: 0,
    otherBytes: 0,
  };

  if (!canUseCache()) return stats;

  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      if (!response) continue;

      const type = response.headers.get("content-type") ?? "";
      const length = Number(response.headers.get("content-length") ?? 0);
      const size = Number.isFinite(length) && length > 0
        ? length
        : (await response.clone().blob()).size;

      stats.totalBytes += size;
      if (type.startsWith("image/")) stats.imageBytes += size;
      else if (type.startsWith("video/")) stats.videoBytes += size;
      else stats.otherBytes += size;
    }
  } catch {
    return stats;
  }

  return stats;
}
