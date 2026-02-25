import { PlannerPriority, PlannerStatus } from "@prisma/client";
import { z } from "zod";

import { queryLimitSchema, queryOffsetSchema } from "@/lib/validators/pagination";

export const listPlannerQuerySchema = z.object({
  status: z.nativeEnum(PlannerStatus).optional(),
  priority: z.nativeEnum(PlannerPriority).optional(),
  semesterId: z.string().cuid().optional(),
  courseId: z.string().cuid().optional(),
  pinned: z.coerce.boolean().optional(),
  q: z.string().trim().max(120).optional(),
  limit: queryLimitSchema,
  offset: queryOffsetSchema,
});

export const createPlannerSchema = z.object({
  semesterId: z.string().cuid().optional().nullable(),
  courseId: z.string().cuid().optional().nullable(),
  title: z.string().trim().min(3, "Title is too short").max(160, "Title is too long"),
  description: z.string().trim().max(2500).optional().nullable(),
  status: z.nativeEnum(PlannerStatus).optional().default(PlannerStatus.TODO),
  priority: z.nativeEnum(PlannerPriority).optional().default(PlannerPriority.MEDIUM),
  startAt: z.string().datetime().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  isPinned: z.boolean().optional().default(false),
});

export const updatePlannerSchema = createPlannerSchema.partial();
