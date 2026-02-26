import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export async function listEvents(
  userId: string,
  options: {
    q?: string;
    from?: Date;
    to?: Date;
    pinned?: boolean;
    limit: number;
    offset: number;
  },
) {
  const where: Prisma.StudentEventWhereInput = {
    userId,
    ...(options.pinned !== undefined ? { isPinned: options.pinned } : {}),
    ...(options.q
      ? {
          OR: [
            { title: { contains: options.q, mode: "insensitive" } },
            { description: { contains: options.q, mode: "insensitive" } },
            { location: { contains: options.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(options.from || options.to
      ? {
          startAt: {
            ...(options.from ? { gte: options.from } : {}),
            ...(options.to ? { lte: options.to } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.studentEvent.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { startAt: "asc" }, { createdAt: "desc" }],
      take: options.limit,
      skip: options.offset,
    }),
    prisma.studentEvent.count({ where }),
  ]);

  return { items, total };
}

export async function createEvent(
  userId: string,
  input: {
    title: string;
    description?: string | null;
    location?: string | null;
    startAt: Date;
    endAt?: Date | null;
    isPinned: boolean;
  },
) {
  return prisma.studentEvent.create({
    data: {
      userId,
      title: input.title,
      description: input.description,
      location: input.location,
      startAt: input.startAt,
      endAt: input.endAt,
      isPinned: input.isPinned,
    },
  });
}

export async function getEventById(userId: string, eventId: string) {
  return prisma.studentEvent.findFirst({
    where: { id: eventId, userId },
  });
}

export async function updateEvent(
  userId: string,
  eventId: string,
  input: {
    title?: string;
    description?: string | null;
    location?: string | null;
    startAt?: Date;
    endAt?: Date | null;
    isPinned?: boolean;
  },
) {
  const existing = await prisma.studentEvent.findFirst({
    where: { id: eventId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.studentEvent.update({
    where: { id: eventId },
    data: input,
  });
}

export async function deleteEvent(userId: string, eventId: string) {
  const deleted = await prisma.studentEvent.deleteMany({
    where: { id: eventId, userId },
  });
  return deleted.count > 0;
}
