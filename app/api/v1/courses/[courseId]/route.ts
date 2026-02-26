import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { fail, handleApiError, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { detectCourseSessionConflicts } from "@/lib/services/conflict-service";
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

    const existing = await getCourseById(session.userId, courseId);
    if (!existing) {
      return fail("Course not found", 404, "COURSE_NOT_FOUND");
    }

    const targetSemesterId = parsed.data.semesterId ?? existing.semesterId;
    const targetSessions =
      parsed.data.sessions ??
      (existing.sessions ?? []).map((session) => ({
        weekday: session.weekday,
        startTime: session.startTime,
        endTime: session.endTime,
        room: session.room,
      }));

    const shouldValidateConflicts =
      (parsed.data.sessions !== undefined || parsed.data.semesterId !== undefined) &&
      targetSessions.length > 0 &&
      !(parsed.data.allowConflicts ?? false);

    if (shouldValidateConflicts) {
      const conflicts = await detectCourseSessionConflicts(session.userId, targetSemesterId, targetSessions, {
        ignoreCourseId: courseId,
      });
      if (conflicts.length > 0) {
        return fail("Schedule conflict detected", 409, "SCHEDULE_CONFLICT", { conflicts });
      }
    }

    const updated = await updateCourse(session.userId, courseId, {
      semesterId: parsed.data.semesterId,
      name: parsed.data.name,
      code: parsed.data.code,
      instructor: parsed.data.instructor,
      location: parsed.data.location,
      credits: parsed.data.credits,
      color: parsed.data.color,
      isPinned: parsed.data.isPinned,
      sessions: parsed.data.sessions,
    });

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
