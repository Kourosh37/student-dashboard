import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, fail, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { deleteCourse, getCourseById, updateCourse } from "@/lib/services/course-service";
import { ensureSemesterOwnership } from "@/lib/services/ownership";
import { updateCourseSchema } from "@/lib/validators/course";

type Context = {
  params: Promise<{ courseId: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { courseId } = await context.params;
    const course = await getCourseById(session.userId, courseId);
    if (!course) {
      return fail("Course not found", 404, "COURSE_NOT_FOUND");
    }
    return ok(course);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { courseId } = await context.params;
    const body = await request.json();
    const parsed = updateCourseSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    if (parsed.data.semesterId) {
      await ensureSemesterOwnership(session.userId, parsed.data.semesterId);
    }

    const updated = await updateCourse(session.userId, courseId, parsed.data);
    if (!updated) {
      return fail("Course not found", 404, "COURSE_NOT_FOUND");
    }
    publishUserEvent(session.userId, "course.updated", { courseId: updated.id });
    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { courseId } = await context.params;
    const deleted = await deleteCourse(session.userId, courseId);
    if (!deleted) {
      return fail("Course not found", 404, "COURSE_NOT_FOUND");
    }
    publishUserEvent(session.userId, "course.deleted", { courseId });
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
