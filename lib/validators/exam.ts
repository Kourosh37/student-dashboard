import { ExamStatus, ExamType } from "@prisma/client";
import { z } from "zod";

import { queryLimitSchema, queryOffsetSchema } from "@/lib/validators/pagination";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const listExamsQuerySchema = z.object({
  semesterId: z.string().cuid().optional(),
  courseId: z.string().cuid().optional(),
  status: z.nativeEnum(ExamStatus).optional(),
  examType: z.nativeEnum(ExamType).optional(),
  q: z.string().trim().max(120).optional(),
  limit: queryLimitSchema,
  offset: queryOffsetSchema,
});

export const createExamSchema = z.object({
  semesterId: z.string().cuid().optional().nullable(),
  courseId: z.string().cuid().optional().nullable(),
  title: z.string().trim().min(2, "Exam title is too short").max(160, "Exam title is too long"),
  examType: z.nativeEnum(ExamType).optional().default(ExamType.OTHER),
  status: z.nativeEnum(ExamStatus).optional().default(ExamStatus.SCHEDULED),
  examDate: z.string().datetime("Invalid exam date"),
  startTime: z
    .union([z.string().regex(timeRegex, "Start time must be HH:mm"), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  durationMinutes: z.coerce.number().int().min(0).max(600).optional().nullable(),
  location: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(2500).optional().nullable(),
  isPinned: z.boolean().optional().default(false),
  allowConflicts: z.boolean().optional().default(false),
});

export const updateExamSchema = createExamSchema.partial();
