import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { handleApiError, ok, validationFail } from "@/lib/http";
import { reminderQuerySchema } from "@/lib/validators/reminder";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = reminderQuerySchema.safeParse(query);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const now = new Date();
    const until = new Date(now.getTime() + parsed.data.hours * 60 * 60 * 1000);

    const [planner, exams] = await Promise.all([
      prisma.plannerItem.findMany({
        where: {
          userId: session.userId,
          status: {
            in: ["TODO", "IN_PROGRESS"],
          },
          dueAt: {
            gte: now,
            lte: until,
          },
        },
        orderBy: [{ dueAt: "asc" }],
        take: parsed.data.limit,
        include: {
          course: {
            select: { id: true, name: true, code: true },
          },
          semester: {
            select: { id: true, title: true },
          },
        },
      }),
      prisma.exam.findMany({
        where: {
          userId: session.userId,
          status: "SCHEDULED",
          examDate: {
            gte: now,
            lte: until,
          },
        },
        orderBy: [{ examDate: "asc" }],
        take: parsed.data.limit,
        include: {
          course: {
            select: { id: true, name: true, code: true },
          },
          semester: {
            select: { id: true, title: true },
          },
        },
      }),
    ]);

    const reminders = [
      ...planner.map((item: (typeof planner)[number]) => ({
        id: item.id,
        type: "PLANNER" as const,
        title: item.title,
        when: item.dueAt?.toISOString() ?? item.startAt?.toISOString() ?? now.toISOString(),
        course: item.course,
        semester: item.semester,
      })),
      ...exams.map((item: (typeof exams)[number]) => ({
        id: item.id,
        type: "EXAM" as const,
        title: item.title,
        when: item.examDate.toISOString(),
        course: item.course,
        semester: item.semester,
      })),
    ].sort((a: { when: string }, b: { when: string }) => a.when.localeCompare(b.when));

    return ok({
      windowHours: parsed.data.hours,
      count: reminders.length,
      items: reminders.slice(0, parsed.data.limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

