import { NextResponse } from "next/server";
import type { ZodIssue } from "zod";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 400, code = "BAD_REQUEST", details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    init,
  );
}

export function fail(
  message: string,
  status = 400,
  code = "BAD_REQUEST",
  details?: unknown,
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status },
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.message, error.status, error.code, error.details);
  }

  console.error(error);
  return fail("خطای غیرمنتظره در سرور رخ داده است.", 500, "INTERNAL_SERVER_ERROR");
}

export function validationFail(issues: ZodIssue[]) {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "form";
    if (!fieldErrors[key]) {
      fieldErrors[key] = [];
    }
    fieldErrors[key].push(issue.message);
  }

  const firstMessage = issues[0]?.message ?? "اعتبارسنجی داده ها ناموفق بود.";
  return fail(firstMessage, 400, "VALIDATION_ERROR", {
    issues,
    fieldErrors,
  });
}
