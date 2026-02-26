import type { Prisma, Weekday } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

type SessionInput = {
  id?: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  room?: string | null;
};

export async function listCourses(
  userId: string,
  options: {
    semesterId?: string;
    q?: string;
    pinned?: boolean;
    limit: number;
    offset: number;
  },
) {
  const where: Prisma.CourseWhereInput = {
    userId,
    ...(options.semesterId ? { semesterId: options.semesterId } : {}),
    ...(options.pinned !== undefined ? { isPinned: options.pinned } : {}),
    ...(options.q
      ? {
          OR: [
            { name: { contains: options.q, mode: "insensitive" } },
            { code: { contains: options.q, mode: "insensitive" } },
            { instructor: { contains: options.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.course.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: options.limit,
      skip: options.offset,
      include: {
        semester: {
          select: {
            id: true,
            title: true,
          },
        },
        sessions: {
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        },
        _count: {
          select: {
            files: true,
            exams: true,
          },
        },
      },
    }),
    prisma.course.count({ where }),
  ]);

  return { items, total };
}

export async function getCourseById(userId: string, courseId: string) {
  return prisma.course.findFirst({
    where: { id: courseId, userId },
    include: {
      semester: {
        select: { id: true, title: true },
      },
      sessions: {
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      },
      _count: {
        select: { files: true, exams: true },
      },
    },
  });
}

export async function createCourse(
  userId: string,
  input: {
    semesterId: string;
    name: string;
    code?: string | null;
    instructor?: string | null;
    location?: string | null;
    credits?: number | null;
    color?: string | null;
    isPinned: boolean;
    sessions: SessionInput[];
  },
) {
  return prisma.course.create({
    data: {
      userId,
      semesterId: input.semesterId,
      name: input.name,
      code: input.code,
      instructor: input.instructor,
      location: input.location,
      credits: input.credits,
      color: input.color,
      isPinned: input.isPinned,
      sessions: {
        create: input.sessions.map((session) => ({
          weekday: session.weekday,
          startTime: session.startTime,
          endTime: session.endTime,
          room: session.room,
        })),
      },
    },
    include: {
      semester: {
        select: { id: true, title: true },
      },
      sessions: true,
      _count: {
        select: { files: true, exams: true },
      },
    },
  });
}

export async function updateCourse(
  userId: string,
  courseId: string,
  input: {
    semesterId?: string;
    name?: string;
    code?: string | null;
    instructor?: string | null;
    location?: string | null;
    credits?: number | null;
    color?: string | null;
    isPinned?: boolean;
    sessions?: SessionInput[];
  },
) {
  const existing = await prisma.course.findFirst({
    where: { id: courseId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.$transaction(async (tx) => {
    if (input.sessions) {
      await tx.courseSession.deleteMany({
        where: { courseId },
      });
    }

    await tx.course.update({
      where: { id: courseId },
      data: {
        semesterId: input.semesterId,
        name: input.name,
        code: input.code,
        instructor: input.instructor,
        location: input.location,
        credits: input.credits,
        color: input.color,
        isPinned: input.isPinned,
        ...(input.sessions
          ? {
              sessions: {
                create: input.sessions.map((session) => ({
                  weekday: session.weekday,
                  startTime: session.startTime,
                  endTime: session.endTime,
                  room: session.room,
                })),
              },
            }
          : {}),
      },
    });

    return tx.course.findUnique({
      where: { id: courseId },
      include: {
        semester: {
          select: { id: true, title: true },
        },
        sessions: {
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        },
        _count: {
          select: { files: true, exams: true },
        },
      },
    });
  });
}

export async function deleteCourse(userId: string, courseId: string) {
  const deleted = await prisma.course.deleteMany({
    where: { id: courseId, userId },
  });
  return deleted.count > 0;
}

export async function listSchedule(
  userId: string,
  options: {
    semesterId?: string;
    courseId?: string;
    weekday?: Weekday;
    q?: string;
  },
) {
  const sessions = await prisma.courseSession.findMany({
    where: {
      ...(options.weekday ? { weekday: options.weekday } : {}),
      course: {
        userId,
        ...(options.semesterId ? { semesterId: options.semesterId } : {}),
        ...(options.courseId ? { id: options.courseId } : {}),
        ...(options.q
          ? {
              OR: [
                { name: { contains: options.q, mode: "insensitive" } },
                { code: { contains: options.q, mode: "insensitive" } },
                { instructor: { contains: options.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    include: {
      course: {
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
          semesterId: true,
          semester: {
            select: {
              title: true,
            },
          },
        },
      },
    },
  });

  return sessions.map((session) => ({
    sessionId: session.id,
    weekday: session.weekday,
    startTime: session.startTime,
    endTime: session.endTime,
    room: session.room,
    course: {
      id: session.course.id,
      name: session.course.name,
      code: session.course.code,
      color: session.course.color,
      semesterId: session.course.semesterId,
      semesterTitle: session.course.semester.title,
    },
  }));
}

