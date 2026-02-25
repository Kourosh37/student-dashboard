import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { ApiError, fail, handleApiError, ok } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { getAvatarAssetId, getAvatarFile, getProfile } from "@/lib/services/profile-service";
import { deleteStoredFile, getStoredFilePath, storeFile } from "@/lib/storage";

export const runtime = "nodejs";

const AVATAR_MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function validateAvatarFile(file: File) {
  if (file.size <= 0) {
    throw new ApiError("Avatar image is empty", 400, "EMPTY_FILE");
  }

  if (file.size > AVATAR_MAX_SIZE) {
    throw new ApiError("Avatar image is too large (max 5MB)", 400, "AVATAR_TOO_LARGE");
  }

  if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
    throw new ApiError("Unsupported avatar image type", 400, "UNSUPPORTED_AVATAR_TYPE", {
      allowedMimeTypes: Array.from(ALLOWED_AVATAR_MIME_TYPES),
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const avatar = await getAvatarFile(session.userId);

    if (!avatar) {
      return fail("Avatar not found", 404, "AVATAR_NOT_FOUND");
    }

    const absolutePath = getStoredFilePath(avatar.storageName);
    let data: Buffer;
    try {
      data = await fs.readFile(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return fail("Stored avatar file is missing", 404, "AVATAR_FILE_MISSING");
      }
      throw error;
    }

    const body = new Uint8Array(data);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": avatar.mimeType || "application/octet-stream",
        "Content-Length": String(body.byteLength),
        "Content-Disposition": `inline; filename="${encodeURIComponent(avatar.originalName)}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const formData = await request.formData();
    const maybeFile = formData.get("file");
    if (!(maybeFile instanceof File)) {
      return fail("Avatar image is required", 400, "FILE_REQUIRED");
    }

    validateAvatarFile(maybeFile);

    const stored = await storeFile(maybeFile);
    const existingAvatarAssetId = await getAvatarAssetId(session.userId);

    try {
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created = await tx.fileAsset.create({
          data: {
            originalName: stored.originalName,
            storageName: stored.storageName,
            mimeType: stored.mimeType,
            size: stored.size,
            uploadedById: session.userId,
            isPinned: false,
            tags: ["profile", "avatar"],
          },
        });

        let previousStorageName: string | null = null;

        if (existingAvatarAssetId) {
          const previousAvatar = await tx.fileAsset.findFirst({
            where: {
              id: existingAvatarAssetId,
              uploadedById: session.userId,
            },
            select: {
              id: true,
              storageName: true,
            },
          });

          if (previousAvatar) {
            previousStorageName = previousAvatar.storageName;
            await tx.fileAsset.delete({
              where: {
                id: previousAvatar.id,
              },
            });
          }
        }

        await tx.user.update({
          where: { id: session.userId },
          data: { avatarUrl: `asset:${created.id}` },
        });

        return { previousStorageName };
      });

      if (result.previousStorageName) {
        try {
          await deleteStoredFile(result.previousStorageName);
        } catch (error) {
          console.error("Failed to remove previous avatar file from storage", error);
        }
      }
    } catch (error) {
      await deleteStoredFile(stored.storageName);
      throw error;
    }

    const profile = await getProfile(session.userId);
    if (!profile) {
      return fail("Profile not found", 404, "PROFILE_NOT_FOUND");
    }

    publishUserEvent(session.userId, "profile.updated", {
      profileId: profile.id,
      avatarUpdated: true,
    });

    return ok(profile);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const existingAvatarAssetId = await getAvatarAssetId(session.userId);

    let storageNameToDelete: string | null = null;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: session.userId },
        data: { avatarUrl: null },
      });

      if (!existingAvatarAssetId) {
        return;
      }

      const existingAvatar = await tx.fileAsset.findFirst({
        where: {
          id: existingAvatarAssetId,
          uploadedById: session.userId,
        },
        select: {
          id: true,
          storageName: true,
        },
      });

      if (!existingAvatar) {
        return;
      }

      storageNameToDelete = existingAvatar.storageName;
      await tx.fileAsset.delete({
        where: {
          id: existingAvatar.id,
        },
      });
    });

    if (storageNameToDelete) {
      try {
        await deleteStoredFile(storageNameToDelete);
      } catch (error) {
        console.error("Failed to remove avatar file from storage", error);
      }
    }

    const profile = await getProfile(session.userId);
    if (!profile) {
      return fail("Profile not found", 404, "PROFILE_NOT_FOUND");
    }

    publishUserEvent(session.userId, "profile.updated", {
      profileId: profile.id,
      avatarUpdated: true,
    });

    return ok(profile);
  } catch (error) {
    return handleApiError(error);
  }
}
