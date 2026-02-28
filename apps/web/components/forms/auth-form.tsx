"use client";

import { authSchema, TypeAuthSchema } from "@/schemas/auth.schema";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthControllerSendOtp, useUsersControllerAddAvatar } from "@/api/generated";
import { useTranslations } from "next-intl";
import { Field, FieldError, FieldLabel } from "../ui/field";
import { Button, Checkbox, NumberInput, Ripple } from "@repo/ui";
import { useAuth } from "@/hooks/use-auth";
import { VerificationForm } from "./verification-form";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export function AuthForm() {
  const t = useTranslations("auth");
  const { mutate, isPending, isSuccess, data } = useAuthControllerSendOtp();
  const { deviceId, ensureDeviceId } = useAuth();
  const [requestPhone, setRequestPhone] = useState<string>("");
  const [requestDeviceId, setRequestDeviceId] = useState<string>("");

  const form = useForm<TypeAuthSchema>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      phone: "",
      privacy: false,
    },
  });

  function onSubmit(data: TypeAuthSchema) {
    const currentDeviceId = deviceId ?? ensureDeviceId();
    setRequestPhone(data.phone);
    setRequestDeviceId(currentDeviceId);

    mutate({
      data: {
        phone: data.phone,
        deviceId: currentDeviceId,
      },
    });
  }

  const challengeId = data?.challengeId;
  const showVerification = isSuccess && !!challengeId;

  return (
    <div className="relative w-full overflow-x-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {showVerification ? (
          <motion.div
            key="verification-form"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
            className="w-full"
          >
            <VerificationForm
              challengeId={challengeId}
              phone={requestPhone}
              deviceId={requestDeviceId}
            />
          </motion.div>
        ) : (
          <motion.div
            key="auth-form"
            initial={{ opacity: 0, x: -32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
            className="flex w-full flex-col items-center justify-center space-y-5"
          >
            <img src={"/logo.png"} alt="Logo" className="size-50" />
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground">{t("description")}</p>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="mt-3 flex flex-col space-y-5"
            >
              <Controller
                name={"phone"}
                control={form.control}
                render={({ field: { onChange, ...field }, fieldState }) => (
                  <Field>
                    <FieldLabel>{t("phoneInput.label")}</FieldLabel>
                    <NumberInput
                      {...field}
                      onValueChange={(_, payload) =>
                        onChange(payload.international)
                      }
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name={"privacy"}
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <div className="w-fit">
                      <Ripple asChild className="w-full rounded-xl">
                        <label className="flex flex-row w-full cursor-pointer items-center gap-3 rounded-xl px-5 py-4 [&>span:first-child]:inline-flex [&>span:first-child]:items-center [&>span:first-child]:gap-3 [&>span:first-child]:whitespace-nowrap">
                          <Checkbox
                            name={field.name}
                            checked={!!field.value}
                            onBlur={field.onBlur}
                            onCheckedChange={(checked) =>
                              field.onChange(checked === true)
                            }
                          />
                          <span className="text-sm font-medium select-none">
                            Принимаю{" "}
                            <span className="text-blue-500">
                              политику конфиденциальности
                            </span>{" "}
                            <strong>Orisign</strong>
                          </span>
                        </label>
                      </Ripple>
                    </div>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Button
                type="submit"
                className="mt-2 h-12 w-full"
                disabled={isPending}
              >
                {t("submitButton")}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
