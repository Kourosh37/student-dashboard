import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/http";

export async function ensureSemesterOwnership(userId: string, semesterId: string) {
  const semester = await prisma.semester.findFirst({
    where: { id: semesterId, userId },
    select: { id: true },
  });

  if (!semester) {
    throw new ApiError("Semester not found", 404, "SEMESTER_NOT_FOUND");
  }
}

export async function ensureCourseOwnership(userId: string, courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, userId },
    select: { id: true, semesterId: true },
  });

  if (!course) {
    throw new ApiError("Course not found", 404, "COURSE_NOT_FOUND");
  }

  return course;
}

export async function ensurePlannerOwnership(userId: string, plannerItemId: string) {
  const item = await prisma.plannerItem.findFirst({
    where: { id: plannerItemId, userId },
    select: { id: true },
  });

  if (!item) {
    throw new ApiError("Planner item not found", 404, "PLANNER_ITEM_NOT_FOUND");
  }
}

export async function ensureFolderOwnership(userId: string, folderId: string) {
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, userId },
    select: { id: true },
  });

  if (!folder) {
    throw new ApiError("Folder not found", 404, "FOLDER_NOT_FOUND");
  }
}

