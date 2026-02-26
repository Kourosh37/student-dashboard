import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/http";
import { deleteStoredFile, storeFile } from "@/lib/storage";
import {
  ensureCourseOwnership,
  ensureFolderOwnership,
  ensurePlannerOwnership,
  ensureSemesterOwnership,
} from "@/lib/services/ownership";

function normalizeTags(tagsRaw?: string | null) {
  if (!tagsRaw) return [] as string[];
  return tagsRaw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function mimeGroupToFilter(group: string) {
  if (group === "image") return { startsWith: "image/" };
  if (group === "video") return { startsWith: "video/" };
  if (group === "audio") return { startsWith: "audio/" };
  if (group === "pdf") return { equals: "application/pdf" };
  if (group === "document") {
    return {
      in: [
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
      ],
    };
  }
  return undefined;
}

export async function listFiles(
  userId: string,
  options: {
    folderId?: string;
    semesterId?: string;
    courseId?: string;
    plannerItemId?: string;
    pinned?: boolean;
    q?: string;
    mimeGroup?: "image" | "video" | "audio" | "pdf" | "document" | "other";
    limit: number;
    offset: number;
  },
) {
  const mimeFilter = options.mimeGroup ? mimeGroupToFilter(options.mimeGroup) : undefined;
  const where: Prisma.FileAssetWhereInput = {
    uploadedById: userId,
    ...(options.folderId ? { folderId: options.folderId } : {}),
    ...(options.semesterId ? { semesterId: options.semesterId } : {}),
    ...(options.courseId ? { courseId: options.courseId } : {}),
    ...(options.plannerItemId ? { plannerItemId: options.plannerItemId } : {}),
    ...(options.pinned !== undefined ? { isPinned: options.pinned } : {}),
    ...(options.q
      ? {
          OR: [
            { originalName: { contains: options.q, mode: "insensitive" } },
            { course: { name: { contains: options.q, mode: "insensitive" } } },
            { semester: { title: { contains: options.q, mode: "insensitive" } } },
            { plannerItem: { title: { contains: options.q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(mimeFilter ? { mimeType: mimeFilter } : {}),
  };

  if (options.mimeGroup === "other") {
    where.AND = [
      {
        NOT: {
          mimeType: {
            startsWith: "image/",
          },
        },
      },
      {
        NOT: {
          mimeType: {
            startsWith: "video/",
          },
        },
      },
      {
        NOT: {
          mimeType: {
            startsWith: "audio/",
          },
        },
      },
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.fileAsset.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: options.limit,
      skip: options.offset,
      include: {
        folder: { select: { id: true, name: true } },
        semester: { select: { id: true, title: true } },
        course: { select: { id: true, name: true, code: true } },
        plannerItem: { select: { id: true, title: true } },
      },
    }),
    prisma.fileAsset.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      tags: (item.tags as string[] | null) ?? [],
    })),
    total,
  };
}

export async function uploadFile(
  userId: string,
  input: {
    file: File;
    folderId?: string | null;
    semesterId?: string | null;
    courseId?: string | null;
    plannerItemId?: string | null;
    isPinned: boolean;
    tags?: string | null;
  },
) {
  if (input.folderId) await ensureFolderOwnership(userId, input.folderId);
  if (input.semesterId) await ensureSemesterOwnership(userId, input.semesterId);
  if (input.courseId) await ensureCourseOwnership(userId, input.courseId);
  if (input.plannerItemId) await ensurePlannerOwnership(userId, input.plannerItemId);

  const stored = await storeFile(input.file);
  const tags = normalizeTags(input.tags);

  return prisma.fileAsset.create({
    data: {
      originalName: stored.originalName,
      storageName: stored.storageName,
      mimeType: stored.mimeType,
      size: stored.size,
      uploadedById: userId,
      folderId: input.folderId ?? null,
      semesterId: input.semesterId ?? null,
      courseId: input.courseId ?? null,
      plannerItemId: input.plannerItemId ?? null,
      isPinned: input.isPinned,
      tags,
    },
    include: {
      folder: { select: { id: true, name: true } },
      semester: { select: { id: true, title: true } },
      course: { select: { id: true, name: true, code: true } },
      plannerItem: { select: { id: true, title: true } },
    },
  });
}

export async function updateFileMetadata(
  userId: string,
  fileId: string,
  input: {
    originalName?: string;
    folderId?: string | null;
    semesterId?: string | null;
    courseId?: string | null;
    plannerItemId?: string | null;
    isPinned?: boolean;
    tags?: string[];
  },
) {
  const existing = await prisma.fileAsset.findFirst({
    where: { id: fileId, uploadedById: userId },
    select: { id: true },
  });
  if (!existing) {
    return null;
  }

  if (input.folderId) await ensureFolderOwnership(userId, input.folderId);
  if (input.semesterId) await ensureSemesterOwnership(userId, input.semesterId);
  if (input.courseId) await ensureCourseOwnership(userId, input.courseId);
  if (input.plannerItemId) await ensurePlannerOwnership(userId, input.plannerItemId);

  return prisma.fileAsset.update({
    where: { id: fileId },
    data: {
      originalName: input.originalName,
      folderId: input.folderId,
      semesterId: input.semesterId,
      courseId: input.courseId,
      plannerItemId: input.plannerItemId,
      isPinned: input.isPinned,
      tags: input.tags ?? undefined,
    },
    include: {
      folder: { select: { id: true, name: true } },
      semester: { select: { id: true, title: true } },
      course: { select: { id: true, name: true, code: true } },
      plannerItem: { select: { id: true, title: true } },
    },
  });
}

export async function deleteFile(userId: string, fileId: string) {
  const file = await prisma.fileAsset.findFirst({
    where: {
      id: fileId,
      uploadedById: userId,
    },
  });

  if (!file) {
    return false;
  }

  await prisma.fileAsset.delete({
    where: { id: file.id },
  });
  await deleteStoredFile(file.storageName);

  return true;
}

export async function getFileForDownload(userId: string, fileId: string) {
  return prisma.fileAsset.findFirst({
    where: {
      id: fileId,
      uploadedById: userId,
    },
  });
}

export function getFilePreviewType(mimeType: string) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("text/")) return "text";
  if (mimeType.includes("word") || mimeType.includes("presentation") || mimeType.includes("excel")) {
    return "office";
  }
  return "binary";
}

export async function assertLinkedEntitiesExist(userId: string, input: {
  semesterId?: string | null;
  courseId?: string | null;
}) {
  if (input.semesterId) {
    await ensureSemesterOwnership(userId, input.semesterId);
  }

  if (input.courseId) {
    const course = await ensureCourseOwnership(userId, input.courseId);
    if (input.semesterId && course.semesterId !== input.semesterId) {
      throw new ApiError("Course does not belong to selected semester", 400, "COURSE_SEMESTER_MISMATCH");
    }
  }
}

