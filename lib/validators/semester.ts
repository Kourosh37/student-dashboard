import { z } from "zod";

export const listSemestersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  pinned: z.coerce.boolean().optional(),
});

export const upsertSemesterSchema = z.object({
  title: z.string().trim().min(2, "Semester title is too short").max(120, "Semester title is too long"),
  code: z.string().trim().max(40, "Code is too long").optional().nullable(),
  startDate: z.string().datetime("Invalid start date"),
  endDate: z.string().datetime("Invalid end date"),
  isCurrent: z.boolean().optional().default(false),
  isPinned: z.boolean().optional().default(false),
});
