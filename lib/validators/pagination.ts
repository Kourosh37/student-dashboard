import { z } from "zod";

const MAX_LIMIT = 200;

export const queryLimitSchema = z
  .coerce.number()
  .int()
  .min(1)
  .default(50)
  .transform((value) => Math.min(value, MAX_LIMIT));

export const queryOffsetSchema = z.coerce.number().int().min(0).default(0);
