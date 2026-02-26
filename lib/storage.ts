import { randomUUID } from "crypto";
import { createReadStream, createWriteStream, promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

import { ApiError } from "@/lib/http";

const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");
const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function sanitizeOriginalName(name: string) {
  const normalized = name.normalize("NFC").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!normalized) return "file";
  return normalized.length > 180 ? normalized.slice(0, 180) : normalized;
}

function toStorageSafeName(name: string) {
  const ext = path.extname(name).slice(0, 20);
  const base = path.basename(name, ext);
  const safeBase = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);
  const safeExt = ext
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.]+/g, "")
    .slice(0, 20);

  return `${safeBase || "file"}${safeExt}`;
}

export async function storeFile(file: File) {
  if (file.size <= 0) {
    throw new ApiError("Empty files are not allowed", 400, "EMPTY_FILE");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new ApiError("File is too large (max 1GB)", 400, "FILE_TOO_LARGE");
  }

  await ensureUploadDir();

  const originalName = sanitizeOriginalName(file.name);
  const safeStorageTail = toStorageSafeName(originalName);
  const storageName = `${Date.now()}-${randomUUID()}-${safeStorageTail}`;
  const absolutePath = path.join(UPLOAD_DIR, storageName);

  const source = Readable.fromWeb(file.stream() as any);
  const target = createWriteStream(absolutePath, { flags: "wx" });

  try {
    await pipeline(source, target);
  } catch (error) {
    try {
      await fs.unlink(absolutePath);
    } catch (unlinkError) {
      if ((unlinkError as NodeJS.ErrnoException).code !== "ENOENT") {
        throw unlinkError;
      }
    }
    throw error;
  }

  return {
    originalName,
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

export async function getStoredFileStats(storageName: string) {
  const absolutePath = path.join(UPLOAD_DIR, storageName);
  return fs.stat(absolutePath);
}

export function openStoredFileStream(storageName: string) {
  const absolutePath = path.join(UPLOAD_DIR, storageName);
  return Readable.toWeb(createReadStream(absolutePath)) as unknown as ReadableStream<Uint8Array>;
}

export function getStoredFilePath(storageName: string) {
  return path.join(UPLOAD_DIR, storageName);
}
