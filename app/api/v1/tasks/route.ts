import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { fail, handleApiError, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { detectScheduleConflicts, plannerDraftInterval } from "@/lib/services/conflict-service";
import { createPlannerItem, listPlannerItems } from "@/lib/services/planner-service";
import { createPlannerSchema, listPlannerQuerySchema } from "@/lib/validators/planner";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = listPlannerQuerySchema.safeParse(query);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const result = await listPlannerItems(session.userId, parsed.data);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = createPlannerSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const plannedFor = parsed.data.plannedFor ? new Date(parsed.data.plannedFor) : null;
    const startAt = parsed.data.startAt ? new Date(parsed.data.startAt) : null;
    const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;

    const interval = plannerDraftInterval({ plannedFor, startAt, dueAt });
    if (interval && !parsed.data.allowConflicts) {
      const conflicts = await detectScheduleConflicts(session.userId, interval);
      if (conflicts.length > 0) {
        return fail("Schedule conflict detected", 409, "SCHEDULE_CONFLICT", { conflicts });
      }
    }

    const created = await createPlannerItem(session.userId, {
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      priority: parsed.data.priority,
      cadence: parsed.data.cadence,
      plannedFor,
      startAt,
      dueAt,
      isPinned: parsed.data.isPinned,
    });
    publishUserEvent(session.userId, "planner.created", { plannerId: created.id });

    return ok(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
