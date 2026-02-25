import { z } from "zod";

export const listFoldersQuerySchema = z.object({
  parentId: z.string().cuid().optional(),
  q: z.string().trim().max(120).optional(),
  pinned: z.coerce.boolean().optional(),
});

export const createFolderSchema = z.object({
  parentId: z.string().cuid().optional().nullable(),
  name: z.string().trim().min(1, "Folder name is required").max(120, "Folder name is too long"),
  color: z.string().trim().max(20).optional().nullable(),
  isPinned: z.boolean().optional().default(false),
});

export const updateFolderSchema = createFolderSchema.partial();
