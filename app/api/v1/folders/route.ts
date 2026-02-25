import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { createFolder, listFolders } from "@/lib/services/folder-service";
import { ensureFolderOwnership } from "@/lib/services/ownership";
import { createFolderSchema, listFoldersQuerySchema } from "@/lib/validators/folder";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = listFoldersQuerySchema.safeParse(query);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const items = await listFolders(session.userId, parsed.data);
    return ok(items);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = createFolderSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    if (parsed.data.parentId) {
      await ensureFolderOwnership(session.userId, parsed.data.parentId);
    }

    const created = await createFolder(session.userId, parsed.data);
    publishUserEvent(session.userId, "folder.created", { folderId: created.id });
    return ok(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
