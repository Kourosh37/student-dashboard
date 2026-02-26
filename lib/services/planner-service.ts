import type { PlannerCadence, PlannerPriority, PlannerStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export async function listPlannerItems(
  userId: string,
  options: {
    status?: PlannerStatus;
    priority?: PlannerPriority;
    cadence?: PlannerCadence;
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
    ...(options.cadence ? { cadence: options.cadence } : {}),
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
      orderBy: [{ isPinned: "desc" }, { dueAt: "asc" }, { plannedFor: "asc" }, { createdAt: "desc" }],
      take: options.limit,
      skip: options.offset,
    }),
    prisma.plannerItem.count({ where }),
  ]);

  return { items, total };
}

export async function createPlannerItem(
  userId: string,
  data: {
    title: string;
    description?: string | null;
    status: PlannerStatus;
    priority: PlannerPriority;
    cadence: PlannerCadence;
    plannedFor?: Date | null;
    startAt?: Date | null;
    dueAt?: Date | null;
    isPinned: boolean;
  },
) {
  return prisma.plannerItem.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      cadence: data.cadence,
      plannedFor: data.plannedFor,
      startAt: data.startAt,
      dueAt: data.dueAt,
      isPinned: data.isPinned,
    },
  });
}

export async function updatePlannerItem(
  userId: string,
  plannerId: string,
  data: {
    title?: string;
    description?: string | null;
    status?: PlannerStatus;
    priority?: PlannerPriority;
    cadence?: PlannerCadence;
    plannedFor?: Date | null;
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
  });
}

export async function getPlannerItemById(userId: string, plannerId: string) {
  return prisma.plannerItem.findFirst({
    where: { id: plannerId, userId },
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

