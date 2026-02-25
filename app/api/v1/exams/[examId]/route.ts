import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, fail, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { deleteExam, getExamById, updateExam } from "@/lib/services/exam-service";
import { assertLinkedEntitiesExist } from "@/lib/services/file-service";
import { updateExamSchema } from "@/lib/validators/exam";

type Context = {
  params: Promise<{ examId: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { examId } = await context.params;
    const exam = await getExamById(session.userId, examId);
    if (!exam) {
      return fail("Exam not found", 404, "EXAM_NOT_FOUND");
    }
    return ok(exam);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { examId } = await context.params;
    const body = await request.json();
    const parsed = updateExamSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    await assertLinkedEntitiesExist(session.userId, {
      semesterId: parsed.data.semesterId,
      courseId: parsed.data.courseId,
    });

    const updated = await updateExam(session.userId, examId, {
      ...parsed.data,
      examDate: parsed.data.examDate ? new Date(parsed.data.examDate) : undefined,
    });
    if (!updated) {
      return fail("Exam not found", 404, "EXAM_NOT_FOUND");
    }
    publishUserEvent(session.userId, "exam.updated", { examId: updated.id });
    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { examId } = await context.params;
    const deleted = await deleteExam(session.userId, examId);
    if (!deleted) {
      return fail("Exam not found", 404, "EXAM_NOT_FOUND");
    }
    publishUserEvent(session.userId, "exam.deleted", { examId });
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
