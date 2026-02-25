import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { assertLinkedEntitiesExist } from "@/lib/services/file-service";
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

    await assertLinkedEntitiesExist(session.userId, {
      semesterId: parsed.data.semesterId,
      courseId: parsed.data.courseId,
    });

    const created = await createPlannerItem(session.userId, {
      ...parsed.data,
      startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : null,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
    });
    publishUserEvent(session.userId, "planner.created", { plannerId: created.id });

    return ok(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
