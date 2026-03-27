import { type Transition, type Variants, useInView } from "motion/react";
import { useRef } from "react";
import { EASE, EASING, SPRING, TIMING } from "./animation-config";

type InViewMotionOptions = Pick<
  NonNullable<Parameters<typeof useInView>[1]>,
  "once" | "amount" | "margin"
>;

type StaggerOptions = {
  delayChildren?: number;
  staggerChildren?: number;
};

const EASE_SMOOTH_OUT = EASING.spring;
const EASE_SMOOTH_IN = EASING.exit;

export const SPRING_SOFT: Transition = {
  ...SPRING.bubble,
};

export const SPRING_SNAPPY: Transition = {
  type: "tween",
  duration: 0.16,
  ease: EASE_SMOOTH_IN,
};

export const SPRING_LAYOUT: Transition = {
  ...SPRING.layout,
};

export const SPRING_SIDEBAR_SLIDE: Transition = {
  type: "tween",
  duration: 0.2,
  ease: EASE_SMOOTH_OUT,
};

export const SPRING_SIDEBAR_ENTER: Transition = {
  type: "tween",
  duration: 0.2,
  ease: EASE_SMOOTH_OUT,
};

export const SPRING_SIDEBAR_EXIT: Transition = {
  type: "tween",
  duration: 0.15,
  ease: EASE_SMOOTH_IN,
};

export const SPRING_MICRO: Transition = {
  ...SPRING.micro,
};

export const SPRING_SHAKE: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 28,
  mass: 0.55,
};

export const fadeY = (distance = 10): Variants => ({
  hidden: { opacity: 0, y: distance },
  visible: {
    opacity: 1,
    y: 0,
    transition: SPRING_SOFT,
  },
  exit: {
    opacity: 0,
    y: -distance,
    transition: SPRING_SNAPPY,
  },
});

export const fadeX = (distance = 24): Variants => ({
  hidden: { opacity: 0, x: distance },
  visible: { opacity: 1, x: 0, transition: SPRING_SOFT },
  exit: { opacity: 0, x: -distance, transition: SPRING_SNAPPY },
});

export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.985, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: SPRING_SOFT },
  exit: { opacity: 0, scale: 0.985, y: 8, transition: SPRING_SNAPPY },
};

export const iconSwap: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 3 },
  visible: { opacity: 1, scale: 1, y: 0, transition: SPRING_MICRO },
  exit: { opacity: 0, scale: 0.9, y: -3, transition: SPRING_MICRO },
};

export const sidebarSlideVariants: Variants = {
  enter: (direction: 1 | -1) => ({
    x: direction === 1 ? "92%" : "-92%",
    zIndex: 20,
    transition: SPRING_SIDEBAR_ENTER,
  }),
  center: {
    x: 0,
    zIndex: 20,
    transition: SPRING_SIDEBAR_ENTER,
  },
  exit: (direction: 1 | -1) => ({
    x: direction === 1 ? "-100%" : "100%",
    zIndex: 10,
    transition: SPRING_SIDEBAR_EXIT,
  }),
};

export const messageListItemVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.85,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: SPRING.bubble,
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    transition: EASE.exit,
  },
};

export const messageListLayoutTransition: Transition = {
  ...SPRING.layout,
};

export const selectionToggleVariants: Variants = {
  hidden: { opacity: 0, x: -20, scale: 0 },
  visible: { opacity: 1, x: 0, scale: 1, transition: SPRING.micro },
  exit: { opacity: 0, x: -20, scale: 0, transition: EASE.exit },
};

export const replyPanelVariants: Variants = {
  hidden: { height: 0, opacity: 0, y: 8, clipPath: "inset(100% 0% 0% 100%)" },
  visible: {
    height: "auto",
    opacity: 1,
    y: 0,
    clipPath: "inset(0% 0% 0% 0%)",
    transition: {
      height: SPRING.input,
      opacity: { duration: TIMING.fast, ease: EASING.spring, delay: 0.06 },
      y: { duration: TIMING.fast, ease: EASING.spring, delay: 0.04 },
      clipPath: { duration: TIMING.layout, ease: EASING.spring },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    y: -6,
    clipPath: "inset(100% 0% 0% 100%)",
    transition: {
      height: { type: "tween", duration: TIMING.fast, ease: EASING.exit },
      opacity: { type: "tween", duration: TIMING.micro, ease: "easeIn" },
      y: { type: "tween", duration: TIMING.fast, ease: EASING.exit },
      clipPath: { type: "tween", duration: TIMING.normal, ease: EASING.exit },
    },
  },
};

export const replyKeyboardVariants: Variants = {
  hidden: { height: 0, opacity: 0, y: 16 },
  visible: {
    height: "auto",
    opacity: 1,
    y: 0,
    transition: {
      height: SPRING.keyboard,
      opacity: { duration: TIMING.fast, ease: EASING.spring, delay: 0.08 },
      y: { duration: TIMING.keyboard, ease: EASING.spring },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    y: 16,
    transition: {
      height: { type: "tween", duration: TIMING.fast, ease: EASING.exit },
      opacity: { type: "tween", duration: TIMING.fast, ease: "easeIn" },
      y: { type: "tween", duration: TIMING.normal, ease: EASING.exit },
    },
  },
};

export const composerAttachmentsVariants: Variants = {
  hidden: { opacity: 0, y: 16, height: 0 },
  visible: {
    opacity: 1,
    y: 0,
    height: "auto",
    transition: {
      height: SPRING.input,
      opacity: { duration: TIMING.fast, ease: EASING.spring },
      y: { duration: TIMING.normal, ease: EASING.spring },
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    y: 12,
    height: 0,
    transition: {
      height: { type: "tween", duration: TIMING.normal, ease: EASING.exit },
      opacity: { duration: TIMING.fast, ease: EASING.exit },
      y: { duration: TIMING.fast, ease: EASING.exit },
    },
  },
};

export const composerAttachmentItemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: TIMING.normal,
      ease: EASING.spring,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.6,
    transition: {
      duration: TIMING.fast,
      ease: EASING.exit,
    },
  },
};

export const composerInputRowVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: TIMING.normal, ease: EASING.spring },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: TIMING.fast, ease: EASING.exit },
  },
};

export const composerRecordingRowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: TIMING.normal, ease: EASING.spring },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: TIMING.fast, ease: EASING.exit },
  },
};

export const composerActionButtonVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: TIMING.fast, ease: EASING.spring },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: -4,
    transition: { duration: TIMING.fast, ease: EASING.exit },
  },
};

export const composerRecordModeVariants: Variants = {
  hidden: { opacity: 0, x: 12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: TIMING.fast, ease: EASING.spring },
  },
  exit: {
    opacity: 0,
    x: 12,
    transition: { duration: TIMING.fast, ease: EASING.exit },
  },
};

export const composerLockIndicatorVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: TIMING.normal, ease: EASING.spring },
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.9,
    transition: { duration: TIMING.fast, ease: EASING.exit },
  },
};

export const composerLockedControlsVariants: Variants = {
  hidden: { opacity: 0, x: 10, scale: 0.5 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: TIMING.normal, ease: EASING.spring },
  },
  exit: {
    opacity: 0,
    x: 10,
    scale: 0.8,
    transition: { duration: TIMING.fast, ease: EASING.exit },
  },
};

export const composerBlockedOverlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: TIMING.normal, ease: EASING.spring },
  },
  exit: {
    opacity: 0,
    transition: { duration: TIMING.fast, ease: EASING.exit },
  },
};

export const swapYVariants: Variants = {
  hidden: { opacity: 0, scale: 0.5, rotate: -90 },
  visible: { opacity: 1, scale: 1, rotate: 0, transition: SPRING.micro },
  exit: { opacity: 0, scale: 0.5, rotate: 90, transition: EASE.exit },
};

export function createStaggerContainerVariants({
  delayChildren = 0.01,
  staggerChildren = 0.03,
}: StaggerOptions = {}): Variants {
  return {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        ...SPRING_SOFT,
        delayChildren,
        staggerChildren,
      },
    },
  };
}

export function useInViewMotion<T extends Element = HTMLDivElement>(
  options: InViewMotionOptions = {},
) {
  const ref = useRef<T | null>(null);
  const inView = useInView(ref, {
    once: options.once ?? true,
    amount: options.amount ?? 0.08,
    margin: options.margin ?? "0px 0px -10% 0px",
  });

  return {
    ref,
    inView,
    initial: "hidden" as const,
    animate: (inView ? "visible" : "hidden") as "visible" | "hidden",
  };
}
