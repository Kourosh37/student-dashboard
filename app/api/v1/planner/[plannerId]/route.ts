import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, fail, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { assertLinkedEntitiesExist } from "@/lib/services/file-service";
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

    await assertLinkedEntitiesExist(session.userId, {
      semesterId: parsed.data.semesterId,
      courseId: parsed.data.courseId,
    });

    const updated = await updatePlannerItem(session.userId, plannerId, {
      ...parsed.data,
      startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : undefined,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
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
