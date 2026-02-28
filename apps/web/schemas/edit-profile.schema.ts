import { z } from "zod";

export const editProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Введите username")
    .min(5, "Слишком короткий username. Минимум 5 символов")
    .max(15, "Слишком длинный username. Максимум 15 символов")
    .regex(
      /^[A-Za-z0-9_]+$/,
      "Username может содержать только латинские буквы, цифры и символы",
    ),
  firstName: z.string().trim().min(1, "Введите имя"),
  lastName: z.string().trim().min(1, "Введите фамилию"),
  birthDate: z.string().optional(),
});

export type TypeEditProfileSchema = z.infer<typeof editProfileSchema>;
