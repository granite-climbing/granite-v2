import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(6),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
