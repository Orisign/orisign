import { z } from "zod";

type Translator = (key: string) => string;

export const createCreateGroupSchema = (t: Translator) =>
  z.object({
    title: z.string().trim().min(1, t("titleRequired")).max(80, t("titleTooLong")),
  });

export type TypeCreateGroupSchema = z.infer<
  ReturnType<typeof createCreateGroupSchema>
>;
