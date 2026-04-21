const DEFAULT_API_BASE_URL = "http://localhost:4000";
const DEFAULT_STORAGE_BASE_URL = "";

function normalizeBaseUrl(value: string) {
  if (!value) {
    return "";
  }

  return value.endsWith("/") ? value : `${value}/`;
}

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL;
}

export function getStorageBaseUrl() {
  return process.env.NEXT_PUBLIC_STORAGE_URL ?? DEFAULT_STORAGE_BASE_URL;
}

export function buildApiUrl(path: string) {
  const normalizedBaseUrl = normalizeBaseUrl(getApiBaseUrl());
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

  return new URL(normalizedPath, normalizedBaseUrl).toString();
}

export function buildStorageFileUrl(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const baseUrl = normalizeBaseUrl(getStorageBaseUrl());
  const normalizedPath = value.startsWith("/") ? value.slice(1) : value;

  return `${baseUrl}${normalizedPath}`;
}

export function buildWebSocketUrl(
  path: string,
  params: Record<string, string | null | undefined>,
) {
  const url = new URL(getApiBaseUrl());

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = path;

  Object.entries(params).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    url.searchParams.set(key, value);
  });

  return url.toString();
}
