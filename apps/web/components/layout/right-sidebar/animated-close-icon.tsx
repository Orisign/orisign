"use client";

import { motion } from "motion/react";

export function RightSidebarAnimatedCloseIcon({ isBack }: { isBack: boolean }) {
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 24 24"
      className="block text-current"
      fill="none"
      initial={false}
    >
      <motion.path
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        initial={false}
        animate={{
          d: isBack ? "M 12 7 L 7 12" : "M 7 7 L 17 17",
        }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.path
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        initial={false}
        animate={{
          d: isBack ? "M 12 17 L 7 12" : "M 17 7 L 7 17",
        }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.path
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        initial={false}
        animate={{
          d: isBack ? "M 8 12 L 17 12" : "M 12 12 L 12 12",
          opacity: isBack ? 1 : 0.25,
        }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.svg>
  );
}
