import { Weekday } from "@prisma/client";
import { z } from "zod";

import { queryLimitSchema, queryOffsetSchema } from "@/lib/validators/pagination";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function validateSessionOverlaps(
  sessions: Array<{ weekday: Weekday; startTime: string; endTime: string }>,
  ctx: z.RefinementCtx,
) {
  for (let i = 0; i < sessions.length; i += 1) {
    const current = sessions[i];
    const currentStart = toMinutes(current.startTime);
    const currentEnd = toMinutes(current.endTime);

    for (let j = i + 1; j < sessions.length; j += 1) {
      const next = sessions[j];
      if (next.weekday !== current.weekday) continue;

      const nextStart = toMinutes(next.startTime);
      const nextEnd = toMinutes(next.endTime);

      if (currentStart < nextEnd && nextStart < currentEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Class sessions overlap with each other",
          path: ["sessions", j, "startTime"],
        });
      }
    }
  }
}

export const courseSessionSchema = z
  .object({
    id: z.string().cuid().optional(),
    weekday: z.nativeEnum(Weekday),
    startTime: z.string().regex(timeRegex, "Start time must be HH:mm"),
    endTime: z.string().regex(timeRegex, "End time must be HH:mm"),
    room: z.string().trim().max(120).optional().nullable(),
  })
  .refine((value) => toMinutes(value.endTime) > toMinutes(value.startTime), {
    message: "Session end time must be after start time",
    path: ["endTime"],
  });

export const listCoursesQuerySchema = z.object({
  semesterId: z.string().cuid().optional(),
  q: z.string().trim().max(120).optional(),
  pinned: z.coerce.boolean().optional(),
  limit: queryLimitSchema,
  offset: queryOffsetSchema,
});

const courseBaseSchema = z.object({
  semesterId: z.string().cuid("Invalid semester"),
  name: z.string().trim().min(2, "Course name is too short").max(140, "Course name is too long"),
  code: z.string().trim().max(50).optional().nullable(),
  instructor: z.string().trim().max(120).optional().nullable(),
  location: z.string().trim().max(120).optional().nullable(),
  credits: z.coerce.number().int().min(0).max(30).optional().nullable(),
  color: z.string().trim().max(20).optional().nullable(),
  isPinned: z.boolean().optional().default(false),
  sessions: z.array(courseSessionSchema).max(20).optional().default([]),
  allowConflicts: z.boolean().optional().default(false),
});

export const createCourseSchema = courseBaseSchema.superRefine((value, ctx) => {
  validateSessionOverlaps(value.sessions, ctx);
});

export const updateCourseSchema = courseBaseSchema
  .partial()
  .extend({
    semesterId: z.string().cuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.sessions) {
      validateSessionOverlaps(value.sessions, ctx);
    }
  });
