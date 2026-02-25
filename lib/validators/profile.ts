import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80, "Name is too long"),
  studentId: z.string().trim().max(80).optional().nullable(),
  university: z.string().trim().max(120).optional().nullable(),
  major: z.string().trim().max(120).optional().nullable(),
  currentTerm: z.string().trim().max(80).optional().nullable(),
  bio: z.string().trim().max(2000).optional().nullable(),
});
