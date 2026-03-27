"use client";

import { cn } from "@/lib/utils";
import { useCallback, useMemo, useState } from "react";

interface ChatSpoilerTextProps {
  text: string;
  isOwn: boolean;
  className?: string;
}

function supportsHover() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Lightweight "whisper" spoiler.
 *
 * Hidden:
 * - soft blurred text
 * - dimmed tinted background
 * - eye hint
 *
 * Reveal:
 * - hover on desktop
 * - click/tap on mobile and as a fallback on desktop
 * - optional short vibration on mobile
 */
export function ChatSpoilerText({
  text,
  isOwn,
  className,
}: ChatSpoilerTextProps) {
  const canHover = useMemo(() => supportsHover(), []);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const isRevealed = canHover ? isHovered || isPressed : isPressed;

  const copyText = useCallback(() => {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(30);
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
  }, [text]);

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        copyText();
      }}
      onPointerDown={() => {
        setIsPressed(true);
      }}
      onPointerUp={() => {
        setIsPressed(false);
      }}
      onPointerCancel={() => {
        setIsPressed(false);
      }}
      onMouseEnter={() => {
        if (canHover) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => {
        if (canHover) {
          setIsHovered(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          copyText();
        }
      }}
      className={cn(
        "inline max-w-full cursor-pointer text-left align-baseline outline-none",
        className,
      )}
      style={{
        userSelect: isRevealed ? "text" : "none",
      }}
      aria-label={isRevealed ? "Spoiler text revealed" : "Spoiler text hidden"}
    >
      <span
        className={cn(
          "whitespace-pre-wrap break-words transition-[filter,opacity] duration-200 ease-out",
          isRevealed ? "opacity-100 blur-0" : "opacity-80 blur-[5px]",
          isOwn ? "text-primary-foreground" : "text-foreground",
        )}
      >
        {text}
      </span>
    </span>
  );
}
