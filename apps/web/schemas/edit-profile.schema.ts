import { z } from "zod";

type Translator = (key: string) => string;

export const createEditProfileSchema = (t: Translator) =>
  z.object({
    username: z
      .string()
      .trim()
      .min(1, t("usernameRequired"))
      .min(5, t("usernameTooShort"))
      .max(15, t("usernameTooLong"))
      .regex(/^[A-Za-z0-9_]+$/, t("usernameInvalidChars")),
    firstName: z.string().trim().min(1, t("firstNameRequired")),
    lastName: z.string().trim().min(1, t("lastNameRequired")),
    birthDate: z.string().optional(),
  });

export type TypeEditProfileSchema = z.infer<ReturnType<typeof createEditProfileSchema>>;
