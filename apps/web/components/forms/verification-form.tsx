"use client";

import { useAuthControllerVerify } from "@/api/generated";
import { fetchCurrentUser } from "@/hooks/use-current-user";
import {
  verificationSchema,
  type TypeVerificationSchema,
} from "@/schemas/verification.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@repo/ui";
import { Controller, useForm } from "react-hook-form";
import { Field, FieldError } from "../ui/field";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { setCookie } from "@/lib/cookies";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

interface VerificationFormProps {
  challengeId: string;
  phone: string;
  deviceId: string;
}

const OTP_LENGTH = 6;
const SHAKE_ANIMATION = [0, -10, 10, -9, 9, -8, 8, -6, 6, -4, 4, -2, 2, 0];
const Player = dynamic(
  () => import("@lottiefiles/react-lottie-player").then((mod) => mod.Player),
  { ssr: false },
);

export function VerificationForm({
  challengeId,
  phone,
  deviceId,
}: VerificationFormProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const lastSubmittedCodeRef = useRef<string | null>(null);
  const shakeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [hasOtpError, setHasOtpError] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);

  const form = useForm<TypeVerificationSchema>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      code: "",
    },
  });

  const { mutate, isPending } = useAuthControllerVerify({
    mutation: {
      onError: () => {
        setHasOtpError(true);
        setShakeCount((prev) => prev + 1);

        if (shakeResetTimeoutRef.current) {
          clearTimeout(shakeResetTimeoutRef.current);
        }

        shakeResetTimeoutRef.current = setTimeout(() => {
          setHasOtpError(false);
        }, 1200);

        lastSubmittedCodeRef.current = null;
        form.setValue("code", "");
      },
      onSuccess: async (response) => {
        setCookie("accessToken", response.accessToken);

        try {
          const user = await fetchCurrentUser({
            credentials: "include",
          });
          const hasProfile =
            !!user?.firstName?.trim() || !!user?.username?.trim();

          router.push(hasProfile ? "/" : "/onboarding");
        } catch {
          router.push("/onboarding");
        }
      },
    },
  });

  const onSubmit = useCallback(
    (data: TypeVerificationSchema) => {
      lastSubmittedCodeRef.current = data.code;
      mutate({
        data: {
          phone,
          code: data.code,
          challengeId,
          deviceId,
        },
      });
    },
    [challengeId, deviceId, mutate, phone],
  );

  const code = form.watch("code") || "";

  useEffect(() => {
    return () => {
      if (shakeResetTimeoutRef.current) {
        clearTimeout(shakeResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const isComplete = code.length === OTP_LENGTH;
    if (!isComplete) {
      lastSubmittedCodeRef.current = null;
      return;
    }
    if (isPending) return;
    if (lastSubmittedCodeRef.current === code) return;

    form.handleSubmit(onSubmit)();
  }, [code, isPending, form, onSubmit]);

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="mx-auto flex w-full max-w-sm flex-col items-center justify-center space-y-8 px-4 py-4 text-center sm:space-y-12"
    >
      <div className="flex w-full flex-col items-center justify-center gap-4">
        <Player
          autoplay
          loop
          src={"https://chi2l3s.github.io/lottie-animations/duck_plane.json"}
          className="size-48"
        />
        <p className="text-muted-foreground max-w-xs sm:max-w-sm leading-relaxed">
          {t("successMessage")}
        </p>
      </div>
      <Controller
        name="code"
        control={form.control}
        render={({ field }) => (
          <Field className="items-center">
            <InputOTP
              maxLength={OTP_LENGTH}
              value={field.value}
              onChange={field.onChange}
              containerClassName="w-full justify-center"
              autoFocus
            >
              <motion.div
                key={shakeCount}
                animate={
                  hasOtpError ? { x: SHAKE_ANIMATION } : { x: 0 }
                }
                transition={{ duration: 1.2, ease: "easeInOut" }}
              >
                <InputOTPGroup className="justify-center">
                  {Array.from({ length: OTP_LENGTH }, (_, index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className={
                        hasOtpError
                          ? "bg-destructive/15 text-destructive ring-destructive"
                          : undefined
                      }
                    />
                  ))}
                </InputOTPGroup>
              </motion.div>
            </InputOTP>
          </Field>
        )}
      />
    </form>
  );
}
