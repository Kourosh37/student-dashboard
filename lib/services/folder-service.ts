import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export async function listFolders(
  userId: string,
  options: {
    parentId?: string;
    q?: string;
    pinned?: boolean;
  },
) {
  const where: Prisma.FolderWhereInput = {
    userId,
    ...(options.parentId ? { parentId: options.parentId } : {}),
    ...(options.pinned !== undefined ? { isPinned: options.pinned } : {}),
    ...(options.q ? { name: { contains: options.q, mode: "insensitive" } } : {}),
  };

  return prisma.folder.findMany({
    where,
    orderBy: [{ isPinned: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          files: true,
          children: true,
        },
      },
    },
  });
}

export async function createFolder(
  userId: string,
  data: {
    parentId?: string | null;
    name: string;
    color?: string | null;
    isPinned: boolean;
  },
) {
  return prisma.folder.create({
    data: {
      userId,
      parentId: data.parentId,
      name: data.name,
      color: data.color,
      isPinned: data.isPinned,
    },
    include: {
      _count: {
        select: {
          files: true,
          children: true,
        },
      },
    },
  });
}

export async function updateFolder(
  userId: string,
  folderId: string,
  data: {
    parentId?: string | null;
    name?: string;
    color?: string | null;
    isPinned?: boolean;
  },
) {
  const updated = await prisma.folder.updateMany({
    where: { id: folderId, userId },
    data,
  });
  if (updated.count === 0) return null;

  return prisma.folder.findUnique({
    where: { id: folderId },
    include: {
      _count: {
        select: {
          files: true,
          children: true,
        },
      },
    },
  });
}

export async function deleteFolder(userId: string, folderId: string) {
  const deleted = await prisma.folder.deleteMany({
    where: { id: folderId, userId },
  });
  return deleted.count > 0;
}
