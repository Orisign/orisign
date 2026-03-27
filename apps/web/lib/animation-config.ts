import type { Transition } from "motion/react";

export const TIMING = {
  instant: 0.1,
  micro: 0.12,
  fast: 0.18,
  normal: 0.22,
  layout: 0.28,
  keyboard: 0.32,
  slow: 0.4,
} as const;

export const EASING = {
  spring: [0.32, 0.72, 0, 1] as const,
  easeOut: [0, 0, 0.58, 1] as const,
  linear: "linear" as const,
  bounce: [0.34, 1.56, 0.64, 1] as const,
  exit: [0.4, 0, 0.2, 1] as const,
} as const;

export const SPRING = {
  bubble: { type: "tween", duration: TIMING.layout, ease: EASING.spring },
  layout: { type: "tween", duration: TIMING.layout, ease: EASING.spring },
  input: { type: "tween", duration: TIMING.layout, ease: EASING.spring },
  micro: { type: "tween", duration: TIMING.micro, ease: EASING.easeOut },
  keyboard: { type: "tween", duration: TIMING.keyboard, ease: EASING.spring },
} as const satisfies Record<string, Transition>;

export const EASE = {
  fade: { duration: TIMING.fast, ease: EASING.spring },
  exit: { duration: TIMING.fast, ease: EASING.exit },
} as const;
