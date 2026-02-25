import { NextRequest, NextResponse } from "next/server";
import { addDays, eachDayOfInterval } from "date-fns";

import { requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { handleApiError, validationFail } from "@/lib/http";
import { icsQuerySchema } from "@/lib/validators/ics";

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function toDateWithTime(baseDate: Date, hhmm: string) {
  const [hh, mm] = hhmm.split(":").map((value) => Number(value));
  const date = new Date(baseDate);
  date.setHours(hh, mm, 0, 0);
  return date;
}

function buildEvent(params: {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
}) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(params.start)}`,
    `DTEND:${formatIcsDate(params.end ?? addDays(params.start, 1))}`,
    `SUMMARY:${escapeText(params.title)}`,
  ];

  if (params.description) {
    lines.push(`DESCRIPTION:${escapeText(params.description)}`);
  }
  if (params.location) {
    lines.push(`LOCATION:${escapeText(params.location)}`);
  }

  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = icsQuerySchema.safeParse(query);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const { from, to, semesterId, courseId, status, q } = parsed.data;

    const [plannerItems, exams, sessions] = await Promise.all([
      prisma.plannerItem.findMany({
        where: {
          userId: session.userId,
          ...(semesterId ? { semesterId } : {}),
          ...(courseId ? { courseId } : {}),
          ...(status ? { status } : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
          OR: [
            { dueAt: { gte: from, lte: to } },
            { startAt: { gte: from, lte: to } },
          ],
        },
        include: {
          course: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
      prisma.exam.findMany({
        where: {
          userId: session.userId,
          ...(semesterId ? { semesterId } : {}),
          ...(courseId ? { courseId } : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { notes: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
          examDate: { gte: from, lte: to },
        },
        include: {
          course: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
      prisma.courseSession.findMany({
        where: {
          course: {
            userId: session.userId,
            ...(semesterId ? { semesterId } : {}),
            ...(courseId ? { id: courseId } : {}),
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { code: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
        },
        include: {
          course: {
            select: { id: true, name: true, code: true, location: true },
          },
        },
      }),
    ]);

    const events: string[] = [];

    for (const item of plannerItems) {
      const start = item.dueAt ?? item.startAt;
      if (!start) continue;
      const end = item.dueAt ? addDays(item.dueAt, 1) : addDays(start, 1);
      events.push(
        buildEvent({
          uid: `planner-${item.id}@student-dashboard`,
          title: `Planner: ${item.title}`,
          description: item.description ?? undefined,
          start,
          end,
        }),
      );
    }

    for (const exam of exams) {
      const start = exam.examDate;
      const end = exam.durationMinutes
        ? new Date(start.getTime() + exam.durationMinutes * 60_000)
        : addDays(start, 1);
      events.push(
        buildEvent({
          uid: `exam-${exam.id}@student-dashboard`,
          title: `Exam: ${exam.title}`,
          description: exam.notes ?? undefined,
          location: exam.location ?? undefined,
          start,
          end,
        }),
      );
    }

    const intervalDays = eachDayOfInterval({ start: from, end: to });

    for (const session of sessions) {
      for (const day of intervalDays) {
        const dayIndex = day.getDay();
        const matches =
          (session.weekday === "MONDAY" && dayIndex === 1) ||
          (session.weekday === "TUESDAY" && dayIndex === 2) ||
          (session.weekday === "WEDNESDAY" && dayIndex === 3) ||
          (session.weekday === "THURSDAY" && dayIndex === 4) ||
          (session.weekday === "FRIDAY" && dayIndex === 5) ||
          (session.weekday === "SATURDAY" && dayIndex === 6) ||
          (session.weekday === "SUNDAY" && dayIndex === 0);

        if (!matches) continue;

        const start = toDateWithTime(day, session.startTime);
        const end = toDateWithTime(day, session.endTime);

        events.push(
          buildEvent({
            uid: `class-${session.id}-${day.toISOString()}@student-dashboard`,
            title: `Class: ${session.course.name}${session.course.code ? ` (${session.course.code})` : ""}`,
            location: session.room ?? session.course.location ?? undefined,
            start,
            end,
          }),
        );
      }
    }

    const calendarBody = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Student Dashboard//Calendar Export//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    return new NextResponse(calendarBody, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="student-dashboard-calendar.ics"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
