"use client";

import { SECTION_BUTTON_CLASSNAME } from "@/components/shared/shared.constants";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
  SidebarPageSeparator,
  SidebarPageTitle,
} from "@/components/ui/sidebar-page";
import { sidebarStore } from "@/store/sidebar/sidebar.store";
import {
  Button,
  cn,
  RadioGroup,
  RadioGroupItem,
  Ripple,
  Switch,
} from "@repo/ui";
import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export const LANGUAGES = [{ slug: "ru" }, { slug: "en" }] as const;

export const LanguageSidebar = () => {
  const { pop } = sidebarStore();
  const t = useTranslations("languageSidebar");
  const locale = useLocale();
  const router = useRouter();

  const handleLanguageChange = (nextLocale: string) => {
    if (!nextLocale || nextLocale === locale) return;

    document.cookie = `locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return (
    <SidebarPage>
      <SidebarPageHeader className="justify-start gap-3">
        <Button
          onClick={pop}
          variant={"ghost"}
          size={"icon"}
          className="rounded-full"
        >
          <ArrowLeft strokeWidth={3} className="size-6" />
        </Button>
        <SidebarPageTitle>{t("title")}</SidebarPageTitle>
      </SidebarPageHeader>

      <SidebarPageContent>
        <Ripple className={cn(SECTION_BUTTON_CLASSNAME, "py-2 px-1.5")}>
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span>{t("showTranslateButton")}</span>
            <Switch />
          </label>
        </Ripple>
      </SidebarPageContent>

      <SidebarPageSeparator className="my-2" />

      <SidebarPageContent>
        <RadioGroup value={locale} onValueChange={handleLanguageChange}>
          {LANGUAGES.map((lang) => (
            <Ripple
              key={lang.slug}
              className={cn(SECTION_BUTTON_CLASSNAME, "py-2 px-1.5")}
            >
              <label className="flex items-center gap-4 cursor-pointer">
                <RadioGroupItem value={lang.slug} />
                <div className="flex flex-col">
                  <span className="text-base font-semibold">
                    {t(`languages.${lang.slug}.international`)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t(`languages.${lang.slug}.locale`)}
                  </span>
                </div>
              </label>
            </Ripple>
          ))}
        </RadioGroup>
      </SidebarPageContent>
    </SidebarPage>
  );
};
