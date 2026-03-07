"use client";

import { parseTwemojiInElement } from "@/lib/twemoji";
import { type ReactNode, useEffect } from "react";

export function TwemojiProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.body;
    if (!root) return;

    let rafId: number | null = null;
    let isApplying = false;
    const pendingTargets = new Set<HTMLElement>();

    const flush = () => {
      rafId = null;
      isApplying = true;
      observer.disconnect();

      if (pendingTargets.size === 0) {
        parseTwemojiInElement(root);
      } else {
        pendingTargets.forEach((target) => parseTwemojiInElement(target));
      }
      pendingTargets.clear();

      observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      isApplying = false;
    };

    const schedule = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(flush);
    };

    const observer = new MutationObserver((mutations) => {
      if (isApplying) return;

      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          const parent = mutation.target.parentElement;
          if (parent) pendingTargets.add(parent);
          continue;
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            pendingTargets.add(node as HTMLElement);
            return;
          }

          if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            pendingTargets.add(node.parentElement);
          }
        });
      }

      schedule();
    });

    parseTwemojiInElement(root);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return <>{children}</>;
}
