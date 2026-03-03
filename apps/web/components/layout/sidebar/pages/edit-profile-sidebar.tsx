"use client";

import { useUsersControllerMe, useUsersControllerPatch } from "@/api/generated";
import { AvatarUploadButton } from "@/components/shared/avatar-upload-button";
import { useSidebar } from "@/hooks/use-sidebar";
import {
  createEditProfileSidebarSchema,
  TypeEditProfileSidebarSchema,
} from "@/schemas/edit-profile-sidebar.schema";
import { Button, Input } from "@repo/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "../../../ui/field";

export const EditProfileSidebar = () => {
  const t = useTranslations("editProfileSidebar");
  const tv = useTranslations("validation.profile");
  const { pop } = useSidebar();
  const { data } = useUsersControllerMe();
  const schema = useMemo(() => createEditProfileSidebarSchema(tv), [tv]);
  const { mutate: patchUser, isPending } = useUsersControllerPatch();

  const form = useForm<TypeEditProfileSidebarSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      bio: "",
      username: "",
    },
  });

  useEffect(() => {
    const user = data?.user;
    if (!user) return;

    form.reset({
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      bio: user.bio ?? "",
      username: user.username ?? "",
    });
  }, [data?.user, form]);

  const onSubmit = (values: TypeEditProfileSidebarSchema) => {
    patchUser({
      data: {
        firstName: values.firstName,
        lastName: values.lastName || "",
        bio: values.bio || "",
        username: values.username || "",
      },
    });
    form.reset(values);
  };
  const latestAvatarKey = data?.user?.avatars?.at(-1);
  const storageBaseUrl = process.env.NEXT_PUBLIC_STORAGE_URL ?? "";
  const latestAvatarUrl = useMemo(() => {
    if (!latestAvatarKey) return "";
    if (
      latestAvatarKey.startsWith("http://") ||
      latestAvatarKey.startsWith("https://")
    ) {
      return latestAvatarKey;
    }
    const base = storageBaseUrl.endsWith("/")
      ? storageBaseUrl
      : `${storageBaseUrl}/`;
    const normalizedKey = latestAvatarKey.startsWith("/")
      ? latestAvatarKey.slice(1)
      : latestAvatarKey;
    return `${base}${normalizedKey}`;
  }, [latestAvatarKey, storageBaseUrl]);

  return (
    <div className="relative flex w-full flex-col space-y-5 px-5 pb-24">
      <div className="flex items-center gap-3">
        <Button
          onClick={pop}
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={t("actions.backAriaLabel")}
        >
          <ArrowLeft strokeWidth={3} className="size-6" />
        </Button>
        <h1 className="text-xl font-bold">{t("title")}</h1>
      </div>

      <div className="relative mx-auto size-40 overflow-hidden rounded-full bg-accent">
        {latestAvatarUrl ? (
          <img
            src={latestAvatarUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}
        <AvatarUploadButton className="absolute inset-0 flex items-center justify-center" />
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Controller
          name="firstName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel>{t("fields.firstName.label")}</FieldLabel>
              <Input
                {...field}
                placeholder={t("fields.firstName.placeholder")}
                autoComplete="off"
              />
              {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />

        <Controller
          name="lastName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel>{t("fields.lastName.label")}</FieldLabel>
              <Input
                {...field}
                placeholder={t("fields.lastName.placeholder")}
                autoComplete="off"
              />
              {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />

        <Controller
          name="bio"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel>{t("fields.bio.label")}</FieldLabel>
              <Input
                {...field}
                placeholder={t("fields.bio.placeholder")}
                autoComplete="off"
              />
              {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
        <p className="text-sm text-muted-foreground">{t("fields.bio.hint")}</p>

        <div className="-mx-5 space-y-3 bg-accent/60 px-5 py-3">
          <h2 className="text-lg font-semibold text-primary">
            {t("fields.username.title")}
          </h2>
          <Controller
            name="username"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>{t("fields.username.label")}</FieldLabel>
                <Input
                  {...field}
                  placeholder={t("fields.username.placeholder")}
                  autoComplete="off"
                />
                {fieldState.error ? (
                  <FieldError errors={[fieldState.error]} />
                ) : null}
              </Field>
            )}
          />
          <p className="text-sm text-muted-foreground">{t("fields.username.hintBrand")}</p>
          <p className="text-sm text-muted-foreground">{t("fields.username.hintRules")}</p>
        </div>
      </form>

      <AnimatePresence>
        {form.formState.isDirty ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-6 right-5"
          >
            <Button
              type="button"
              onClick={form.handleSubmit(onSubmit)}
              className="size-14 rounded-full shadow-lg"
              disabled={isPending}
              aria-label={t("actions.save")}
            >
              <Check className="size-7" strokeWidth={3} />
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
