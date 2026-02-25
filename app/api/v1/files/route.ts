import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, fail, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { assertLinkedEntitiesExist, listFiles, uploadFile } from "@/lib/services/file-service";
import { ensureFolderOwnership, ensurePlannerOwnership } from "@/lib/services/ownership";
import { listFilesQuerySchema, uploadFileMetaSchema } from "@/lib/validators/file";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = listFilesQuerySchema.safeParse(query);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const result = await listFiles(session.userId, parsed.data);
    return ok(result);
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
      return fail("File is required", 400, "FILE_REQUIRED");
    }

    const asValue = (key: string) => {
      const value = formData.get(key);
      return value === null ? undefined : value;
    };

    const parsedMeta = uploadFileMetaSchema.safeParse({
      folderId: asValue("folderId"),
      semesterId: asValue("semesterId"),
      courseId: asValue("courseId"),
      plannerItemId: asValue("plannerItemId"),
      isPinned: asValue("isPinned"),
      tags: asValue("tags"),
    });
    if (!parsedMeta.success) {
      return validationFail(parsedMeta.error.issues);
    }

    if (parsedMeta.data.folderId) {
      await ensureFolderOwnership(session.userId, parsedMeta.data.folderId);
    }
    if (parsedMeta.data.plannerItemId) {
      await ensurePlannerOwnership(session.userId, parsedMeta.data.plannerItemId);
    }
    await assertLinkedEntitiesExist(session.userId, {
      semesterId: parsedMeta.data.semesterId,
      courseId: parsedMeta.data.courseId,
    });

    const uploaded = await uploadFile(session.userId, {
      file: maybeFile,
      ...parsedMeta.data,
    });
    publishUserEvent(session.userId, "file.created", { fileId: uploaded.id });

    return ok(uploaded, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
