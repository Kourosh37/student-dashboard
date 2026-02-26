import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

const AVATAR_ASSET_PREFIX = "asset:";

const profileSelect = {
  id: true,
  name: true,
  email: true,
  studentId: true,
  university: true,
  major: true,
  currentTerm: true,
  bio: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type ProfileRecord = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

function extractAvatarAssetId(avatarUrl: string | null | undefined) {
  if (!avatarUrl || !avatarUrl.startsWith(AVATAR_ASSET_PREFIX)) return null;
  const fileId = avatarUrl.slice(AVATAR_ASSET_PREFIX.length);
  return fileId.length > 0 ? fileId : null;
}

function toAvatarPublicUrl(avatarUrl: string | null, updatedAt: Date) {
  const assetId = extractAvatarAssetId(avatarUrl);
  if (assetId) {
    return `/api/v1/profile/avatar?v=${updatedAt.getTime()}`;
  }
  return avatarUrl;
}

function mapProfile(record: ProfileRecord) {
  return {
    ...record,
    avatarUrl: toAvatarPublicUrl(record.avatarUrl, record.updatedAt),
  };
}

export async function getProfile(userId: string) {
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: profileSelect,
  });

  return profile ? mapProfile(profile) : null;
}

export async function updateProfile(
  userId: string,
  data: {
    name?: string;
    studentId?: string | null;
    university?: string | null;
    major?: string | null;
    currentTerm?: string | null;
    bio?: string | null;
  },
) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: profileSelect,
  });

  return mapProfile(updated);
}

export async function getAvatarAssetId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  return extractAvatarAssetId(user?.avatarUrl);
}

export async function setAvatarAssetId(userId: string, assetId: string | null) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      avatarUrl: assetId ? `${AVATAR_ASSET_PREFIX}${assetId}` : null,
    },
    select: profileSelect,
  });
}

export async function getAvatarFile(userId: string) {
  const avatarAssetId = await getAvatarAssetId(userId);
  if (!avatarAssetId) {
    return null;
  }

  return prisma.fileAsset.findFirst({
    where: {
      id: avatarAssetId,
      uploadedById: userId,
    },
  });
}

