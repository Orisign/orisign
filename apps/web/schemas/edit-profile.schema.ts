import { z } from "zod";

export const editProfileSchema = z.object({
  username: z
    .string()
    .min(5)
    .max(15)
    .regex(/^[A-Za-z0-9_]+$/, "Только английские буквы, цифры и _")
    .optional(),
  firstName: z.string(),
  lastName: z.string().optional(),
  birthDate: z.string().optional(),
});

export type TypeEditProfileSchema = z.infer<typeof editProfileSchema>
