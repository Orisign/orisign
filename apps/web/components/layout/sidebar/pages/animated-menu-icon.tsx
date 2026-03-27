"use client";

import { motion } from "motion/react";

export function SidebarAnimatedMenuIcon({ isBack }: { isBack: boolean }) {
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 24 24"
      className="block size-6 text-current"
      fill="none"
      initial={false}
    >
      <motion.path
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        initial={false}
        animate={{
          d: isBack ? "M 12 7 L 7 12" : "M 5.5 7 L 18.5 7",
        }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.path
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        initial={false}
        animate={{
          d: isBack ? "M 12 17 L 7 12" : "M 5.5 12 L 18.5 12",
        }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.path
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        initial={false}
        animate={{
          d: isBack ? "M 8 12 L 17.5 12" : "M 5.5 17 L 18.5 17",
          opacity: 1,
        }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.svg>
  );
}
