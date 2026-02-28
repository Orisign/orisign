import { z } from "zod";

export const authSchema = z.object({
  phone: z
    .string()
    .refine((value) => /^\+?\d{10,15}$/.test(value), {
      message: "Введите номер телефона полностью",
    }),
  privacy: z.boolean().refine((value) => value === true, {
    message: "Нужно принять политику конфиденциальности",
  }),
});

export type TypeAuthSchema = z.infer<typeof authSchema>;
