import { z } from "zod";

export const authSchema = z.object({
  phone: z.string(),
  privacy: z.boolean().refine((value) => value === true, {
    message: "Нужно принять политику конфиденциальности",
  }),
});

export type TypeAuthSchema = z.infer<typeof authSchema>;
