import type { ExamStatus, ExamType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export async function listExams(
  userId: string,
  options: {
    semesterId?: string;
    courseId?: string;
    status?: ExamStatus;
    examType?: ExamType;
    q?: string;
    limit: number;
    offset: number;
  },
) {
  const where: Prisma.ExamWhereInput = {
    userId,
    ...(options.semesterId ? { semesterId: options.semesterId } : {}),
    ...(options.courseId ? { courseId: options.courseId } : {}),
    ...(options.status ? { status: options.status } : {}),
    ...(options.examType ? { examType: options.examType } : {}),
    ...(options.q
      ? {
          OR: [
            { title: { contains: options.q, mode: "insensitive" } },
            { location: { contains: options.q, mode: "insensitive" } },
            { notes: { contains: options.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.exam.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { examDate: "asc" }, { createdAt: "desc" }],
      take: options.limit,
      skip: options.offset,
      include: {
        semester: {
          select: { id: true, title: true },
        },
        course: {
          select: { id: true, name: true, code: true },
        },
      },
    }),
    prisma.exam.count({ where }),
  ]);

  return { items, total };
}

export async function createExam(
  userId: string,
  data: {
    semesterId?: string | null;
    courseId?: string | null;
    title: string;
    examType: ExamType;
    status: ExamStatus;
    examDate: Date;
    startTime?: string | null;
    durationMinutes?: number | null;
    location?: string | null;
    notes?: string | null;
    isPinned: boolean;
  },
) {
  return prisma.exam.create({
    data: {
      userId,
      ...data,
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

export async function getExamById(userId: string, examId: string) {
  return prisma.exam.findFirst({
    where: { id: examId, userId },
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

export async function updateExam(
  userId: string,
  examId: string,
  data: {
    semesterId?: string | null;
    courseId?: string | null;
    title?: string;
    examType?: ExamType;
    status?: ExamStatus;
    examDate?: Date;
    startTime?: string | null;
    durationMinutes?: number | null;
    location?: string | null;
    notes?: string | null;
    isPinned?: boolean;
  },
) {
  const existing = await prisma.exam.findFirst({
    where: { id: examId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.exam.update({
    where: { id: examId },
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

export async function deleteExam(userId: string, examId: string) {
  const deleted = await prisma.exam.deleteMany({
    where: { id: examId, userId },
  });
  return deleted.count > 0;
}

