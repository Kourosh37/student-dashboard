import type { Weekday } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type ConflictItem = {
  source: "CLASS" | "PLANNER" | "EVENT" | "EXAM";
  id: string;
  title: string;
  startAt: string;
  endAt: string;
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

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
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
