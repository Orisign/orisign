import { z } from "zod";

type Translator = (key: string) => string;

export const createEditProfileSidebarSchema = (t: Translator) =>
  z.object({
    firstName: z.string().trim().min(1, t("firstNameRequired")),
    lastName: z.string().trim().optional(),
    bio: z.string().trim().max(200, t("bioTooLong")).optional(),
    username: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || value.length >= 5, t("usernameTooShort"))
      .refine((value) => !value || value.length <= 15, t("usernameTooLong"))
      .refine(
        (value) => !value || /^[A-Za-z0-9_]+$/.test(value),
        t("usernameInvalidChars"),
      ),
  });

export type TypeEditProfileSidebarSchema = z.infer<
  ReturnType<typeof createEditProfileSidebarSchema>
>;
