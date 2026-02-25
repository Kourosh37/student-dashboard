import { z } from "zod";

export const scheduleQuerySchema = z.object({
  semesterId: z.string().cuid().optional(),
  courseId: z.string().cuid().optional(),
  weekday: z
    .enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"])
    .optional(),
  q: z.string().trim().max(120).optional(),
});
