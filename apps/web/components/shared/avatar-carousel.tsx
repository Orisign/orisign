"use client";

import { Button } from "@repo/ui";
import { AnimatePresence, motion } from "motion/react";
import type { PanInfo } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

type AvatarCarouselProps = {
  avatarKeys: string[];
  isExpanded: boolean;
  className?: string;
};

const SWIPE_THRESHOLD = 42;
const SLIDE_DURATION = 0.28;
const CAROUSEL_NAV_BUTTON_CLASSNAME =
  "absolute inset-y-0 z-20 h-full w-14 rounded-none bg-transparent text-white/80 opacity-0 transition-opacity duration-200 hover:bg-transparent hover:text-white group-hover:opacity-100";

const slideVariants = {
  enter: (direction: 1 | -1) => ({
    x: direction === 1 ? "100%" : "-100%",
  }),
  center: {
    x: 0,
  },
  exit: (direction: 1 | -1) => ({
    x: direction === 1 ? "-100%" : "100%",
  }),
};

export function AvatarCarousel({
  avatarKeys,
  isExpanded,
  className,
}: AvatarCarouselProps) {
  const t = useTranslations("shared.avatarCarousel");
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  useEffect(() => {
    if (avatarKeys.length === 0) {
      setIndex(0);
      return;
    }

    setIndex((prev) => Math.min(prev, avatarKeys.length - 1));
  }, [avatarKeys.length]);

  const currentKey = avatarKeys[index];
  const storageBaseUrl = process.env.NEXT_PUBLIC_STORAGE_URL ?? "";
  const avatarUrls = useMemo(
    () =>
      avatarKeys.map((key) => {
        if (!key) return "";
        if (key.startsWith("http://") || key.startsWith("https://")) return key;
        const base = storageBaseUrl.endsWith("/") ? storageBaseUrl : `${storageBaseUrl}/`;
        const normalizedKey = key.startsWith("/") ? key.slice(1) : key;
        return `${base}${normalizedKey}`;
      }),
    [avatarKeys, storageBaseUrl],
  );
  const currentUrl = avatarUrls[index] ?? "";
  const canSlide = isExpanded && avatarKeys.length > 1;

  const goPrev = () => {
    if (avatarKeys.length < 2) return;
    setDirection(-1);
    setIndex((prev) => (prev - 1 + avatarKeys.length) % avatarKeys.length);
  };

  const goNext = () => {
    if (avatarKeys.length < 2) return;
    setDirection(1);
    setIndex((prev) => (prev + 1) % avatarKeys.length);
  };

  return (
    <div className={className}>
      <div className="group relative size-full overflow-hidden select-none">
        <motion.div
          className="absolute inset-0"
          drag={canSlide ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_, info: PanInfo) => {
            if (!canSlide) return;
            if (info.offset.x > SWIPE_THRESHOLD) goPrev();
            if (info.offset.x < -SWIPE_THRESHOLD) goNext();
          }}
        >
          <AnimatePresence initial={false} custom={direction} mode="sync">
            {currentUrl ? (
              <motion.img
                key={`${currentKey}-${index}`}
                src={currentUrl}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  type: "tween",
                  duration: SLIDE_DURATION,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
                className="pointer-events-none absolute inset-0 size-full select-none object-cover"
              />
            ) : null}
          </AnimatePresence>
        </motion.div>

        {avatarKeys.length > 1 ? (
          <div className="pointer-events-none absolute left-3 right-3 top-2 z-20 flex gap-1.5">
            {avatarKeys.map((key, idx) => (
              <div
                key={key || idx}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  idx === index ? "bg-white/95" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        ) : null}

        {canSlide ? (
          <>
            <Button
              type="button"
              variant="ghost"
              className={`${CAROUSEL_NAV_BUTTON_CLASSNAME} left-0`}
              onClick={goPrev}
              aria-label={t("previousAriaLabel")}
            >
              <ChevronLeft className="size-8" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={`${CAROUSEL_NAV_BUTTON_CLASSNAME} right-0`}
              onClick={goNext}
              aria-label={t("nextAriaLabel")}
            >
              <ChevronRight className="size-8" />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
