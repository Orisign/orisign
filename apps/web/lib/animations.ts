import { type Transition, type Variants, useInView } from "motion/react";
import { useRef } from "react";

type InViewMotionOptions = Pick<
  NonNullable<Parameters<typeof useInView>[1]>,
  "once" | "amount" | "margin"
>;

type StaggerOptions = {
  delayChildren?: number;
  staggerChildren?: number;
};

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_SMOOTH_IN = [0.4, 0, 1, 1] as const;
const EASE_GENTLE = [0.16, 1, 0.3, 1] as const;
const EASE_STANDARD = [0.4, 0, 0.2, 1] as const;

export const SPRING_SOFT: Transition = {
  type: "tween",
  duration: 0.24,
  ease: EASE_GENTLE,
};

export const SPRING_SNAPPY: Transition = {
  type: "tween",
  duration: 0.16,
  ease: EASE_SMOOTH_IN,
};

export const SPRING_LAYOUT: Transition = {
  type: "tween",
  duration: 0.2,
  ease: EASE_SMOOTH_OUT,
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
  type: "tween",
  duration: 0.14,
  ease: EASE_SMOOTH_OUT,
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
  hidden: (isOwn: boolean) => ({
    opacity: 0,
    scale: 0.8,
    transformOrigin: isOwn ? "right center" : "left center",
  }),
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "tween",
      duration: 0.3,
      ease: EASE_STANDARD,
    },
  },
  exit: (isOwn: boolean) => ({
    opacity: 0,
    scale: 0.88,
    transformOrigin: isOwn ? "right center" : "left center",
    transition: {
      type: "tween",
      duration: 0.25,
      ease: EASE_STANDARD,
    },
  }),
};

export const messageListLayoutTransition: Transition = {
  type: "tween",
  duration: 0.25,
  ease: EASE_STANDARD,
};

export const selectionToggleVariants: Variants = {
  hidden: { opacity: 0, x: -8, scale: 0.92 },
  visible: { opacity: 1, x: 0, scale: 1, transition: SPRING_MICRO },
  exit: { opacity: 0, x: -8, scale: 0.92, transition: SPRING_MICRO },
};

export const replyPanelVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.99 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING_SOFT },
  exit: { opacity: 0, y: 10, scale: 0.99, transition: SPRING_SNAPPY },
};

export const swapYVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: SPRING_MICRO },
  exit: { opacity: 0, y: -10, transition: SPRING_MICRO },
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
