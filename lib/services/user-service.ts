import { prisma } from "@/lib/db/prisma";

const AVATAR_ASSET_PREFIX = "asset:";

function toAvatarPublicUrl(avatarUrl: string | null, updatedAt: Date) {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith(AVATAR_ASSET_PREFIX)) {
    return `/api/v1/profile/avatar?v=${updatedAt.getTime()}`;
  }
  return avatarUrl;
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return null;

  const { updatedAt, ...rest } = user;
  return {
    ...rest,
    avatarUrl: toAvatarPublicUrl(user.avatarUrl, updatedAt),
  };
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}) {
  return prisma.user.create({
    data: input,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });
}

