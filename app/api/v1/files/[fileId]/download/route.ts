import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { buildContentDisposition } from "@/lib/content-disposition";
import { ApiError, fail, handleApiError } from "@/lib/http";
import { getFileForDownload } from "@/lib/services/file-service";
import { getStoredFileStats, openStoredFileStream } from "@/lib/storage";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ fileId: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { fileId } = await context.params;
    const file = await getFileForDownload(session.userId, fileId);

    if (!file) {
      return fail("File not found", 404, "FILE_NOT_FOUND");
    }

    let size = 0;
    try {
      const stats = await getStoredFileStats(file.storageName);
      size = stats.size;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ApiError("Stored file is missing", 404, "FILE_STORAGE_MISSING");
      }
      throw error;
    }

    const body = openStoredFileStream(file.storageName);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": String(size),
        "Content-Disposition": buildContentDisposition("attachment", file.originalName),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
