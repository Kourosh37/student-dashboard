import { z } from "zod";

import { queryLimitSchema, queryOffsetSchema } from "@/lib/validators/pagination";

export const listEventsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  pinned: z.coerce.boolean().optional(),
  limit: queryLimitSchema,
  offset: queryOffsetSchema,
});

const eventBaseSchema = z.object({
  title: z.string().trim().min(2, "Event title is too short").max(160, "Event title is too long"),
  description: z.string().trim().max(2500).optional().nullable(),
  location: z.string().trim().max(160).optional().nullable(),
  startAt: z.string().datetime("Invalid event start date"),
  endAt: z.string().datetime("Invalid event end date").optional().nullable(),
  isPinned: z.boolean().optional().default(false),
  allowConflicts: z.boolean().optional().default(false),
});

export const createEventSchema = eventBaseSchema.refine(
  (value) => {
    if (!value.endAt) return true;
    return new Date(value.endAt).getTime() >= new Date(value.startAt).getTime();
  },
  {
    message: "Event end date must be after start date",
    path: ["endAt"],
  },
);

export const updateEventSchema = eventBaseSchema.partial().superRefine((value, ctx) => {
  if (!value.startAt || !value.endAt) return;

  const start = new Date(value.startAt).getTime();
  const end = new Date(value.endAt).getTime();
  if (end < start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Event end date must be after start date",
      path: ["endAt"],
    });
  }
});
