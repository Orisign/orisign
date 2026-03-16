"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCallSecurityEmojiFingerprint } from "@/lib/call-security";
import { cn } from "@/lib/utils";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiLock } from "react-icons/fi";
import { RiCloseLine, RiPhoneFill, RiPhoneLine } from "react-icons/ri";
import type { CallState } from "@/hooks/use-direct-call";

interface ChatCallWindowProps {
  state: CallState;
  error: string | null;
  title: string;
  avatarUrl?: string;
  avatarFallback?: string;
  securityMaterial?: string | null;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onDismissError: () => void;
}

function formatCallDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (safeSeconds % 60).toString().padStart(2, "0");

  return `${mins}:${secs}`;
}

export function ChatCallWindow({
  state,
  error,
  title,
  avatarUrl,
  avatarFallback = "#",
  securityMaterial,
  onAccept,
  onReject,
  onEnd,
  onDismissError,
}: ChatCallWindowProps) {
  const t = useTranslations("chat.callWindow");
  const activeSinceMsRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const isVisible = state !== "idle";

  useEffect(() => {
    if (state !== "active") {
      activeSinceMsRef.current = null;
      return;
    }

    activeSinceMsRef.current = Date.now();
    const resetTimerId = window.setTimeout(() => {
      setElapsedSeconds(0);
    }, 0);

    const intervalId = window.setInterval(() => {
      if (!activeSinceMsRef.current) return;
      setElapsedSeconds(
        Math.floor((Date.now() - activeSinceMsRef.current) / 1000),
      );
    }, 1000);

    return () => {
      window.clearTimeout(resetTimerId);
      window.clearInterval(intervalId);
    };
  }, [state]);

  const statusLabel = useMemo(() => {
    if (state === "incoming") return t("status.incoming");
    if (state === "outgoing") return t("status.outgoing");
    if (state === "connecting") return t("status.connecting");
    if (state === "active") return formatCallDuration(elapsedSeconds);
    if (state === "error") return t("status.error");
    return "";
  }, [elapsedSeconds, state, t]);

  const securityEmojis = useMemo(() => {
    if (!securityMaterial) {
      return [];
    }

    return getCallSecurityEmojiFingerprint({
      securityMaterial,
    });
  }, [securityMaterial]);
  const showSignalBars =
    state === "outgoing" || state === "connecting" || state === "active";
  const openEase = [0.22, 1, 0.36, 1] as const;
  const callActionTransition = {
    type: "spring",
    stiffness: 280,
    damping: 28,
    mass: 0.8,
  } as const;
  const contentVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.1,
        staggerChildren: 0.07,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        staggerChildren: 0.04,
        staggerDirection: -1,
      },
    },
  } as const;
  const revealItemVariants = {
    hidden: { opacity: 0, y: 16, filter: "blur(7px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.48,
        ease: openEase,
      },
    },
    exit: {
      opacity: 0,
      y: 8,
      filter: "blur(4px)",
      transition: {
        duration: 0.2,
        ease: openEase,
      },
    },
  } as const;

  return (
    <AnimatePresence initial={false}>
      {isVisible ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: openEase }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8"
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-black/72 backdrop-blur-[10px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: openEase }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.46, ease: openEase }}
            className="relative aspect-square overflow-hidden rounded-[2.1rem] bg-black/30 text-white"
            style={{ width: "min(92vw, 84vh, 50rem)" }}
          >
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.56, ease: openEase }}
            >
              <Avatar className="absolute inset-0 size-full rounded-none">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt="" className="size-full rounded-none object-cover" />
                ) : null}
                <AvatarFallback className="rounded-none bg-neutral-900 text-[7rem] font-black text-white/90">
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>
            </motion.div>
            <motion.div
              className="absolute inset-0 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: openEase }}
            />

            <motion.div
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative flex h-full flex-col p-6 sm:p-8"
            >
              <motion.div variants={revealItemVariants} className="flex items-start justify-between">
                <div className="inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100">
                  <FiLock className="size-3.5" />
                  {t("secured")}
                </div>
                {state === "error" ? (
                  <motion.button
                    type="button"
                    layoutId="call-action-primary"
                    className="inline-flex size-14 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/55"
                    onClick={onDismissError}
                    >
                      <RiCloseLine className="size-9" />
                    </motion.button>
                  ) : null}
              </motion.div>

              {securityEmojis.length > 0 ? (
                <motion.div
                  variants={revealItemVariants}
                  className="mt-5 flex justify-center gap-2 text-3xl leading-none"
                >
                  {securityEmojis.map((emoji, index) => (
                    <span key={`${emoji}-${index}`}>{emoji}</span>
                  ))}
                </motion.div>
              ) : null}

              <motion.div
                variants={revealItemVariants}
                className="mt-6 flex flex-1 flex-col items-center justify-center text-center"
              >
                <p className="max-w-[34rem] truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                  {title}
                </p>
                <p
                  className={cn(
                    "mt-1.5 text-base font-medium",
                    state === "active" ? "text-emerald-300" : "text-white/75",
                  )}
                >
                  {statusLabel}
                </p>

                <div className="mt-3 flex h-5 items-end gap-1.5">
                  {[0, 1, 2].map((index) => (
                    <motion.span
                      key={index}
                      className="inline-block h-full w-1.5 origin-bottom rounded-full bg-emerald-300/90"
                      animate={
                        showSignalBars
                          ? { scaleY: [0.45, 1, 0.6, 0.9, 0.45], opacity: 1 }
                          : { scaleY: 0.25, opacity: 0.2 }
                      }
                      transition={{
                        duration: 1.1,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: index * 0.12,
                      }}
                    />
                  ))}
                </div>
              </motion.div>

              <motion.p variants={revealItemVariants} className="text-center text-sm text-white/75">
                {t("securityHint")}
              </motion.p>

              <motion.div variants={revealItemVariants}>
                <LayoutGroup id="call-actions">
                  <motion.div
                    layout
                    transition={{ layout: callActionTransition }}
                    className="mt-7 flex items-center justify-center gap-4"
                  >
                    <AnimatePresence mode="sync" initial={false}>
                      {state === "incoming" ? (
                        <motion.button
                          key="accept-call"
                          type="button"
                          layout
                          layoutId="call-action-primary"
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{ layout: callActionTransition, duration: 0.2 }}
                          className="inline-flex size-16 items-center justify-center rounded-full bg-emerald-500 text-white"
                          onClick={onAccept}
                        >
                          <RiPhoneFill className="size-9" />
                        </motion.button>
                      ) : null}

                      {(state === "incoming" || showSignalBars) ? (
                        <motion.button
                          key={state === "incoming" ? "decline-call" : "end-call"}
                          type="button"
                          layout
                          layoutId="call-action-danger"
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{ layout: callActionTransition, duration: 0.2 }}
                          className="inline-flex size-16 items-center justify-center rounded-full bg-red-500 text-white"
                          onClick={state === "incoming" ? onReject : onEnd}
                        >
                          <motion.span
                            layoutId="call-action-danger-icon"
                            transition={{ layout: callActionTransition }}
                            className="inline-flex"
                          >
                            <RiPhoneLine className="size-9 rotate-[135deg]" />
                          </motion.span>
                        </motion.button>
                      ) : null}

                      {state === "error" ? (
                        <motion.button
                          key="close-call-error"
                          type="button"
                          layout
                          layoutId="call-action-primary"
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{ layout: callActionTransition, duration: 0.2 }}
                          className="inline-flex size-16 items-center justify-center rounded-full bg-white/25 text-white"
                          onClick={onDismissError}
                        >
                          <RiCloseLine className="size-9" />
                        </motion.button>
                      ) : null}
                    </AnimatePresence>
                  </motion.div>
                </LayoutGroup>
              </motion.div>

              {error ? (
                <motion.p variants={revealItemVariants} className="mt-3 text-xs text-red-200/95">
                  {error}
                </motion.p>
              ) : null}
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
