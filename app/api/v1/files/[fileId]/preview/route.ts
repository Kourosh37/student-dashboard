import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { ApiError, fail, handleApiError } from "@/lib/http";
import { getFileForDownload, getFilePreviewType } from "@/lib/services/file-service";
import { getStoredFilePath } from "@/lib/storage";

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

    const previewType = getFilePreviewType(file.mimeType);
    if (previewType === "binary") {
      return fail("Preview is not available for this file type", 415, "PREVIEW_NOT_AVAILABLE", {
        mimeType: file.mimeType,
      });
    }

    const absolutePath = getStoredFilePath(file.storageName);
    let data: Buffer;
    try {
      data = await fs.readFile(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ApiError("Stored file is missing", 404, "FILE_STORAGE_MISSING");
      }
      throw error;
    }

    const body = new Uint8Array(data);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": String(body.byteLength),
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
        "X-Preview-Type": previewType,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
