import z from "zod";

export const verificationSchema = z.object({
  code: z.string().length(6),
});

export type TypeVerificationSchema = z.infer<typeof verificationSchema>;
