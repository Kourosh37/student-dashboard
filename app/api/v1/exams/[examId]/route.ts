import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { fail, handleApiError, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { detectScheduleConflicts, examDraftInterval } from "@/lib/services/conflict-service";
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

    const existing = await getExamById(session.userId, examId);
    if (!existing) {
      return fail("Exam not found", 404, "EXAM_NOT_FOUND");
    }

    const nextExamDate = parsed.data.examDate ? new Date(parsed.data.examDate) : existing.examDate;
    const nextDuration = parsed.data.durationMinutes ?? existing.durationMinutes;

    const hasScheduleChange = parsed.data.examDate !== undefined || parsed.data.durationMinutes !== undefined;

    if (hasScheduleChange && !parsed.data.allowConflicts) {
      const interval = examDraftInterval({
        examDate: nextExamDate,
        durationMinutes: nextDuration,
      });
      const conflicts = await detectScheduleConflicts(session.userId, interval, {
        ignoreExamId: examId,
      });
      if (conflicts.length > 0) {
        return fail("Schedule conflict detected", 409, "SCHEDULE_CONFLICT", { conflicts });
      }
    }

    const updated = await updateExam(session.userId, examId, {
      semesterId: parsed.data.semesterId,
      courseId: parsed.data.courseId,
      title: parsed.data.title,
      examType: parsed.data.examType,
      status: parsed.data.status,
      examDate: parsed.data.examDate ? new Date(parsed.data.examDate) : undefined,
      startTime: parsed.data.startTime,
      durationMinutes: parsed.data.durationMinutes,
      location: parsed.data.location,
      notes: parsed.data.notes,
      isPinned: parsed.data.isPinned,
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
