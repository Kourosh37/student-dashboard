import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, fail, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { deleteSemester, updateSemester } from "@/lib/services/semester-service";
import { upsertSemesterSchema } from "@/lib/validators/semester";

type Context = {
  params: Promise<{ semesterId: string }>;
};

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { semesterId } = await context.params;
    const body = await request.json();
    const parsed = upsertSemesterSchema.partial().safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const updated = await updateSemester(session.userId, semesterId, {
      title: parsed.data.title,
      code: parsed.data.code,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      isCurrent: parsed.data.isCurrent,
      isPinned: parsed.data.isPinned,
    });
    if (!updated) {
      return fail("Semester not found", 404, "SEMESTER_NOT_FOUND");
    }
    publishUserEvent(session.userId, "semester.updated", { semesterId: updated.id });
    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { semesterId } = await context.params;
    const deleted = await deleteSemester(session.userId, semesterId);
    if (!deleted) {
      return fail("Semester not found", 404, "SEMESTER_NOT_FOUND");
    }
    publishUserEvent(session.userId, "semester.deleted", { semesterId });
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
