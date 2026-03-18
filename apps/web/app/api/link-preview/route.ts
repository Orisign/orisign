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

function normalizePreviewUrl(rawUrl: string, requestHost: string | null) {
  const candidate = rawUrl.trim();
  if (!candidate) return null;

  try {
    const parsedUrl = new URL(candidate);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const requestHostname = (() => {
      if (!requestHost) return "";

      try {
        return new URL(`http://${requestHost}`).hostname.toLowerCase();
      } catch {
        return "";
      }
    })();
    const isSameHost = Boolean(requestHostname) && requestHostname === hostname;
    const isLocalHostname =
      hostname === "localhost" || hostname === "::1" || hostname.endsWith(".local");

    if (isLocalHostname && !isSameHost) {
      return null;
    }

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      const octets = hostname.split(".").map((part) => Number(part));
      if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
        return null;
      }

      const [first, second] = octets;
      const isPrivateNetwork =
        first === 10 ||
        first === 127 ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168);

      if (isPrivateNetwork && !isSameHost) {
        return null;
      }
    }

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

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url") ?? "";
  const requestHost = request.headers.get("host");
  const normalizedUrl = normalizePreviewUrl(rawUrl, requestHost);

  if (!normalizedUrl) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const fallback = createFallbackPreview(normalizedUrl);
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(normalizedUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: abortController.signal,
      headers: {
        Accept: ACCEPT_HEADER,
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
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
