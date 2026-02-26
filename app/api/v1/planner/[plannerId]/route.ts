import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { fail, handleApiError, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { detectScheduleConflicts, plannerDraftInterval } from "@/lib/services/conflict-service";
import {
  deletePlannerItem,
  getPlannerItemById,
  updatePlannerItem,
} from "@/lib/services/planner-service";
import { updatePlannerSchema } from "@/lib/validators/planner";

type Context = {
  params: Promise<{ plannerId: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { plannerId } = await context.params;
    const item = await getPlannerItemById(session.userId, plannerId);
    if (!item) {
      return fail("Planner item not found", 404, "PLANNER_ITEM_NOT_FOUND");
    }
    return ok(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { plannerId } = await context.params;
    const body = await request.json();
    const parsed = updatePlannerSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const existing = await getPlannerItemById(session.userId, plannerId);
    if (!existing) {
      return fail("Planner item not found", 404, "PLANNER_ITEM_NOT_FOUND");
    }

    const nextPlannedFor =
      parsed.data.plannedFor === undefined
        ? existing.plannedFor
        : parsed.data.plannedFor
          ? new Date(parsed.data.plannedFor)
          : null;
    const nextStartAt =
      parsed.data.startAt === undefined
        ? existing.startAt
        : parsed.data.startAt
          ? new Date(parsed.data.startAt)
          : null;
    const nextDueAt =
      parsed.data.dueAt === undefined
        ? existing.dueAt
        : parsed.data.dueAt
          ? new Date(parsed.data.dueAt)
          : null;

    const hasScheduleChange =
      parsed.data.plannedFor !== undefined ||
      parsed.data.startAt !== undefined ||
      parsed.data.dueAt !== undefined;

    if (hasScheduleChange && !parsed.data.allowConflicts) {
      const interval = plannerDraftInterval({
        plannedFor: nextPlannedFor,
        startAt: nextStartAt,
        dueAt: nextDueAt,
      });

      if (interval) {
        const conflicts = await detectScheduleConflicts(session.userId, interval, {
          ignorePlannerId: plannerId,
        });
        if (conflicts.length > 0) {
          return fail("Schedule conflict detected", 409, "SCHEDULE_CONFLICT", { conflicts });
        }
      }
    }

    const updated = await updatePlannerItem(session.userId, plannerId, {
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      priority: parsed.data.priority,
      cadence: parsed.data.cadence,
      plannedFor:
        parsed.data.plannedFor === undefined
          ? undefined
          : parsed.data.plannedFor
            ? new Date(parsed.data.plannedFor)
            : null,
      startAt:
        parsed.data.startAt === undefined
          ? undefined
          : parsed.data.startAt
            ? new Date(parsed.data.startAt)
            : null,
      dueAt:
        parsed.data.dueAt === undefined
          ? undefined
          : parsed.data.dueAt
            ? new Date(parsed.data.dueAt)
            : null,
      isPinned: parsed.data.isPinned,
    });

    if (!updated) {
      return fail("Planner item not found", 404, "PLANNER_ITEM_NOT_FOUND");
    }
    publishUserEvent(session.userId, "planner.updated", { plannerId: updated.id });
    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { plannerId } = await context.params;
    const deleted = await deletePlannerItem(session.userId, plannerId);
    if (!deleted) {
      return fail("Planner item not found", 404, "PLANNER_ITEM_NOT_FOUND");
    }
    publishUserEvent(session.userId, "planner.deleted", { plannerId });
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
