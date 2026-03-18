"use client";

import { useAccountControllerMe } from "@/api/generated";
import { AvatarCarousel } from "@/components/shared/avatar-carousel";
import { AvatarUploadButton } from "@/components/shared/avatar-upload-button";
import { CopyableProfileValue } from "@/components/shared/copyable-profile-value";
import { SectionButton } from "@/components/shared/section-button";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
  SidebarPageSeparator,
  SidebarPageTitle,
} from "@/components/ui/sidebar-page";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSidebar } from "@/hooks/use-sidebar";
import { formatBirthDateWithAge } from "@/lib/birth-date";
import { Button } from "@repo/ui";
import { ArrowLeft, EllipsisVertical, Pencil } from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  SETTINGS_COLLAPSED_AVATAR_SIZE,
  SETTINGS_HEADER_TRANSFORM_RANGE,
  SETTINGS_PROFILE_ROWS,
  SETTINGS_SECTION_ITEMS,
} from "./settings-sidebar.constants";
import { ProfileDropdown } from "@/components/user/profile-dropdown";

export const SettingsSidebar = () => {
  const t = useTranslations("settingsSidebar");
  const locale = useLocale();
  const { user } = useCurrentUser();
  const { data: accountData } = useAccountControllerMe();
  const { user: auth } = useAuth();
  const { pop, push } = useSidebar();

  const avatars = user?.avatars ?? [];
  const hasAvatar = avatars.length > 0;
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLParagraphElement | null>(null);
  const scrollY = useMotionValue(0);
  const [heroWidth, setHeroWidth] = useState(0);
  const [nameWidth, setNameWidth] = useState(0);
  const [isAvatarExpanded, setIsAvatarExpanded] = useState(true);
  const isAvatarExpandedRef = useRef(true);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const viewport = root.closest(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null;
    if (!viewport) return;

    const onScroll = () => {
      const nextScrollTop = viewport.scrollTop;
      scrollY.set(nextScrollTop);

      const nextIsExpanded = nextScrollTop < 36;
      if (nextIsExpanded !== isAvatarExpandedRef.current) {
        isAvatarExpandedRef.current = nextIsExpanded;
        setIsAvatarExpanded(nextIsExpanded);
      }
    };
    onScroll();

    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [scrollY]);

  useEffect(() => {
    const heroEl = heroRef.current;
    const nameEl = nameRef.current;
    if (!heroEl || !nameEl) return;

    const measure = () => {
      setHeroWidth(heroEl.clientWidth);
      setNameWidth(nameEl.clientWidth);
    };

    measure();

    const heroObserver = new ResizeObserver(measure);
    const nameObserver = new ResizeObserver(measure);
    heroObserver.observe(heroEl);
    nameObserver.observe(nameEl);

    return () => {
      heroObserver.disconnect();
      nameObserver.disconnect();
    };
  }, [user?.firstName]);

  const progressRaw = useTransform(
    scrollY,
    SETTINGS_HEADER_TRANSFORM_RANGE,
    [0, 1],
  );
  const progress = useSpring(progressRaw, {
    stiffness: 180,
    damping: 28,
    mass: 0.6,
    restDelta: 0.001,
    restSpeed: 0.001,
  });

  const initialSize = heroWidth || 280;
  const collapsedSize = SETTINGS_COLLAPSED_AVATAR_SIZE;
  const avatarSize = useTransform(
    progress,
    [0, 1],
    [initialSize, collapsedSize],
  );
  const avatarRadius = useTransform(progress, [0, 1], ["0%", "50%"]);
  const avatarX = useTransform(
    progress,
    [0, 1],
    [0, Math.max((initialSize - collapsedSize) / 2, 0)],
  );
  const heroHeight = useTransform(
    progress,
    [0, 1],
    [initialSize, collapsedSize + 44],
  );

  const startNameX = 12;
  const endNameX = Math.max((initialSize - nameWidth) / 2, 0);
  const startNameY = Math.max(initialSize - 34, 0);
  const endNameY = collapsedSize + 12;
  const nameX = useTransform(progress, [0, 1], [startNameX, endNameX]);
  const nameY = useTransform(progress, [0, 1], [startNameY, endNameY]);
  const nameColor = useTransform(
    progress,
    [0, 1],
    ["rgba(255,255,255,1)", "rgba(24,24,27,0.95)"],
  );
  const nameShadowOpacity = useTransform(progress, [0, 1], [0.45, 0]);
  const nameShadow = useTransform(
    nameShadowOpacity,
    (v) => `0 2px 12px rgba(0,0,0,${v})`,
  );
  const birthDateLabel = formatBirthDateWithAge(
    user?.birthDate,
    locale,
    {
      one: t("profile.ageYears.one"),
      few: t("profile.ageYears.few"),
      many: t("profile.ageYears.many"),
      other: t("profile.ageYears.other"),
    },
  );
  const profileValues = {
    phone: accountData?.phone ?? auth?.phone ?? "",
    username: user?.username ?? "",
    bio: user?.bio ?? "",
    birthDate: birthDateLabel || t("profile.notSet"),
  } as const;

  return (
    <SidebarPage ref={rootRef}>
      <SidebarPageHeader>
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={pop}
            variant={"ghost"}
            size={"icon"}
            className="rounded-full"
            aria-label={t("actions.backAriaLabel")}
          >
            <ArrowLeft strokeWidth={3} className="size-6" />
          </Button>
          <SidebarPageTitle>{t("title")}</SidebarPageTitle>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant={"ghost"}
            size={"icon"}
            className="rounded-full"
            aria-label={t("actions.editProfileAriaLabel")}
            onClick={() => {
              if (!user?.id) return;
              push({ screen: "edit-profile", userId: user.id });
            }}
            disabled={!user?.id}
          >
            <Pencil strokeWidth={3} className="size-6" />
          </Button>
          <ProfileDropdown>
            <Button
              variant={"ghost"}
              size={"icon"}
              className="rounded-full"
              aria-label={t("actions.moreAriaLabel")}
            >
              <EllipsisVertical strokeWidth={3} className="size-6" />
            </Button>
          </ProfileDropdown>
        </div>
      </SidebarPageHeader>

      <div className="w-full">
        <motion.div
          ref={heroRef}
          style={{ height: heroHeight }}
          className="relative w-full"
        >
          <motion.div
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarRadius,
              x: avatarX,
            }}
            className="absolute left-0 top-0 overflow-hidden"
          >
            {hasAvatar ? (
              <AvatarCarousel
                avatarKeys={avatars}
                isExpanded={isAvatarExpanded}
                className="absolute inset-0"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-white bg-linear-to-tr from-primary to-green-400">
                {initials}
              </div>
            )}
          </motion.div>

          <motion.p
            ref={nameRef}
            style={{
              x: nameX,
              y: nameY,
              color: nameColor,
              textShadow: nameShadow,
            }}
            className="absolute left-0 top-0 font-semibold text-lg"
          >
            {user?.firstName}
          </motion.p>
        </motion.div>
      </div>

      <SidebarPageSeparator className="relative">
        <AvatarUploadButton className="absolute -top-5 right-3 z-20" />
      </SidebarPageSeparator>

      <SidebarPageContent>
        {SETTINGS_PROFILE_ROWS.map(({ key, icon: Icon }) => (
          <CopyableProfileValue
            key={key}
            icon={<Icon />}
            title={profileValues[key]}
            description={t(`profile.${key}`)}
          />
        ))}
      </SidebarPageContent>

      <SidebarPageSeparator />

      <SidebarPageContent>
        {SETTINGS_SECTION_ITEMS.map(({ key, icon: Icon, route }) => (
          <SectionButton
            key={key}
            icon={<Icon />}
            title={t(`sections.${key}`)}
            route={route}
          />
        ))}
      </SidebarPageContent>
    </SidebarPage>
  );
};
