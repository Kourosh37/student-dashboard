import { parseClientError } from "@/lib/client-api";

export type PanelError = {
  message: string;
  code: string;
  details: string[];
  fieldErrors: Record<string, string[]>;
  status: number;
};

export function toPanelError(error: unknown, fallback: string): PanelError {
  const parsed = parseClientError(error);
  return {
    message: parsed.message || fallback,
    code: parsed.code,
    details: parsed.issues.map((issue) => issue.message).filter(Boolean) as string[],
    fieldErrors: parsed.fieldErrors,
    status: parsed.status,
  };
}

export function fieldError(fieldErrors: Record<string, string[]>, field: string) {
  return fieldErrors[field]?.[0] ?? "";
}

