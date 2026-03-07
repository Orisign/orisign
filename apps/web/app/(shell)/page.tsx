import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useTranslations } from "next-intl";
import { IoChatbubbles } from "react-icons/io5";

export default function HomePage() {
  const t = useTranslations("home.empty");

  return (
    <Empty className="min-h-[calc(100dvh-3rem)]">
      <EmptyHeader>
        <EmptyMedia variant={"icon"}>
          <IoChatbubbles />
        </EmptyMedia>
        <EmptyTitle>{t("title")}</EmptyTitle>
        <EmptyDescription>
          {t("description")}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
