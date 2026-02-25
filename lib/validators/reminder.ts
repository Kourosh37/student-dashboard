import { z } from "zod";

export const reminderQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).default(24),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
