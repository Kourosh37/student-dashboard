import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { ApiError } from "@/lib/http";

const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function sanitizeFileName(name: string) {
  const cleaned = name.replace(/[^\w.\-]/g, "_");
  return cleaned.length > 120 ? cleaned.slice(-120) : cleaned;
}

export async function storeFile(file: File) {
  if (file.size <= 0) {
    throw new ApiError("Empty files are not allowed", 400, "EMPTY_FILE");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new ApiError("File is too large (max 100MB)", 400, "FILE_TOO_LARGE");
  }

  await ensureUploadDir();

  const safeName = sanitizeFileName(file.name);
  const storageName = `${Date.now()}-${randomUUID()}-${safeName}`;
  const absolutePath = path.join(UPLOAD_DIR, storageName);
  const data = Buffer.from(await file.arrayBuffer());

  await fs.writeFile(absolutePath, data);

  return {
    originalName: safeName,
    storageName,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}

export async function deleteStoredFile(storageName: string) {
  const absolutePath = path.join(UPLOAD_DIR, storageName);
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export function getStoredFilePath(storageName: string) {
  return path.join(UPLOAD_DIR, storageName);
}
