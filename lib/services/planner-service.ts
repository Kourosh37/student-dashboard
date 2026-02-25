import type { PlannerPriority, PlannerStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export async function listPlannerItems(
  userId: string,
  options: {
    status?: PlannerStatus;
    priority?: PlannerPriority;
    semesterId?: string;
    courseId?: string;
    pinned?: boolean;
    q?: string;
    limit: number;
    offset: number;
  },
) {
  const where: Prisma.PlannerItemWhereInput = {
    userId,
    ...(options.status ? { status: options.status } : {}),
    ...(options.priority ? { priority: options.priority } : {}),
    ...(options.semesterId ? { semesterId: options.semesterId } : {}),
    ...(options.courseId ? { courseId: options.courseId } : {}),
    ...(options.pinned !== undefined ? { isPinned: options.pinned } : {}),
    ...(options.q
      ? {
          OR: [
            { title: { contains: options.q, mode: "insensitive" } },
            { description: { contains: options.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.plannerItem.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: options.limit,
      skip: options.offset,
      include: {
        semester: {
          select: {
            id: true,
            title: true,
          },
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    }),
    prisma.plannerItem.count({ where }),
  ]);

  return { items, total };
}

export async function createPlannerItem(
  userId: string,
  data: {
    semesterId?: string | null;
    courseId?: string | null;
    title: string;
    description?: string | null;
    status: PlannerStatus;
    priority: PlannerPriority;
    startAt?: Date | null;
    dueAt?: Date | null;
    isPinned: boolean;
  },
) {
  return prisma.plannerItem.create({
    data: {
      userId,
      semesterId: data.semesterId,
      courseId: data.courseId,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      startAt: data.startAt,
      dueAt: data.dueAt,
      isPinned: data.isPinned,
    },
    include: {
      semester: {
        select: { id: true, title: true },
      },
      course: {
        select: { id: true, name: true, code: true },
      },
    },
  });
}

export async function updatePlannerItem(
  userId: string,
  plannerId: string,
  data: {
    semesterId?: string | null;
    courseId?: string | null;
    title?: string;
    description?: string | null;
    status?: PlannerStatus;
    priority?: PlannerPriority;
    startAt?: Date | null;
    dueAt?: Date | null;
    isPinned?: boolean;
  },
) {
  const existing = await prisma.plannerItem.findFirst({
    where: { id: plannerId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.plannerItem.update({
    where: { id: plannerId },
    data,
    include: {
      semester: {
        select: { id: true, title: true },
      },
      course: {
        select: { id: true, name: true, code: true },
      },
    },
  });
}

export async function getPlannerItemById(userId: string, plannerId: string) {
  return prisma.plannerItem.findFirst({
    where: { id: plannerId, userId },
    include: {
      semester: {
        select: { id: true, title: true },
      },
      course: {
        select: { id: true, name: true, code: true },
      },
    },
  });
}

export async function deletePlannerItem(userId: string, plannerId: string) {
  const deleted = await prisma.plannerItem.deleteMany({
    where: { id: plannerId, userId },
  });
  return deleted.count > 0;
}

export async function plannerStats(userId: string) {
  const [total, todo, inProgress, done, archived] = await Promise.all([
    prisma.plannerItem.count({ where: { userId } }),
    prisma.plannerItem.count({ where: { userId, status: "TODO" } }),
    prisma.plannerItem.count({ where: { userId, status: "IN_PROGRESS" } }),
    prisma.plannerItem.count({ where: { userId, status: "DONE" } }),
    prisma.plannerItem.count({ where: { userId, status: "ARCHIVED" } }),
  ]);

  return { total, todo, inProgress, done, archived };
}
