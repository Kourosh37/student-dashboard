import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { createExam, listExams } from "@/lib/services/exam-service";
import { assertLinkedEntitiesExist } from "@/lib/services/file-service";
import { createExamSchema, listExamsQuerySchema } from "@/lib/validators/exam";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = listExamsQuerySchema.safeParse(query);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const result = await listExams(session.userId, parsed.data);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = createExamSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    await assertLinkedEntitiesExist(session.userId, {
      semesterId: parsed.data.semesterId ?? null,
      courseId: parsed.data.courseId ?? null,
    });

    const created = await createExam(session.userId, {
      ...parsed.data,
      examDate: new Date(parsed.data.examDate),
    });
    publishUserEvent(session.userId, "exam.created", { examId: created.id });
    return ok(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
