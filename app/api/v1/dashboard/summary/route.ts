import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { handleApiError, ok } from "@/lib/http";
import { plannerStats } from "@/lib/services/planner-service";

function mapAvatarUrl(avatarUrl: string | null | undefined, updatedAt: Date) {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("asset:")) {
    return `/api/v1/profile/avatar?v=${updatedAt.getTime()}`;
  }
  return avatarUrl;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);

    const [profile, semesters, upcomingExams, todaySchedule, recentFiles, planner] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          name: true,
          email: true,
          studentId: true,
          university: true,
          major: true,
          currentTerm: true,
          avatarUrl: true,
          updatedAt: true,
        },
      }),
      prisma.semester.findMany({
        where: { userId: session.userId },
        orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
        include: {
          _count: { select: { courses: true, exams: true } },
        },
      }),
      prisma.exam.findMany({
        where: {
          userId: session.userId,
          examDate: { gte: new Date() },
        },
        orderBy: [{ examDate: "asc" }],
        take: 6,
        include: {
          course: { select: { id: true, name: true, code: true } },
          semester: { select: { id: true, title: true } },
        },
      }),
      prisma.courseSession.findMany({
        where: {
          course: { userId: session.userId },
        },
        include: {
          course: {
            select: {
              id: true,
              name: true,
              code: true,
              color: true,
              semester: {
                select: { title: true },
              },
            },
          },
        },
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        take: 10,
      }),
      prisma.fileAsset.findMany({
        where: { uploadedById: session.userId },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 8,
        include: {
          folder: { select: { id: true, name: true } },
          course: { select: { id: true, name: true, code: true } },
        },
      }),
      plannerStats(session.userId),
    ]);

    return ok({
      profile: profile
        ? {
            ...profile,
            avatarUrl: mapAvatarUrl(profile.avatarUrl, profile.updatedAt),
          }
        : null,
      semesters,
      upcomingExams,
      todaySchedule: todaySchedule.map((sessionItem: (typeof todaySchedule)[number]) => ({
        id: sessionItem.id,
        weekday: sessionItem.weekday,
        startTime: sessionItem.startTime,
        endTime: sessionItem.endTime,
        room: sessionItem.room,
        course: {
          id: sessionItem.course.id,
          name: sessionItem.course.name,
          code: sessionItem.course.code,
          color: sessionItem.course.color,
          semesterTitle: sessionItem.course.semester.title,
        },
      })),
      recentFiles: recentFiles.map((file: (typeof recentFiles)[number]) => ({
        ...file,
        tags: (file.tags as string[] | null) ?? [],
      })),
      planner,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

