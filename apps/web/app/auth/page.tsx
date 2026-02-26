import { useTranslations } from "next-intl";

export default function AuthPage() {
  const t = useTranslations("auth");
  return (
    <div className="flex flex-col items-center justify-center space-y-4 min-h-screen">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
    </div>
  );
}
