import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, fail, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { deleteFolder, updateFolder } from "@/lib/services/folder-service";
import { ensureFolderOwnership } from "@/lib/services/ownership";
import { updateFolderSchema } from "@/lib/validators/folder";

type Context = {
  params: Promise<{ folderId: string }>;
};

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { folderId } = await context.params;
    const body = await request.json();
    const parsed = updateFolderSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    if (parsed.data.parentId) {
      await ensureFolderOwnership(session.userId, parsed.data.parentId);
    }

    const updated = await updateFolder(session.userId, folderId, parsed.data);
    if (!updated) {
      return fail("Folder not found", 404, "FOLDER_NOT_FOUND");
    }
    publishUserEvent(session.userId, "folder.updated", { folderId: updated.id });
    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { folderId } = await context.params;
    const deleted = await deleteFolder(session.userId, folderId);
    if (!deleted) {
      return fail("Folder not found", 404, "FOLDER_NOT_FOUND");
    }
    publishUserEvent(session.userId, "folder.deleted", { folderId });
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
