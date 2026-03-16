import { z } from "zod";

type Translator = (key: "nameRequired" | "nameTooLong") => string;

export const createChatFolderEditorSchema = (t: Translator) =>
  z.object({
    name: z.string().trim().min(1, t("nameRequired")).max(80, t("nameTooLong")),
  });

export type TypeChatFolderEditorSchema = z.infer<
  ReturnType<typeof createChatFolderEditorSchema>
>;
