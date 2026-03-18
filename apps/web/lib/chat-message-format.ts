export interface TextSelectionRange {
  start: number;
  end: number;
}

interface FormattingTransformResult {
  nextText: string;
  nextSelection: TextSelectionRange;
}

const MARKDOWN_LINK_REGEX_SOURCE = /\[([^\]\n]{1,320})\]\((https?:\/\/[^\s)]+)\)/;
const RAW_URL_REGEX_SOURCE = /\bhttps?:\/\/[^\s<>"')]+[^\s<>"'.,!?;:)]/;

function createMarkdownLinkRegex() {
  return new RegExp(MARKDOWN_LINK_REGEX_SOURCE.source, "gi");
}

function createRawUrlRegex() {
  return new RegExp(RAW_URL_REGEX_SOURCE.source, "gi");
}

function clampSelectionRange(
  text: string,
  selection: TextSelectionRange,
): TextSelectionRange {
  const safeStart = Math.max(0, Math.min(text.length, selection.start));
  const safeEnd = Math.max(0, Math.min(text.length, selection.end));

  return safeStart <= safeEnd
    ? { start: safeStart, end: safeEnd }
    : { start: safeEnd, end: safeStart };
}

function withSelectionReplacement(
  text: string,
  selection: TextSelectionRange,
  replacement: string,
): FormattingTransformResult {
  const safeSelection = clampSelectionRange(text, selection);
  const nextText =
    text.slice(0, safeSelection.start) +
    replacement +
    text.slice(safeSelection.end);
  const nextCaret = safeSelection.start + replacement.length;

  return {
    nextText,
    nextSelection: {
      start: nextCaret,
      end: nextCaret,
    },
  };
}

export function normalizeMessageUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function extractMessageUrls(text: string, limit = 3) {
  if (!text.trim()) {
    return [];
  }

  const uniqueUrls = new Set<string>();

  const pushUrl = (rawUrl: string) => {
    const normalizedUrl = normalizeMessageUrl(rawUrl);
    if (!normalizedUrl) return;

    uniqueUrls.add(normalizedUrl);
  };

  for (const match of text.matchAll(createMarkdownLinkRegex())) {
    pushUrl(match[2] ?? "");
    if (uniqueUrls.size >= limit) {
      return Array.from(uniqueUrls).slice(0, limit);
    }
  }

  const textWithoutMarkdownLinks = text.replace(createMarkdownLinkRegex(), " ");
  for (const match of textWithoutMarkdownLinks.matchAll(createRawUrlRegex())) {
    pushUrl(match[0] ?? "");
    if (uniqueUrls.size >= limit) {
      return Array.from(uniqueUrls).slice(0, limit);
    }
  }

  return Array.from(uniqueUrls).slice(0, limit);
}

export function stripMessageFormatting(text: string) {
  if (!text) return "";

  return text
    .replace(createMarkdownLinkRegex(), "$1")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/\+\+([\s\S]+?)\+\+/g, "$1")
    .replace(/~~([\s\S]+?)~~/g, "$1")
    .replace(/\|\|([\s\S]+?)\|\|/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^>\s?/gm, "");
}

export function wrapSelectionWithMarkers(
  text: string,
  selection: TextSelectionRange,
  marker: string,
): FormattingTransformResult {
  const safeSelection = clampSelectionRange(text, selection);
  const selectedText = text.slice(safeSelection.start, safeSelection.end);
  const hasSelection = safeSelection.start !== safeSelection.end;

  if (!hasSelection) {
    const nextText =
      text.slice(0, safeSelection.start) +
      marker +
      marker +
      text.slice(safeSelection.end);
    const nextCaret = safeSelection.start + marker.length;

    return {
      nextText,
      nextSelection: {
        start: nextCaret,
        end: nextCaret,
      },
    };
  }

  const wrapped = `${marker}${selectedText}${marker}`;
  return withSelectionReplacement(text, safeSelection, wrapped);
}

export function applyQuoteFormatting(
  text: string,
  selection: TextSelectionRange,
): FormattingTransformResult {
  const safeSelection = clampSelectionRange(text, selection);
  const lineStart = text.lastIndexOf("\n", safeSelection.start - 1) + 1;
  const lineEndCandidate = text.indexOf("\n", safeSelection.end);
  const lineEnd = lineEndCandidate === -1 ? text.length : lineEndCandidate;
  const selectedBlock = text.slice(lineStart, lineEnd);
  const lines = selectedBlock.split("\n");
  const shouldUnquote = lines.every((line) => line.trimStart().startsWith("> "));

  const transformed = lines
    .map((line) => {
      if (shouldUnquote) {
        return line.replace(/^(\s*)>\s?/, "$1");
      }

      return line.length > 0 ? `> ${line}` : "> ";
    })
    .join("\n");

  return {
    nextText: text.slice(0, lineStart) + transformed + text.slice(lineEnd),
    nextSelection: {
      start: lineStart,
      end: lineStart + transformed.length,
    },
  };
}

export function clearFormattingFromSelection(
  text: string,
  selection: TextSelectionRange,
): FormattingTransformResult {
  const safeSelection = clampSelectionRange(text, selection);
  const hasSelection = safeSelection.start !== safeSelection.end;

  if (!hasSelection) {
    const clearedText = stripMessageFormatting(text);
    return {
      nextText: clearedText,
      nextSelection: {
        start: Math.min(clearedText.length, safeSelection.start),
        end: Math.min(clearedText.length, safeSelection.start),
      },
    };
  }

  const selectedText = text.slice(safeSelection.start, safeSelection.end);
  const clearedSelection = stripMessageFormatting(selectedText);
  return withSelectionReplacement(text, safeSelection, clearedSelection);
}

export function insertMarkdownLink(
  text: string,
  selection: TextSelectionRange,
  url: string,
): FormattingTransformResult {
  const safeSelection = clampSelectionRange(text, selection);
  const normalizedUrl = normalizeMessageUrl(url);
  if (!normalizedUrl) {
    return {
      nextText: text,
      nextSelection: safeSelection,
    };
  }

  const selectedText = text.slice(safeSelection.start, safeSelection.end).trim();
  const label = selectedText || normalizedUrl;
  const linked = `[${label}](${normalizedUrl})`;

  return withSelectionReplacement(text, safeSelection, linked);
}

export function insertTextAtSelection(
  text: string,
  selection: TextSelectionRange,
  insertedText: string,
): FormattingTransformResult {
  return withSelectionReplacement(text, selection, insertedText);
}
