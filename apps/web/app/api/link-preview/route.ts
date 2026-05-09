import { lookup } from "node:dns/promises";

import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface LinkPreviewPayload {
  url: string;
  hostname: string;
  siteName: string;
  title: string;
  description: string;
}

const FETCH_TIMEOUT_MS = 6_000;
const MAX_HTML_LENGTH = 400_000;
const MAX_REDIRECTS = 5;
const ACCEPT_HEADER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const USER_AGENT =
  "Mozilla/5.0 (compatible; OrisignLinkPreview/1.0; +https://orisign.ru)";

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ")
    .replace(/&#(\d+);/g, (_match, code) => {
      const numericCode = Number(code);
      if (!Number.isFinite(numericCode)) return "";
      return String.fromCharCode(numericCode);
    });
}

function cleanText(value: string | null | undefined) {
  if (!value) return "";
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function isPrivateIPv4(address: string) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) return false;

  const octets = address.split(".").map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return true;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

function isPrivateIPv6(address: string) {
  const lowered = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (lowered === "::1" || lowered === "::") return true;

  const ipv4MappedMatch = lowered.match(/^::ffff:([0-9a-f.:]+)$/);
  if (ipv4MappedMatch) {
    const mappedAddress = ipv4MappedMatch[1].includes(".")
      ? ipv4MappedMatch[1]
      : "";
    if (mappedAddress) return isPrivateIPv4(mappedAddress);
  }

  if (lowered.startsWith("fe8") || lowered.startsWith("fe9")) return true;
  if (lowered.startsWith("fea") || lowered.startsWith("feb")) return true;
  if (lowered.startsWith("fc") || lowered.startsWith("fd")) return true;

  return false;
}

function isPrivateAddress(address: string, family: number) {
  if (family === 6) return isPrivateIPv6(address);
  return isPrivateIPv4(address);
}

async function isSafeHostname(hostname: string) {
  const lowered = hostname.toLowerCase();
  if (
    lowered === "localhost" ||
    lowered === "ip6-localhost" ||
    lowered.endsWith(".local") ||
    lowered.endsWith(".internal")
  ) {
    return false;
  }

  try {
    const records = await lookup(hostname, { all: true });
    if (records.length === 0) return false;
    return records.every((record) => !isPrivateAddress(record.address, record.family));
  } catch {
    return false;
  }
}

async function resolveSafeUrl(rawUrl: string): Promise<string | null> {
  const candidate = rawUrl.trim();
  if (!candidate) return null;

  try {
    const parsedUrl = new URL(candidate);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    if (!(await isSafeHostname(parsedUrl.hostname))) return null;

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function extractMetaTagContent(html: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const directOrder = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const reverseOrder = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedKey}["'][^>]*>`,
    "i",
  );

  return html.match(directOrder)?.[1] ?? html.match(reverseOrder)?.[1] ?? "";
}

function createFallbackPreview(urlValue: string): LinkPreviewPayload {
  const parsedUrl = new URL(urlValue);
  const host = parsedUrl.hostname.replace(/^www\./, "");

  return {
    url: parsedUrl.toString(),
    hostname: host,
    siteName: host,
    title: host,
    description: "",
  };
}

function parseLinkPreviewFromHtml(urlValue: string, html: string): LinkPreviewPayload {
  const fallback = createFallbackPreview(urlValue);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";

  const title = cleanText(
    extractMetaTagContent(html, "og:title") ||
      extractMetaTagContent(html, "twitter:title") ||
      titleMatch,
  );
  const description = cleanText(
    extractMetaTagContent(html, "og:description") ||
      extractMetaTagContent(html, "twitter:description") ||
      extractMetaTagContent(html, "description"),
  );
  const siteName = cleanText(
    extractMetaTagContent(html, "og:site_name") || fallback.siteName,
  );

  return {
    url: fallback.url,
    hostname: fallback.hostname,
    siteName: siteName || fallback.siteName,
    title: title || fallback.title,
    description: description || "",
  };
}

async function fetchWithSafeRedirects(initialUrl: string, signal: AbortSignal) {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal,
      headers: {
        Accept: ACCEPT_HEADER,
        "User-Agent": USER_AGENT,
      },
    });

    const isRedirect = response.status >= 300 && response.status < 400;
    if (!isRedirect) return response;

    const location = response.headers.get("location");
    if (!location) return response;

    let nextUrl: URL;
    try {
      nextUrl = new URL(location, currentUrl);
    } catch {
      return null;
    }

    if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
      return null;
    }

    if (!(await isSafeHostname(nextUrl.hostname))) return null;

    currentUrl = nextUrl.toString();
  }

  return null;
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url") ?? "";
  const normalizedUrl = await resolveSafeUrl(rawUrl);

  if (!normalizedUrl) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const fallback = createFallbackPreview(normalizedUrl);
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    const response = await fetchWithSafeRedirects(
      normalizedUrl,
      abortController.signal,
    );

    if (!response || !response.ok) {
      return NextResponse.json(fallback, { status: 200 });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      return NextResponse.json(fallback, { status: 200 });
    }

    const html = (await response.text()).slice(0, MAX_HTML_LENGTH);
    const preview = parseLinkPreviewFromHtml(normalizedUrl, html);
    return NextResponse.json(preview, { status: 200 });
  } catch {
    return NextResponse.json(fallback, { status: 200 });
  } finally {
    clearTimeout(timeoutId);
  }
}
