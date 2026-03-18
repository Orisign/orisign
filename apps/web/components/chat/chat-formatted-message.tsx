"use client";

import { normalizeMessageUrl } from "@/lib/chat-message-format";
import { escapeHtml, parseTwemojiText } from "@/lib/twemoji";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { type ReactNode, useState } from "react";

interface ChatFormattedMessageProps {
  text: string;
  isOwn: boolean;
  className?: string;
}

type InlineMatchType =
  | "markdown-link"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "spoiler"
  | "code"
  | "url";

interface InlineMatch {
  type: InlineMatchType;
  index: number;
  raw: string;
  content?: string;
  url?: string;
}

const INLINE_PATTERNS: Array<{
  type: InlineMatchType;
  regex: RegExp;
}> = [
  {
    type: "markdown-link",
    regex: /\[([^\]\n]{1,320})\]\((https?:\/\/[^\s)]+)\)/,
  },
  {
    type: "bold",
    regex: /\*\*([\s\S]+?)\*\*/,
  },
  {
    type: "italic",
    regex: /__([\s\S]+?)__/,
  },
  {
    type: "underline",
    regex: /\+\+([\s\S]+?)\+\+/,
  },
  {
    type: "strike",
    regex: /~~([\s\S]+?)~~/,
  },
  {
    type: "spoiler",
    regex: /\|\|([\s\S]+?)\|\|/,
  },
  {
    type: "code",
    regex: /`([^`\n]+)`/,
  },
  {
    type: "url",
    regex: /\bhttps?:\/\/[^\s<>"')]+[^\s<>"'.,!?;:)]/,
  },
];

function renderPlainSegment(segment: string, key: string) {
  if (!segment) return null;

  return (
    <span
      key={key}
      dangerouslySetInnerHTML={{
        __html: parseTwemojiText(escapeHtml(segment)),
      }}
    />
  );
}

function ChatSpoiler({
  children,
  isOwn,
}: {
  children: ReactNode;
  isOwn: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setRevealed((currentValue) => !currentValue);
      }}
      className="relative inline-flex max-w-full items-center overflow-hidden rounded-sm px-1 py-0.5 align-baseline"
    >
      <motion.span
        initial={false}
        animate={revealed
          ? {
              opacity: 1,
              scale: 1,
            }
          : {
              opacity: 0,
              scale: 0.99,
            }}
        transition={{
          duration: 0.2,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="relative z-10"
      >
        {children}
      </motion.span>

      {!revealed ? (
        <motion.span
          aria-hidden
          initial={{ opacity: 0.85 }}
          animate={{
            opacity: [0.65, 0.85, 0.65],
          }}
          transition={{
            duration: 1.4,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
          className={cn(
            "absolute inset-0 rounded-sm",
            isOwn
              ? "bg-primary-foreground/80"
              : "bg-foreground/80",
          )}
        />
      ) : null}
    </button>
  );
}

function findEarliestInlineMatch(text: string, startIndex: number): InlineMatch | null {
  const segment = text.slice(startIndex);
  let bestMatch: InlineMatch | null = null;

  for (const pattern of INLINE_PATTERNS) {
    const match = segment.match(pattern.regex);
    if (!match || match.index == null) continue;

    const currentMatch: InlineMatch = {
      type: pattern.type,
      index: startIndex + match.index,
      raw: match[0] ?? "",
      content: match[1],
      url: pattern.type === "markdown-link" ? match[2] : match[0],
    };

    if (!bestMatch || currentMatch.index < bestMatch.index) {
      bestMatch = currentMatch;
      continue;
    }

    if (bestMatch && currentMatch.index === bestMatch.index) {
      const bestMatchType = bestMatch.type;
      const bestOrder = INLINE_PATTERNS.findIndex((entry) => entry.type === bestMatchType);
      const currentOrder = INLINE_PATTERNS.findIndex((entry) => entry.type === currentMatch.type);
      if (currentOrder >= 0 && bestOrder >= 0 && currentOrder < bestOrder) {
        bestMatch = currentMatch;
      }
    }
  }

  return bestMatch;
}

function renderInlineFormatted(
  text: string,
  keyPrefix: string,
  isOwn: boolean,
  depth = 0,
): ReactNode[] {
  if (!text) return [];

  if (depth > 10) {
    return [renderPlainSegment(text, `${keyPrefix}-depth-fallback`)];
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let segmentIndex = 0;

  while (cursor < text.length) {
    const match = findEarliestInlineMatch(text, cursor);
    if (!match) {
      nodes.push(renderPlainSegment(text.slice(cursor), `${keyPrefix}-text-${segmentIndex}`));
      break;
    }

    if (match.index > cursor) {
      nodes.push(
        renderPlainSegment(
          text.slice(cursor, match.index),
          `${keyPrefix}-text-${segmentIndex}`,
        ),
      );
      segmentIndex += 1;
    }

    const nextCursor = match.index + match.raw.length;
    const key = `${keyPrefix}-${match.type}-${match.index}-${segmentIndex}`;

    if (match.type === "url" || match.type === "markdown-link") {
      const normalizedUrl = normalizeMessageUrl(match.url ?? "");
      const linkLabel = match.type === "markdown-link" ? (match.content ?? "") : match.raw;

      if (!normalizedUrl) {
        nodes.push(renderPlainSegment(match.raw, `${key}-invalid-url`));
      } else {
        const nestedLabelNodes = renderInlineFormatted(
          linkLabel,
          `${key}-label`,
          isOwn,
          depth + 1,
        );
        nodes.push(
          <a
            key={key}
            href={normalizedUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-current underline-offset-2 hover:opacity-85"
          >
            {nestedLabelNodes}
          </a>,
        );
      }

      cursor = nextCursor;
      segmentIndex += 1;
      continue;
    }

    if (match.type === "code") {
      nodes.push(
        <code
          key={key}
          className={cn(
            "rounded-sm px-1 py-0.5 font-mono text-[0.92em]",
            isOwn
              ? "bg-primary-foreground/15 text-primary-foreground"
              : "bg-foreground/10 text-foreground",
          )}
        >
          {match.content ?? ""}
        </code>,
      );
      cursor = nextCursor;
      segmentIndex += 1;
      continue;
    }

    const nestedNodes = renderInlineFormatted(
      match.content ?? "",
      `${key}-inner`,
      isOwn,
      depth + 1,
    );

    if (match.type === "bold") {
      nodes.push(
        <strong key={key} className="font-semibold">
          {nestedNodes}
        </strong>,
      );
    } else if (match.type === "italic") {
      nodes.push(
        <em key={key} className="italic">
          {nestedNodes}
        </em>,
      );
    } else if (match.type === "underline") {
      nodes.push(
        <span key={key} className="underline decoration-current underline-offset-2">
          {nestedNodes}
        </span>,
      );
    } else if (match.type === "strike") {
      nodes.push(
        <span key={key} className="line-through">
          {nestedNodes}
        </span>,
      );
    } else if (match.type === "spoiler") {
      nodes.push(
        <ChatSpoiler key={key} isOwn={isOwn}>
          {nestedNodes}
        </ChatSpoiler>,
      );
    } else {
      nodes.push(renderPlainSegment(match.raw, `${key}-fallback`));
    }

    cursor = nextCursor;
    segmentIndex += 1;
  }

  return nodes;
}

export function ChatFormattedMessage({
  text,
  isOwn,
  className,
}: ChatFormattedMessageProps) {
  const lines = text.split("\n");

  return (
    <div
      className={cn(
        "whitespace-pre-wrap break-words text-[length:var(--chat-message-font-size,15px)] leading-[1.15] [overflow-wrap:anywhere]",
        className,
      )}
    >
      {lines.map((line, lineIndex) => {
        const trimStartLine = line.trimStart();
        const isQuote = trimStartLine.startsWith("> ");
        const quotePrefixLength = line.length - trimStartLine.length;
        const plainLine = isQuote
          ? line.slice(0, quotePrefixLength) + trimStartLine.slice(2)
          : line;

        const contentNodes = renderInlineFormatted(
          plainLine,
          `line-${lineIndex}`,
          isOwn,
        );

        const lineNode = isQuote ? (
          <span
            key={`line-${lineIndex}`}
            className={cn(
              "inline-block rounded-sm border-l-2 px-1.5 py-0.5",
              isOwn
                ? "border-primary-foreground/60 bg-primary-foreground/10"
                : "border-primary/70 bg-foreground/10",
            )}
          >
            {contentNodes}
          </span>
        ) : (
          <span key={`line-${lineIndex}`}>{contentNodes}</span>
        );

        return (
          <span key={`line-wrap-${lineIndex}`}>
            {lineNode}
            {lineIndex < lines.length - 1 ? <br /> : null}
          </span>
        );
      })}
    </div>
  );
}
