import type { PlannerStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export async function getCalendarData(
  userId: string,
  input: {
    from: Date;
    to: Date;
    semesterId?: string;
    courseId?: string;
    status?: PlannerStatus;
    q?: string;
  },
) {
  const plannerWhere: Prisma.PlannerItemWhereInput = {
    userId,
    ...(input.semesterId ? { semesterId: input.semesterId } : {}),
    ...(input.courseId ? { courseId: input.courseId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.q
      ? {
          OR: [
            { title: { contains: input.q, mode: "insensitive" } },
            { description: { contains: input.q, mode: "insensitive" } },
          ],
        }
      : {}),
    OR: [
      {
        dueAt: {
          gte: input.from,
          lte: input.to,
        },
      },
      {
        startAt: {
          gte: input.from,
          lte: input.to,
        },
      },
    ],
  };

  const examWhere: Prisma.ExamWhereInput = {
    userId,
    ...(input.semesterId ? { semesterId: input.semesterId } : {}),
    ...(input.courseId ? { courseId: input.courseId } : {}),
    ...(input.q
      ? {
          OR: [
            { title: { contains: input.q, mode: "insensitive" } },
            { location: { contains: input.q, mode: "insensitive" } },
            { notes: { contains: input.q, mode: "insensitive" } },
          ],
        }
      : {}),
    examDate: {
      gte: input.from,
      lte: input.to,
    },
  };

  const scheduleWhere: Prisma.CourseSessionWhereInput = {
    course: {
      userId,
      ...(input.semesterId ? { semesterId: input.semesterId } : {}),
      ...(input.courseId ? { id: input.courseId } : {}),
      ...(input.q
        ? {
            OR: [
              { name: { contains: input.q, mode: "insensitive" } },
              { code: { contains: input.q, mode: "insensitive" } },
              { instructor: { contains: input.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
  };

  const [plannerItems, exams, sessions] = await Promise.all([
    prisma.plannerItem.findMany({
      where: plannerWhere,
      orderBy: [{ dueAt: "asc" }, { startAt: "asc" }, { createdAt: "asc" }],
      include: {
        course: {
          select: { id: true, name: true, code: true, color: true },
        },
        semester: {
          select: { id: true, title: true },
        },
      },
    }),
    prisma.exam.findMany({
      where: examWhere,
      orderBy: [{ examDate: "asc" }],
      include: {
        course: {
          select: { id: true, name: true, code: true, color: true },
        },
        semester: {
          select: { id: true, title: true },
        },
      },
    }),
    prisma.courseSession.findMany({
      where: scheduleWhere,
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
            semester: {
              select: { id: true, title: true },
            },
          },
        },
      },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    }),
  ]);

  return {
    plannerItems,
    exams,
    sessions,
  };
}
