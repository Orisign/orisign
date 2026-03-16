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

export const SPRING_SOFT: Transition = {
  type: "spring",
  stiffness: 250,
  damping: 25,
  mass: 0.8,
};

export const SPRING_SNAPPY: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 28,
  mass: 0.75,
};

export const SPRING_LAYOUT: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 30,
  mass: 0.78,
};

export const SPRING_SIDEBAR_SLIDE: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 42,
  mass: 0.6,
  restSpeed: 0.25,
  restDelta: 0.25,
};

export const SPRING_SIDEBAR_ENTER: Transition = {
  type: "tween",
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1],
};

export const SPRING_SIDEBAR_EXIT: Transition = {
  type: "tween",
  duration: 0.16,
  ease: [0.4, 0, 1, 1],
};

export const SPRING_MICRO: Transition = {
  type: "spring",
  stiffness: 340,
  damping: 32,
  mass: 0.68,
};

export const SPRING_SHAKE: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 24,
  mass: 0.45,
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
  hidden: { opacity: 0, scale: 0.86, y: 4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: SPRING_MICRO },
  exit: { opacity: 0, scale: 0.86, y: -4, transition: SPRING_MICRO },
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
  hidden: { opacity: 0, y: 12, scale: 0.99 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING_SOFT },
  exit: { opacity: 0, y: -10, scale: 0.99, transition: SPRING_SNAPPY },
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
  delayChildren = 0.02,
  staggerChildren = 0.045,
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
