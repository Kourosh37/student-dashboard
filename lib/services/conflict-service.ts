import type { Weekday } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type ConflictItem = {
  source: "CLASS" | "PLANNER" | "EVENT" | "EXAM";
  id: string;
  title: string;
  startAt: string;
  endAt: string;
};

export type CourseSessionDraft = {
  weekday: Weekday;
  startTime: string;
  endTime: string;
};

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function normalizeInterval(startAt: Date, endAt: Date | null | undefined) {
  const safeEnd = endAt && endAt.getTime() > startAt.getTime() ? endAt : addMinutes(startAt, 60);
  return { startAt, endAt: safeEnd };
}

function overlaps(a: { startAt: Date; endAt: Date }, b: { startAt: Date; endAt: Date }) {
  return a.startAt.getTime() < b.endAt.getTime() && b.startAt.getTime() < a.endAt.getTime();
}

function overlapsMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesFromDate(date: Date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function weekdayFromDate(date: Date): Weekday {
  const day = date.getUTCDay();
  if (day === 0) return "SUNDAY";
  if (day === 1) return "MONDAY";
  if (day === 2) return "TUESDAY";
  if (day === 3) return "WEDNESDAY";
  if (day === 4) return "THURSDAY";
  if (day === 5) return "FRIDAY";
  return "SATURDAY";
}

function firstOccurrenceInRange(startAt: Date, endAt: Date, weekday: Weekday) {
  const cursor = new Date(Date.UTC(startAt.getUTCFullYear(), startAt.getUTCMonth(), startAt.getUTCDate()));
  while (cursor.getTime() <= endAt.getTime()) {
    if (weekdayFromDate(cursor) === weekday) {
      return cursor;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return new Date(Date.UTC(startAt.getUTCFullYear(), startAt.getUTCMonth(), startAt.getUTCDate()));
}

function plannerInterval(item: {
  startAt: Date | null;
  dueAt: Date | null;
  plannedFor: Date | null;
}) {
  if (item.startAt && item.dueAt) {
    const start = item.startAt.getTime() <= item.dueAt.getTime() ? item.startAt : item.dueAt;
    const end = item.startAt.getTime() > item.dueAt.getTime() ? item.startAt : item.dueAt;
    return normalizeInterval(start, end);
  }
  if (item.startAt) return normalizeInterval(item.startAt, null);
  if (item.dueAt) return normalizeInterval(item.dueAt, null);
  if (item.plannedFor) return normalizeInterval(item.plannedFor, null);
  return null;
}

function examInterval(item: { examDate: Date; durationMinutes: number | null }) {
  const end = item.durationMinutes ? addMinutes(item.examDate, item.durationMinutes) : addMinutes(item.examDate, 90);
  return normalizeInterval(item.examDate, end);
}

function eventInterval(item: { startAt: Date; endAt: Date | null }) {
  return normalizeInterval(item.startAt, item.endAt);
}

export async function detectScheduleConflicts(
  userId: string,
  interval: { startAt: Date; endAt: Date },
  options?: {
    ignorePlannerId?: string;
    ignoreEventId?: string;
    ignoreExamId?: string;
  },
) {
  const normalized = normalizeInterval(interval.startAt, interval.endAt);
  const from = addMinutes(normalized.startAt, -24 * 60);
  const to = addMinutes(normalized.endAt, 24 * 60);

  const [sessions, plannerItems, events, exams] = await Promise.all([
    prisma.courseSession.findMany({
      where: {
        weekday: weekdayFromDate(normalized.startAt),
        course: { userId },
      },
      include: {
        course: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.plannerItem.findMany({
      where: {
        userId,
        ...(options?.ignorePlannerId ? { NOT: { id: options.ignorePlannerId } } : {}),
        OR: [
          { startAt: { gte: from, lte: to } },
          { dueAt: { gte: from, lte: to } },
          { plannedFor: { gte: from, lte: to } },
        ],
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        dueAt: true,
        plannedFor: true,
      },
    }),
    prisma.studentEvent.findMany({
      where: {
        userId,
        ...(options?.ignoreEventId ? { NOT: { id: options.ignoreEventId } } : {}),
        startAt: { lte: to },
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
      },
    }),
    prisma.exam.findMany({
      where: {
        userId,
        ...(options?.ignoreExamId ? { NOT: { id: options.ignoreExamId } } : {}),
        examDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        title: true,
        examDate: true,
        durationMinutes: true,
      },
    }),
  ]);

  const conflicts: ConflictItem[] = [];

  const targetDayStart = new Date(Date.UTC(normalized.startAt.getUTCFullYear(), normalized.startAt.getUTCMonth(), normalized.startAt.getUTCDate()));
  const targetStartMinutes = normalized.startAt.getUTCHours() * 60 + normalized.startAt.getUTCMinutes();
  const targetEndMinutes = normalized.endAt.getUTCHours() * 60 + normalized.endAt.getUTCMinutes();

  for (const session of sessions) {
    const sessionStartMinutes = toMinutes(session.startTime);
    const sessionEndMinutes = toMinutes(session.endTime);
    if (sessionStartMinutes < targetEndMinutes && targetStartMinutes < sessionEndMinutes) {
      const classStart = addMinutes(targetDayStart, sessionStartMinutes);
      const classEnd = addMinutes(targetDayStart, sessionEndMinutes);
      conflicts.push({
        source: "CLASS",
        id: session.id,
        title: `کلاس ${session.course.name}`,
        startAt: classStart.toISOString(),
        endAt: classEnd.toISOString(),
      });
    }
  }

  for (const item of plannerItems) {
    const itemInterval = plannerInterval({
      startAt: item.startAt,
      dueAt: item.dueAt,
      plannedFor: item.plannedFor,
    });
    if (!itemInterval) continue;
    if (overlaps(normalized, itemInterval)) {
      conflicts.push({
        source: "PLANNER",
        id: item.id,
        title: item.title,
        startAt: itemInterval.startAt.toISOString(),
        endAt: itemInterval.endAt.toISOString(),
      });
    }
  }

  for (const item of events) {
    const itemInterval = eventInterval(item);
    if (overlaps(normalized, itemInterval)) {
      conflicts.push({
        source: "EVENT",
        id: item.id,
        title: item.title,
        startAt: itemInterval.startAt.toISOString(),
        endAt: itemInterval.endAt.toISOString(),
      });
    }
  }

  for (const item of exams) {
    const itemInterval = examInterval(item);
    if (overlaps(normalized, itemInterval)) {
      conflicts.push({
        source: "EXAM",
        id: item.id,
        title: item.title,
        startAt: itemInterval.startAt.toISOString(),
        endAt: itemInterval.endAt.toISOString(),
      });
    }
  }

  return conflicts.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export async function detectCourseSessionConflicts(
  userId: string,
  semesterId: string,
  sessions: CourseSessionDraft[],
  options?: {
    ignoreCourseId?: string;
  },
) {
  if (sessions.length === 0) return [];

  const semester = await prisma.semester.findFirst({
    where: { id: semesterId, userId },
    select: { startDate: true, endDate: true },
  });
  if (!semester) return [];

  const from = semester.startDate;
  const to = semester.endDate;

  const [existingSessions, plannerItems, events, exams] = await Promise.all([
    prisma.courseSession.findMany({
      where: {
        course: {
          userId,
          semesterId,
          ...(options?.ignoreCourseId ? { id: { not: options.ignoreCourseId } } : {}),
        },
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.plannerItem.findMany({
      where: {
        userId,
        OR: [
          { startAt: { gte: from, lte: to } },
          { dueAt: { gte: from, lte: to } },
          { plannedFor: { gte: from, lte: to } },
        ],
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        dueAt: true,
        plannedFor: true,
      },
    }),
    prisma.studentEvent.findMany({
      where: {
        userId,
        startAt: { lte: to },
        OR: [{ endAt: null }, { endAt: { gte: from } }],
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
      },
    }),
    prisma.exam.findMany({
      where: {
        userId,
        examDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        title: true,
        examDate: true,
        durationMinutes: true,
      },
    }),
  ]);

  const conflicts: ConflictItem[] = [];

  for (const draft of sessions) {
    const draftStartMinutes = toMinutes(draft.startTime);
    const draftEndMinutes = toMinutes(draft.endTime);
    const classDate = firstOccurrenceInRange(from, to, draft.weekday);

    for (const existing of existingSessions) {
      if (existing.weekday !== draft.weekday) continue;

      const existingStartMinutes = toMinutes(existing.startTime);
      const existingEndMinutes = toMinutes(existing.endTime);
      if (!overlapsMinutes(draftStartMinutes, draftEndMinutes, existingStartMinutes, existingEndMinutes)) continue;

      const startAt = addMinutes(classDate, existingStartMinutes);
      const endAt = addMinutes(classDate, existingEndMinutes);
      conflicts.push({
        source: "CLASS",
        id: existing.id,
        title: `کلاس ${existing.course.name}`,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      });
    }

    for (const item of plannerItems) {
      const interval = plannerInterval({
        startAt: item.startAt,
        dueAt: item.dueAt,
        plannedFor: item.plannedFor,
      });
      if (!interval) continue;
      if (weekdayFromDate(interval.startAt) !== draft.weekday) continue;

      const startMinutes = minutesFromDate(interval.startAt);
      const endMinutes = minutesFromDate(interval.endAt);
      if (!overlapsMinutes(draftStartMinutes, draftEndMinutes, startMinutes, endMinutes)) continue;

      conflicts.push({
        source: "PLANNER",
        id: item.id,
        title: item.title,
        startAt: interval.startAt.toISOString(),
        endAt: interval.endAt.toISOString(),
      });
    }

    for (const item of events) {
      const interval = eventInterval(item);
      if (weekdayFromDate(interval.startAt) !== draft.weekday) continue;

      const startMinutes = minutesFromDate(interval.startAt);
      const endMinutes = minutesFromDate(interval.endAt);
      if (!overlapsMinutes(draftStartMinutes, draftEndMinutes, startMinutes, endMinutes)) continue;

      conflicts.push({
        source: "EVENT",
        id: item.id,
        title: item.title,
        startAt: interval.startAt.toISOString(),
        endAt: interval.endAt.toISOString(),
      });
    }

    for (const item of exams) {
      const interval = examInterval(item);
      if (weekdayFromDate(interval.startAt) !== draft.weekday) continue;

      const startMinutes = minutesFromDate(interval.startAt);
      const endMinutes = minutesFromDate(interval.endAt);
      if (!overlapsMinutes(draftStartMinutes, draftEndMinutes, startMinutes, endMinutes)) continue;

      conflicts.push({
        source: "EXAM",
        id: item.id,
        title: item.title,
        startAt: interval.startAt.toISOString(),
        endAt: interval.endAt.toISOString(),
      });
    }
  }

  const deduplicated = Array.from(new Map(conflicts.map((item) => [`${item.source}-${item.id}-${item.startAt}-${item.endAt}`, item])).values());
  return deduplicated.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export function plannerDraftInterval(input: {
  startAt?: Date | null;
  dueAt?: Date | null;
  plannedFor?: Date | null;
}) {
  return plannerInterval({
    startAt: input.startAt ?? null,
    dueAt: input.dueAt ?? null,
    plannedFor: input.plannedFor ?? null,
  });
}

export function eventDraftInterval(input: { startAt: Date; endAt?: Date | null }) {
  return eventInterval({ startAt: input.startAt, endAt: input.endAt ?? null });
}

export function examDraftInterval(input: { examDate: Date; durationMinutes?: number | null }) {
  return examInterval({ examDate: input.examDate, durationMinutes: input.durationMinutes ?? null });
}
