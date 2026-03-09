import { z } from "zod";

type Translator = (key: string) => string;

export const createCreateChannelSchema = (t: Translator) =>
  z.object({
    title: z.string().trim().min(1, t("titleRequired")).max(80, t("titleTooLong")),
    username: z
      .string()
      .trim()
      .max(32, t("usernameTooLong"))
      .regex(/^[A-Za-z0-9_]*$/, t("usernameInvalid"))
      .optional()
      .or(z.literal("")),
    about: z.string().trim().max(200, t("aboutTooLong")).optional().or(z.literal("")),
  });

export type TypeCreateChannelSchema = z.infer<
  ReturnType<typeof createCreateChannelSchema>
>;
