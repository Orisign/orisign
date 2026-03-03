"use client";

import { Ripple, toast } from "@repo/ui";
import { useTranslations } from "next-intl";
import { ReactNode } from "react";
import { COPYABLE_PROFILE_VALUE_CLASSNAME } from "./shared.constants";

interface CopyableProfileValueProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function CopyableProfileValue({
  icon,
  title,
  description,
}: CopyableProfileValueProps) {
  const t = useTranslations("shared.copyableProfileValue");

  function onClick() {
    navigator.clipboard.writeText(title);
    toast({
      title: t("copied", { field: description }),
      type: "info",
    });
  }

  return (
    <Ripple className={COPYABLE_PROFILE_VALUE_CLASSNAME} onClick={onClick}>
      <div className="flex items-center justify-center gap-5">
        {icon}
        <div className="flex flex-1 flex-col space-y-1">
          <p className="font-semibold">{title}</p>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>
    </Ripple>
  );
}
