"use client";

import {
  getUsersControllerMeQueryKey,
  useUsersControllerAddAvatar,
} from "@/api/generated";
import { Button } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { ChangeEvent, useRef } from "react";

type AvatarUploadButtonProps = {
  className?: string;
};

export function AvatarUploadButton({ className }: AvatarUploadButtonProps) {
  const t = useTranslations("shared.avatarUploadButton");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const { mutateAsync, isPending } = useUsersControllerAddAvatar();

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await mutateAsync({ data: { file } });
      await queryClient.invalidateQueries({
        queryKey: getUsersControllerMeQueryKey(),
      });
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className={className}
      aria-label={t("ariaLabel")}
    >
      <input
        ref={inputRef}
        name="avatar"
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onFileChange}
        disabled={isPending}
      />
      <Button
        type="button"
        variant="default"
        className="rounded-full p-1 w-13 h-13"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="size-7" strokeWidth={2.5} />
      </Button>
    </form>
  );
}
