"use client";

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { SPRING_MICRO } from "@/lib/animations";

type AvatarCarouselProps = {
  avatarKeys: string[];
  isExpanded: boolean;
  className?: string;
};

const CAROUSEL_NAV_BUTTON_CLASSNAME =
  "absolute inset-y-0 z-20 h-full w-14 cursor-pointer border-0 rounded-none bg-transparent text-white/80 opacity-0 transition-opacity duration-200 hover:bg-transparent hover:text-white group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none";

export function AvatarCarousel({
  avatarKeys,
  isExpanded,
  className,
}: AvatarCarouselProps) {
  const t = useTranslations("shared.avatarCarousel");
  const [index, setIndex] = useState(0);

  const safeIndex = avatarKeys.length === 0 ? 0 : Math.min(index, avatarKeys.length - 1);

  const currentKey = avatarKeys[safeIndex];
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
  const currentUrl = avatarUrls[safeIndex] ?? "";
  const canSlide = isExpanded && avatarKeys.length > 1;

  const goPrev = () => {
    if (avatarKeys.length < 2) return;
    setIndex((safeIndex - 1 + avatarKeys.length) % avatarKeys.length);
  };

  const goNext = () => {
    if (avatarKeys.length < 2) return;
    setIndex((safeIndex + 1) % avatarKeys.length);
  };

  return (
    <div className={className}>
      <div className="group relative size-full overflow-hidden select-none">
        {currentUrl ? (
          <img
            key={`${currentKey}-${safeIndex}`}
            src={currentUrl}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            className="pointer-events-none absolute inset-0 size-full select-none object-cover"
            alt=""
          />
        ) : null}

        {avatarKeys.length > 1 ? (
          <div className="pointer-events-none absolute left-3 right-3 top-2 z-20 flex items-center gap-1.5">
            {avatarKeys.map((key, idx) => (
              <motion.div
                key={key || idx}
                layout
                className="h-1 min-w-0 flex-1 rounded-full bg-white/95"
                initial={false}
                animate={{
                  flexGrow: idx === safeIndex ? 2.8 : 1,
                  opacity: idx === safeIndex ? 1 : 0.45,
                }}
                transition={SPRING_MICRO}
              />
            ))}
          </div>
        ) : null}

        {canSlide ? (
          <>
            <button
              type="button"
              className={`${CAROUSEL_NAV_BUTTON_CLASSNAME} left-0`}
              onClick={goPrev}
              aria-label={t("previousAriaLabel")}
            >
              <ChevronLeft className="size-8" />
            </button>
            <button
              type="button"
              className={`${CAROUSEL_NAV_BUTTON_CLASSNAME} right-0`}
              onClick={goNext}
              aria-label={t("nextAriaLabel")}
            >
              <ChevronRight className="size-8" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
