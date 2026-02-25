import { z } from "zod";

import { queryLimitSchema, queryOffsetSchema } from "@/lib/validators/pagination";

export const listFilesQuerySchema = z.object({
  folderId: z.string().cuid().optional(),
  semesterId: z.string().cuid().optional(),
  courseId: z.string().cuid().optional(),
  plannerItemId: z.string().cuid().optional(),
  pinned: z.coerce.boolean().optional(),
  q: z.string().trim().max(120).optional(),
  mimeGroup: z.enum(["image", "video", "audio", "pdf", "document", "other"]).optional(),
  limit: queryLimitSchema,
  offset: queryOffsetSchema,
});

export const uploadFileMetaSchema = z.object({
  folderId: z
    .union([z.string().cuid(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  semesterId: z
    .union([z.string().cuid(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  courseId: z
    .union([z.string().cuid(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  plannerItemId: z
    .union([z.string().cuid(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  isPinned: z
    .union([z.literal("true"), z.literal("false"), z.boolean(), z.null()])
    .optional()
    .transform((value) => value === true || value === "true"),
  tags: z
    .union([z.string().trim().max(300), z.null()])
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const updateFileSchema = z.object({
  originalName: z.string().trim().min(1).max(180).optional(),
  folderId: z.string().cuid().optional().nullable(),
  semesterId: z.string().cuid().optional().nullable(),
  courseId: z.string().cuid().optional().nullable(),
  plannerItemId: z.string().cuid().optional().nullable(),
  isPinned: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});
