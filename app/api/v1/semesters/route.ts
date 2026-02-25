import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { createSemester, listSemesters } from "@/lib/services/semester-service";
import { listSemestersQuerySchema, upsertSemesterSchema } from "@/lib/validators/semester";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = listSemestersQuerySchema.safeParse(query);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const items = await listSemesters(session.userId, parsed.data);
    return ok(items);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = upsertSemesterSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const created = await createSemester(session.userId, {
      title: parsed.data.title,
      code: parsed.data.code,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      isCurrent: parsed.data.isCurrent,
      isPinned: parsed.data.isPinned,
    });
    publishUserEvent(session.userId, "semester.created", { semesterId: created.id });
    return ok(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
