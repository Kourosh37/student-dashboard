import { prisma } from "@/lib/db/prisma";

export async function listSemesters(userId: string, options: { q?: string; pinned?: boolean }) {
  return prisma.semester.findMany({
    where: {
      userId,
      ...(options.pinned !== undefined ? { isPinned: options.pinned } : {}),
      ...(options.q
        ? {
            OR: [
              { title: { contains: options.q, mode: "insensitive" } },
              { code: { contains: options.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    include: {
      _count: {
        select: {
          courses: true,
          exams: true,
        },
      },
    },
  });
}

export async function createSemester(
  userId: string,
  data: {
    title: string;
    code?: string | null;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
    isPinned: boolean;
  },
) {
  return prisma.$transaction(async (tx) => {
    if (data.isCurrent) {
      await tx.semester.updateMany({
        where: { userId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return tx.semester.create({
      data: {
        userId,
        ...data,
      },
      include: {
        _count: {
          select: {
            courses: true,
            exams: true,
          },
        },
      },
    });
  });
}

export async function updateSemester(
  userId: string,
  semesterId: string,
  data: {
    title?: string;
    code?: string | null;
    startDate?: Date;
    endDate?: Date;
    isCurrent?: boolean;
    isPinned?: boolean;
  },
) {
  return prisma.$transaction(async (tx) => {
    if (data.isCurrent) {
      await tx.semester.updateMany({
        where: { userId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    const updated = await tx.semester.updateMany({
      where: { id: semesterId, userId },
      data,
    });

    if (updated.count === 0) return null;

    return tx.semester.findUnique({
      where: { id: semesterId },
      include: {
        _count: {
          select: {
            courses: true,
            exams: true,
          },
        },
      },
    });
  });
}

export async function deleteSemester(userId: string, semesterId: string) {
  const deleted = await prisma.semester.deleteMany({
    where: { id: semesterId, userId },
  });
  return deleted.count > 0;
}

