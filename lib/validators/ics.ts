import { PlannerStatus } from "@prisma/client";
import { addDays } from "date-fns";
import { z } from "zod";

export const icsQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    semesterId: z.string().cuid().optional(),
    courseId: z.string().cuid().optional(),
    status: z.nativeEnum(PlannerStatus).optional(),
    q: z.string().trim().max(120).optional(),
  })
  .transform((value) => {
    const from = value.from ? new Date(value.from) : new Date();
    const to = value.to ? new Date(value.to) : addDays(from, 120);
    return {
      ...value,
      from,
      to,
    };
  });
