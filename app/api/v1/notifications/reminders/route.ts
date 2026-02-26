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

    const [planner, events, exams] = await Promise.all([
      prisma.plannerItem.findMany({
        where: {
          userId: session.userId,
          status: {
            in: ["TODO", "IN_PROGRESS"],
          },
          OR: [
            {
              dueAt: {
                gte: now,
                lte: until,
              },
            },
            {
              plannedFor: {
                gte: now,
                lte: until,
              },
            },
          ],
        },
        orderBy: [{ dueAt: "asc" }, { plannedFor: "asc" }],
        take: parsed.data.limit,
      }),
      prisma.studentEvent.findMany({
        where: {
          userId: session.userId,
          startAt: {
            gte: now,
            lte: until,
          },
        },
        orderBy: [{ startAt: "asc" }],
        take: parsed.data.limit,
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
        when:
          item.dueAt?.toISOString() ??
          item.plannedFor?.toISOString() ??
          item.startAt?.toISOString() ??
          now.toISOString(),
        cadence: item.cadence,
        course: null,
        semester: null,
      })),
      ...events.map((item: (typeof events)[number]) => ({
        id: item.id,
        type: "EVENT" as const,
        title: item.title,
        when: item.startAt.toISOString(),
        cadence: null,
        course: null,
        semester: null,
      })),
      ...exams.map((item: (typeof exams)[number]) => ({
        id: item.id,
        type: "EXAM" as const,
        title: item.title,
        when: item.examDate.toISOString(),
        cadence: null,
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
