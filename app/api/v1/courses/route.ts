import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
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
    const created = await createCourse(session.userId, parsed.data);
    publishUserEvent(session.userId, "course.created", { courseId: created.id });
    return ok(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
