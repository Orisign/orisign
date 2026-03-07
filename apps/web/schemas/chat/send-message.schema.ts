import z from "zod";

export const sendMessageSchema = z.object({
  text: z.string(),
  replyToId: z.string().optional(),
});

export type TypeSendMessageSchema = z.infer<typeof sendMessageSchema>;
