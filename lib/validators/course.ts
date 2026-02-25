import { Weekday } from "@prisma/client";
import { z } from "zod";

import { queryLimitSchema, queryOffsetSchema } from "@/lib/validators/pagination";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const courseSessionSchema = z.object({
  id: z.string().cuid().optional(),
  weekday: z.nativeEnum(Weekday),
  startTime: z.string().regex(timeRegex, "Start time must be HH:mm"),
  endTime: z.string().regex(timeRegex, "End time must be HH:mm"),
  room: z.string().trim().max(120).optional().nullable(),
});

export const listCoursesQuerySchema = z.object({
  semesterId: z.string().cuid().optional(),
  q: z.string().trim().max(120).optional(),
  pinned: z.coerce.boolean().optional(),
  limit: queryLimitSchema,
  offset: queryOffsetSchema,
});

export const createCourseSchema = z.object({
  semesterId: z.string().cuid("Invalid semester"),
  name: z.string().trim().min(2, "Course name is too short").max(140, "Course name is too long"),
  code: z.string().trim().max(50).optional().nullable(),
  instructor: z.string().trim().max(120).optional().nullable(),
  location: z.string().trim().max(120).optional().nullable(),
  credits: z.coerce.number().int().min(0).max(30).optional().nullable(),
  color: z.string().trim().max(20).optional().nullable(),
  isPinned: z.boolean().optional().default(false),
  sessions: z.array(courseSessionSchema).max(20).optional().default([]),
});

export const updateCourseSchema = createCourseSchema.partial().extend({
  semesterId: z.string().cuid().optional(),
});
