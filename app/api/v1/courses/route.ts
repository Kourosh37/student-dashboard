import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { fail, handleApiError, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { detectCourseSessionConflicts } from "@/lib/services/conflict-service";
import { createCourse, listCourses } from "@/lib/services/course-service";
import { ensureSemesterOwnership } from "@/lib/services/ownership";
import { createCourseSchema, listCoursesQuerySchema } from "@/lib/validators/course";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = listCoursesQuerySchema.safeParse(query);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const result = await listCourses(session.userId, parsed.data);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = createCourseSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    await ensureSemesterOwnership(session.userId, parsed.data.semesterId);

    if (parsed.data.sessions.length > 0 && !parsed.data.allowConflicts) {
      const conflicts = await detectCourseSessionConflicts(session.userId, parsed.data.semesterId, parsed.data.sessions);
      if (conflicts.length > 0) {
        return fail("Schedule conflict detected", 409, "SCHEDULE_CONFLICT", { conflicts });
      }
    }

    const created = await createCourse(session.userId, {
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

    publishUserEvent(session.userId, "course.created", { courseId: created.id });
    return ok(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
