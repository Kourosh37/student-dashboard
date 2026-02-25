import { PlannerStatus } from "@prisma/client";
import { z } from "zod";

export const calendarQuerySchema = z.object({
  from: z.string().datetime("Invalid from date"),
  to: z.string().datetime("Invalid to date"),
  semesterId: z.string().cuid().optional(),
  courseId: z.string().cuid().optional(),
  status: z.nativeEnum(PlannerStatus).optional(),
  q: z.string().trim().max(120).optional(),
});
