"use client";

import * as Popover from "@radix-ui/react-popover";
import { Search, X } from "lucide-react";
import emojiData from "react-apple-emojis/src/data.json";
import * as React from "react";
import { FiDelete, FiSmile } from "react-icons/fi";

import { useUITranslations } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import {
  APPLE_EMOJI_CDN_BASE,
  CATEGORY_KEYWORDS,
  CATEGORY_SEARCH_TERMS,
  EMOJI_CATEGORIES,
  EMOJI_CELL_SIZE,
  EMOJI_COLUMNS,
  EMOJI_COMPONENT_SLUGS,
  EMOJI_GRID_GAP,
  EMOJI_SEARCH_LOCALES,
  FLAG_REGION_ALIASES,
  FREQUENT_EMOJIS,
  INITIAL_EMOJI_BATCH,
  type EmojiCategoryId,
  type MappedEmojiCategoryId,
  ORDERED_MAPPED_EMOJI_CATEGORIES,
  TOKEN_SEARCH_ALIASES,
  EMOJI_BATCH_STEP,
} from "./emoji-picker.constants";
import { ScrollArea } from "./scroll-area";

type AppleEmojiData = {
  baseUrl: string;
  emojis: Record<string, string>;
};

type EmojiItem = {
  emoji: string;
  slug: string;
  name: string;
  search: string[];
  category: MappedEmojiCategoryId;
  src: string;
  fallbackSrc: string;
};

type EmojiSection = {
  id: EmojiCategoryId;
  label: string;
  icon: string;
  items: EmojiItem[];
};

function fileNameToEmoji(fileName: string) {
  const sequence = extractEmojiSequence(fileName);
  if (!sequence) return null;

  const codePoints = sequence
    .split("-")
    .map((part) => Number.parseInt(part, 16))
    .filter((codePoint) => Number.isFinite(codePoint));

  if (codePoints.length === 0) return null;

  return String.fromCodePoint(...codePoints);
}

function fileNameToAppleCdnSrc(fileName: string) {
  const sequence = extractEmojiSequence(fileName);
  if (!sequence) return null;

  const normalized = sequence
    .toLowerCase()
    .replaceAll("-fe0f", "")
    .replaceAll("-", "_");

  return `${APPLE_EMOJI_CDN_BASE}/emoji_u${normalized}.png`;
}

function extractEmojiSequence(fileName: string) {
  const baseName = fileName.replace(/\.png$/i, "");
  const sequences = baseName
    .split("_")
    .filter((part) => /^[0-9a-f-]+$/i.test(part));

  if (sequences.length === 0) {
    return null;
  }

  return sequences.sort((left, right) => right.length - left.length)[0] ?? null;
}

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replaceAll("-", " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSearchValue(value: string) {
  return normalizeSearchValue(value).split(" ").filter(Boolean);
}

function matchesKeyword(tokens: string[], keyword: string) {
  const keywordTokens = tokenizeSearchValue(keyword);

  if (keywordTokens.length === 0) {
    return false;
  }

  if (keywordTokens.length === 1) {
    return tokens.includes(keywordTokens[0]);
  }

  for (let index = 0; index <= tokens.length - keywordTokens.length; index += 1) {
    const isMatch = keywordTokens.every(
      (token, keywordIndex) => tokens[index + keywordIndex] === token,
    );

    if (isMatch) {
      return true;
    }
  }

  return false;
}

const REGION_DISPLAY_NAMES =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Map(
        EMOJI_SEARCH_LOCALES.map((locale) => [
          locale,
          new Intl.DisplayNames([locale], { type: "region" }),
        ]),
      )
    : new Map<string, Intl.DisplayNames>();

function addSearchTerm(set: Set<string>, value: string) {
  for (const token of tokenizeSearchValue(value)) {
    set.add(token);
  }
}

function getFlagRegionCode(emoji: string) {
  const codePoints = Array.from(emoji, (value) => value.codePointAt(0) ?? 0);

  if (codePoints.length !== 2) {
    return null;
  }

  const isRegionalIndicator = codePoints.every(
    (codePoint) => codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff,
  );

  if (!isRegionalIndicator) {
    return null;
  }

  return String.fromCharCode(
    ...codePoints.map((codePoint) => codePoint - 0x1f1e6 + 65),
  );
}

function getLocalizedFlagSearchTerms(emoji: string) {
  const regionCode = getFlagRegionCode(emoji);
  if (!regionCode) {
    return [];
  }

  const terms = new Set<string>([regionCode.toLowerCase()]);

  for (const locale of EMOJI_SEARCH_LOCALES) {
    const localizedName = REGION_DISPLAY_NAMES.get(locale)?.of(regionCode);
    if (localizedName) {
      addSearchTerm(terms, localizedName);
    }
  }

  for (const alias of FLAG_REGION_ALIASES[regionCode] ?? []) {
    addSearchTerm(terms, alias);
  }

  return Array.from(terms);
}

function buildMultilingualSearchTerms(
  slug: string,
  category: MappedEmojiCategoryId,
  name: string,
  emoji: string,
) {
  const tokens = tokenizeSearchValue(`${slug} ${name}`);
  const terms = new Set<string>(tokens);

  for (const locale of EMOJI_SEARCH_LOCALES) {
    for (const categoryTerm of CATEGORY_SEARCH_TERMS[locale][category]) {
      addSearchTerm(terms, categoryTerm);
    }

    const aliases = TOKEN_SEARCH_ALIASES[locale];

    for (const token of tokens) {
      for (const alias of aliases[token] ?? []) {
        addSearchTerm(terms, alias);
      }
    }
  }

  if (category === "flags") {
    for (const term of getLocalizedFlagSearchTerms(emoji)) {
      terms.add(term);
    }
  }

  return Array.from(terms);
}

function getEmojiGridHeight(itemCount: number) {
  const rows = Math.max(1, Math.ceil(itemCount / EMOJI_COLUMNS));
  return rows * EMOJI_CELL_SIZE + Math.max(rows - 1, 0) * EMOJI_GRID_GAP;
}

function getMappedCategory(slug: string, search: string): MappedEmojiCategoryId {
  if (slug.startsWith("flag-") || slug.includes("flag")) {
    return "flags";
  }

  const tokens = tokenizeSearchValue(`${slug} ${search}`);

  for (const category of ORDERED_MAPPED_EMOJI_CATEGORIES) {
    if (
      CATEGORY_KEYWORDS[category].some(
        (keyword) => matchesKeyword(tokens, keyword),
      )
    ) {
      return category;
    }
  }

  return "symbols";
}

const ALL_EMOJIS: EmojiItem[] = (() => {
  const { baseUrl, emojis: source } = emojiData as AppleEmojiData;
  const items: EmojiItem[] = [];

  for (const [slug, fileName] of Object.entries(source)) {
    if (EMOJI_COMPONENT_SLUGS.has(slug) || slug.includes("skin-tone")) continue;

    const emoji = fileNameToEmoji(fileName);
    if (!emoji) continue;
    const name = slug.replaceAll("-", " ");
    const normalizedName = normalizeSearchValue(name);
    const normalizedSlug = normalizeSearchValue(slug);
    const category = getMappedCategory(slug, `${normalizedName} ${normalizedSlug}`);
    const search = buildMultilingualSearchTerms(slug, category, name, emoji);

    items.push({
      emoji,
      slug,
      name,
      search,
      category,
      src: fileNameToAppleCdnSrc(fileName) ?? `${baseUrl}${fileName}`,
      fallbackSrc: `${baseUrl}${fileName}`,
    });
  }

  return items;
})();

const EMOJI_BY_VALUE = new Map(
  ALL_EMOJIS.map((item) => [item.emoji, item] as const),
);

const FREQUENT_ITEMS: EmojiItem[] = FREQUENT_EMOJIS.flatMap((emoji) => {
  const item = EMOJI_BY_VALUE.get(emoji);
  return item ? [item] : [];
});

function matchesEmojiQuery(item: EmojiItem, rawQuery: string, queryTokens: string[]) {
  if (!rawQuery.trim()) {
    return true;
  }

  if (item.emoji.includes(rawQuery.trim())) {
    return true;
  }

  if (queryTokens.length === 0) {
    return false;
  }

  return queryTokens.every((token) =>
    item.search.some((term) => term.includes(token)),
  );
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onDeleteLast?: () => void;
  trigger?: React.ReactNode;
  className?: string;
}

const RECENT_EMOJI_STORAGE_KEY = "ui.recent-emojis";
const RECENT_EMOJI_LIMIT = 32;

function readRecentEmojiItems() {
  if (typeof window === "undefined") {
    return [] as EmojiItem[];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_EMOJI_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((emoji) => (typeof emoji === "string" ? EMOJI_BY_VALUE.get(emoji) : null))
      .filter(Boolean) as EmojiItem[];
  } catch {
    return [];
  }
}

function writeRecentEmojiItems(items: EmojiItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      RECENT_EMOJI_STORAGE_KEY,
      JSON.stringify(items.slice(0, RECENT_EMOJI_LIMIT).map((item) => item.emoji)),
    );
  } catch {
    // Ignore storage write failures.
  }
}

function EmojiAsset({
  item,
  className,
  loading = "lazy",
}: {
  item: EmojiItem;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  return (
    <img
      src={item.src}
      data-fallback-src={item.fallbackSrc}
      alt={item.name}
      title={item.name}
      loading={loading}
      decoding="async"
      draggable={false}
      className={cn("size-7 shrink-0 select-none object-contain", className)}
      onError={(event) => {
        const target = event.currentTarget;
        const fallbackSrc = target.dataset.fallbackSrc;

        if (!fallbackSrc || target.dataset.fallbackApplied === "true") {
          return;
        }

        target.dataset.fallbackApplied = "true";
        target.src = fallbackSrc;
      }}
    />
  );
}

function EmojiGrid({
  items,
  onSelect,
}: {
  items: EmojiItem[];
  onSelect: (emoji: string) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {items.map((item) => (
        <button
          key={`${item.slug}-${item.emoji}`}
          type="button"
          title={item.name}
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-white/10 focus-visible:bg-white/10"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(item.emoji)}
        >
          <EmojiAsset item={item} />
        </button>
      ))}
    </div>
  );
}

function EmojiGridSkeleton({ count }: { count: number }) {
  const height = getEmojiGridHeight(count);

  return (
    <div
      className="grid grid-cols-8 gap-1.5"
      style={{ minHeight: `${height}px` }}
      aria-hidden="true"
    >
      {Array.from({ length: Math.min(count, EMOJI_COLUMNS * 4) }).map((_, index) => (
        <div key={index} className="size-10 rounded-xl bg-white/[0.045]" />
      ))}
    </div>
  );
}

function EmojiSectionBlock({
  section,
  onSelect,
  forceRender,
  searchActive,
  registerSection,
}: {
  section: EmojiSection;
  onSelect: (emoji: string) => void;
  forceRender: boolean;
  searchActive: boolean;
  registerSection: (id: EmojiCategoryId, element: HTMLElement | null) => void;
}) {
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = React.useState(forceRender);
  const [visibleCount, setVisibleCount] = React.useState(() =>
    forceRender ? Math.min(INITIAL_EMOJI_BATCH, section.items.length) : 0,
  );

  const hasMore = visibleCount < section.items.length;
  const visibleItems = section.items.slice(0, visibleCount);

  React.useEffect(() => {
    if (forceRender) {
      setIsVisible(true);
      return;
    }

    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      {
        rootMargin: "240px 0px",
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [forceRender]);

  React.useEffect(() => {
    if (!isVisible) {
      setVisibleCount(0);
      return;
    }

    React.startTransition(() => {
      setVisibleCount((currentCount) => {
        const nextInitialCount = Math.min(INITIAL_EMOJI_BATCH, section.items.length);

        if (searchActive) {
          return nextInitialCount;
        }

        if (currentCount === 0) {
          return nextInitialCount;
        }

        return Math.min(currentCount, section.items.length);
      });
    });
  }, [isVisible, searchActive, section.id, section.items.length]);

  React.useEffect(() => {
    if (!isVisible || !hasMore) return;

    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        React.startTransition(() => {
          setVisibleCount((currentCount) =>
            Math.min(currentCount + EMOJI_BATCH_STEP, section.items.length),
          );
        });
      },
      {
        rootMargin: "220px 0px",
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isVisible, section.items.length, visibleCount]);

  React.useEffect(() => {
    registerSection(section.id, sectionRef.current);
    return () => registerSection(section.id, null);
  }, [registerSection, section.id]);

  return (
    <section
      ref={sectionRef}
      className="space-y-2"
      data-emoji-section={section.id}
    >
      <p className="px-1 text-center text-sm font-bold text-muted-foreground">
        {section.label}
      </p>
      {isVisible ? (
        <div className="space-y-2">
          <EmojiGrid items={visibleItems} onSelect={onSelect} />
          {hasMore ? (
            <div ref={loadMoreRef}>
              <EmojiGridSkeleton
                count={Math.min(EMOJI_BATCH_STEP, section.items.length - visibleCount)}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <EmojiGridSkeleton count={section.items.length} />
      )}
    </section>
  );
}

export function EmojiPicker({
  onSelect,
  onDeleteLast,
  trigger,
  className,
}: EmojiPickerProps) {
  const t = useUITranslations("emojiPicker");
  const [open, setOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [recentItems, setRecentItems] = React.useState<EmojiItem[]>([]);
  const deferredQuery = React.useDeferredValue(query);
  const hasSearchQuery = deferredQuery.trim().length > 0;
  const queryTokens = React.useMemo(
    () => tokenizeSearchValue(deferredQuery),
    [deferredQuery],
  );
  const sectionRefs = React.useRef(
    new Map<EmojiCategoryId, HTMLElement | null>(),
  );
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const pendingScrollRef = React.useRef<EmojiCategoryId | null>(null);
  const preventCloseRef = React.useRef(false);
  const [activeCategoryId, setActiveCategoryId] = React.useState<EmojiCategoryId>("frequent");

  React.useEffect(() => {
    setRecentItems(readRecentEmojiItems());
  }, []);

  const handleContentMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const interactiveTarget = target.closest(
        "button, input, label, [role='textbox'], [data-radix-scroll-area-thumb]",
      );

      if (interactiveTarget) {
        return;
      }

      event.preventDefault();
    },
    [],
  );

  const filteredByCategory = React.useMemo(() => {
    const initial: Record<MappedEmojiCategoryId, EmojiItem[]> = {
      smileys: [],
      animals: [],
      food: [],
      activity: [],
      travel: [],
      objects: [],
      symbols: [],
      flags: [],
    };

    const source = deferredQuery.trim()
      ? ALL_EMOJIS.filter((item) =>
          matchesEmojiQuery(item, deferredQuery, queryTokens),
        )
      : ALL_EMOJIS;

    for (const item of source) {
      initial[item.category].push(item);
    }

    return initial;
  }, [deferredQuery, queryTokens]);

  const sections = React.useMemo(() => {
    const mappedSections = EMOJI_CATEGORIES.map((category) => {
      if (category.id === "frequent") {
        const sourceItems = recentItems.length > 0 ? recentItems : FREQUENT_ITEMS;
        const items = hasSearchQuery
          ? sourceItems.filter((item) =>
              matchesEmojiQuery(item, deferredQuery, queryTokens),
            )
          : sourceItems;

        return {
          id: category.id,
          label: t(category.labelKey),
          icon: category.icon,
          items,
        };
      }

      return {
        id: category.id,
        label: t(category.labelKey),
        icon: category.icon,
        items: filteredByCategory[category.id],
      };
    });

    return mappedSections.filter((section) => section.items.length > 0);
  }, [deferredQuery, filteredByCategory, hasSearchQuery, queryTokens, recentItems, t]);

  const categoryIcons = React.useMemo(
    () =>
      EMOJI_CATEGORIES.flatMap((category) => {
        const item = EMOJI_BY_VALUE.get(category.icon);
        return item
          ? [
              {
                id: category.id,
                label: t(category.labelKey),
                item,
              },
            ]
          : [];
      }),
    [t],
  );

  const registerSection = React.useCallback(
    (id: EmojiCategoryId, element: HTMLElement | null) => {
      sectionRefs.current.set(id, element);
    },
    [],
  );

  const scrollToSection = React.useCallback((id: EmojiCategoryId) => {
    const element = sectionRefs.current.get(id);
    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
  }, []);

  const handleJumpToSection = React.useCallback(
    (id: EmojiCategoryId) => {
      if (hasSearchQuery) {
        pendingScrollRef.current = id;
        setQuery("");
        return;
      }

      scrollToSection(id);
    },
    [hasSearchQuery, scrollToSection],
  );

  React.useEffect(() => {
    const pendingSection = pendingScrollRef.current;
    if (!pendingSection || hasSearchQuery) return;

    const frameId = window.requestAnimationFrame(() => {
      scrollToSection(pendingSection);
      pendingScrollRef.current = null;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [hasSearchQuery, scrollToSection, sections]);

  const handleSelect = React.useCallback(
    (emoji: string) => {
      preventCloseRef.current = true;
      const selectedItem = EMOJI_BY_VALUE.get(emoji);
      if (selectedItem) {
        setRecentItems((currentItems) => {
          const nextItems = [
            selectedItem,
            ...currentItems.filter((item) => item.emoji !== selectedItem.emoji),
          ].slice(0, RECENT_EMOJI_LIMIT);
          writeRecentEmojiItems(nextItems);
          return nextItems;
        });
      }
      onSelect(emoji);

      window.requestAnimationFrame(() => {
        preventCloseRef.current = false;
      });
    },
    [onSelect],
  );

  React.useEffect(() => {
    if (!open || !isSearchOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isSearchOpen, open]);

  const syncActiveCategory = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || hasSearchQuery) {
      return;
    }

    let nextActiveCategory = sections[0]?.id ?? "frequent";
    let minDistance = Number.POSITIVE_INFINITY;

    for (const section of sections) {
      const node = sectionRefs.current.get(section.id);
      if (!node) continue;

      const distance = Math.abs(node.offsetTop - viewport.scrollTop - 12);
      if (distance < minDistance) {
        minDistance = distance;
        nextActiveCategory = section.id;
      }
    }

    setActiveCategoryId(nextActiveCategory);
  }, [hasSearchQuery, sections]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      syncActiveCategory();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open, sections, syncActiveCategory]);

  const handleSearchToggle = React.useCallback(() => {
    setIsSearchOpen((currentValue) => {
      if (currentValue) {
        setQuery("");
      }

      return !currentValue;
    });
  }, []);

  return (
    <Popover.Root
      modal={false}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && preventCloseRef.current) {
          return;
        }

        if (!nextOpen) {
          setIsSearchOpen(false);
          setQuery("");
        }

        setOpen(nextOpen);
      }}
    >
      <Popover.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-primary",
              className,
            )}
            onMouseDown={(event) => event.preventDefault()}
            aria-label={t("openAriaLabel")}
          >
            <FiSmile className="size-5" />
          </button>
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={10}
          className={cn(
            "z-50 flex h-[26.25rem] w-[23.875rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[1.25rem] border border-border/70 bg-popover text-popover-foreground shadow-[0_5px_18px_rgba(16,35,47,0.16)]",
            "origin-bottom-left [will-change:transform,opacity] data-[state=open]:animate-[ui-emoji-picker-in_180ms_cubic-bezier(.42,0,.58,1)] data-[state=closed]:animate-[ui-emoji-picker-out_140ms_cubic-bezier(.4,0,.2,1)]",
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onFocusOutside={(event) => {
            if (preventCloseRef.current) {
              event.preventDefault();
            }
          }}
          data-no-twemoji
        >
          <div className="flex min-h-0 flex-1 flex-col" onMouseDown={handleContentMouseDown}>
            <div
              className={cn(
                "overflow-hidden border-b border-border/70 transition-[max-height,opacity,margin] duration-200 ease-[cubic-bezier(.42,0,.58,1)]",
                isSearchOpen || hasSearchQuery
                  ? "max-h-16 opacity-100"
                  : "max-h-0 opacity-0",
              )}
            >
              <div className="p-2">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("searchPlaceholder")}
                    className="h-10 w-full rounded-xl bg-muted/55 pl-9 pr-9 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  {query.length > 0 ? (
                    <button
                      type="button"
                      className="absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setQuery("")}
                      aria-label={t("clearSearchAriaLabel")}
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </label>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <ScrollArea
                className="h-full"
                viewportRef={viewportRef}
                viewportClassName="pr-2"
                onViewportScroll={() => {
                  syncActiveCategory();
                }}
              >
                <div className="space-y-5 px-2 py-3">
                {sections.map((section) => (
                  <EmojiSectionBlock
                    key={section.id}
                    section={section}
                    onSelect={handleSelect}
                    forceRender={hasSearchQuery || section.id === "frequent"}
                    searchActive={hasSearchQuery}
                    registerSection={registerSection}
                  />
                ))}
                {sections.length === 0 ? (
                  <div className="py-10 text-center text-sm font-medium text-muted-foreground">
                    {t("empty")}
                  </div>
                ) : null}
                </div>
              </ScrollArea>
            </div>

            <div className="relative flex h-[3.0625rem] min-h-[3.0625rem] items-center border-t border-border/70 px-2">
              <button
                type="button"
                className={cn(
                  "absolute left-2 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
                  (isSearchOpen || hasSearchQuery) && "bg-foreground/8 text-foreground",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleSearchToggle}
                aria-label={t("searchPlaceholder")}
              >
                <Search className="size-4.5" />
              </button>

              <div className="mx-auto flex max-w-[16rem] items-center overflow-x-auto px-9 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex items-center gap-2">
                  {categoryIcons.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      title={category.label}
                      className={cn(
                        "inline-flex size-[1.875rem] shrink-0 items-center justify-center rounded-full transition-colors",
                        !hasSearchQuery && activeCategoryId === category.id
                          ? "bg-foreground/8"
                          : "hover:bg-foreground/6",
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleJumpToSection(category.id)}
                    >
                      <EmojiAsset
                        item={category.item}
                        className="size-5"
                        loading="eager"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {onDeleteLast ? (
                <button
                  type="button"
                  className="absolute right-2 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onDeleteLast}
                  aria-label={t("deleteLastAriaLabel")}
                >
                  <FiDelete className="size-4" />
                </button>
              ) : null}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
