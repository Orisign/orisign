import { z } from "zod";

type Translator = (key: string) => string;

export const createAuthSchema = (t: Translator) =>
  z.object({
    phone: z.string().refine((value) => /^\+?\d{10,15}$/.test(value), {
      message: t("phoneInvalid"),
    }),
    privacy: z.boolean().refine((value) => value === true, {
      message: t("privacyRequired"),
    }),
  });

export type TypeAuthSchema = z.infer<ReturnType<typeof createAuthSchema>>;
