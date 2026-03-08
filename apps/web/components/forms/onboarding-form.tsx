"use client";

import { useUsersControllerPatch } from "@/api/generated";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  createEditProfileSchema,
  TypeEditProfileSchema,
} from "@/schemas/edit-profile.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "../ui/field";
import { useTranslations } from "next-intl";
import { Button, Input } from "@repo/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";

const Player = dynamic(
  () => import("@lottiefiles/react-lottie-player").then((mod) => mod.Player),
  { ssr: false },
);


export const OnboardingForm = () => {
  const t = useTranslations("profile");
  const tv = useTranslations("validation.profile");
  const router = useRouter();
  const { user, isSuccess: isMeLoaded } = useCurrentUser();
  const editProfileSchema = useMemo(() => createEditProfileSchema(tv), [tv]);

  const { mutate: editProfile, isPending: isLoading } = useUsersControllerPatch(
    {
      request: {
        credentials: "include",
      },
      mutation: {
        onSuccess: () => {
          router.push("/");
        },
      },
    },
  );

  const form = useForm<TypeEditProfileSchema>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
    },
  });

  function onSubmit(data: TypeEditProfileSchema) {
    editProfile({
      data,
    });
  }

  useEffect(() => {
    if (!isMeLoaded) return;

    const hasProfile = !!user?.firstName?.trim() || !!user?.username?.trim();
    if (hasProfile) {
      router.replace("/");
    }
  }, [isMeLoaded, router, user]);

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col items-center justify-center text-center space-y-3 w-sm"
    >
      <Player
        autoplay
        loop
        src={"https://chi2l3s.github.io/lottie-animations/galk.json"}
        className="size-48"
      />
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground max-w-sm leading-relaxed">
        {t("description")}
      </p>
      <Controller
        name="firstName"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>{t("form.firstName.label")}</FieldLabel>
            <Input
              {...field}
              placeholder={t("form.firstName.placeholder")}
              autoComplete="off"
            />
            {fieldState.error && (
              <FieldError className="w-full text-left" errors={[fieldState.error]} />
            )}
          </Field>
        )}
      />
      <Controller
        name="lastName"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>{t("form.lastName.label")}</FieldLabel>
            <Input
              {...field}
              placeholder={t("form.lastName.placeholder")}
              autoComplete="off"
            />
            {fieldState.error && (
              <FieldError className="w-full text-left" errors={[fieldState.error]} />
            )}
          </Field>
        )}
      />
      <Controller
        name="username"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>{t("form.username.label")}</FieldLabel>
            <Input
              {...field}
              placeholder={t("form.username.placeholder")}
              autoComplete="off"
            />
            {fieldState.error && (
              <FieldError className="w-full text-left" errors={[fieldState.error]} />
            )}
          </Field>
        )}
      />

      <Button
        type="submit"
        className="mt-2 h-12 w-full"
        disabled={isLoading}
      >
        {t("form.submitButton")}
      </Button>
    </form>
  );
};
