import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, fail, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { deleteFile, getFileForDownload, getFilePreviewType, updateFileMetadata } from "@/lib/services/file-service";
import {
  ensureCourseOwnership,
  ensureFolderOwnership,
  ensurePlannerOwnership,
  ensureSemesterOwnership,
} from "@/lib/services/ownership";
import { updateFileSchema } from "@/lib/validators/file";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ fileId: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { fileId } = await context.params;
    const item = await getFileForDownload(session.userId, fileId);
    if (!item) {
      return fail("File not found", 404, "FILE_NOT_FOUND");
    }
    return ok({
      ...item,
      tags: (item.tags as string[] | null) ?? [],
      previewType: getFilePreviewType(item.mimeType),
      downloadUrl: `/api/v1/files/${item.id}/download`,
      previewUrl: `/api/v1/files/${item.id}/preview`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { fileId } = await context.params;
    const body = await request.json();
    const parsed = updateFileSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    if (parsed.data.folderId) await ensureFolderOwnership(session.userId, parsed.data.folderId);
    if (parsed.data.semesterId) await ensureSemesterOwnership(session.userId, parsed.data.semesterId);
    if (parsed.data.courseId) await ensureCourseOwnership(session.userId, parsed.data.courseId);
    if (parsed.data.plannerItemId) await ensurePlannerOwnership(session.userId, parsed.data.plannerItemId);

    const updated = await updateFileMetadata(session.userId, fileId, parsed.data);
    if (!updated) {
      return fail("File not found", 404, "FILE_NOT_FOUND");
    }
    publishUserEvent(session.userId, "file.updated", { fileId: updated.id });
    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { fileId } = await context.params;
    const deleted = await deleteFile(session.userId, fileId);
    if (!deleted) {
      return fail("File not found", 404, "FILE_NOT_FOUND");
    }
    publishUserEvent(session.userId, "file.deleted", { fileId });
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
