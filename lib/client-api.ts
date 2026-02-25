import type { ApiFailure, ApiResponse, ApiValidationDetails, ApiValidationIssue } from "@/types/api";

export type FieldErrors = Record<string, string[]>;

export class ApiClientError extends Error {
  status: number;
  code: string;
  details: unknown;
  fieldErrors: FieldErrors;
  issues: ApiValidationIssue[];

  constructor(params: {
    message: string;
    status: number;
    code: string;
    details?: unknown;
    fieldErrors?: FieldErrors;
    issues?: ApiValidationIssue[];
  }) {
    super(params.message);
    this.name = "ApiClientError";
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
    this.fieldErrors = params.fieldErrors ?? {};
    this.issues = params.issues ?? [];
  }
}

function defaultMessageByStatus(status: number) {
  if (status === 401) return "Your session expired. Please sign in again.";
  if (status === 403) return "You do not have permission for this action.";
  if (status === 404) return "The requested resource was not found.";
  if (status === 429) return "Too many requests. Please try again shortly.";
  if (status >= 500) return "Server error. Please try again in a moment.";
  return "Request failed.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseValidationDetails(details: unknown) {
  let fieldErrors: FieldErrors = {};
  let issues: ApiValidationIssue[] = [];

  if (Array.isArray(details)) {
    issues = details as ApiValidationIssue[];
  } else if (isRecord(details)) {
    const typed = details as ApiValidationDetails;
    issues = Array.isArray(typed.issues) ? typed.issues : [];
    fieldErrors =
      typed.fieldErrors && isRecord(typed.fieldErrors)
        ? (typed.fieldErrors as FieldErrors)
        : {};
  }

  if (Object.keys(fieldErrors).length === 0 && issues.length > 0) {
    fieldErrors = issues.reduce<FieldErrors>((acc, issue) => {
      const key = issue.path?.length ? issue.path.join(".") : "form";
      if (!acc[key]) acc[key] = [];
      if (issue.message) acc[key].push(issue.message);
      return acc;
    }, {});
  }

  return { fieldErrors, issues };
}

function buildApiClientError(payload: unknown, status: number) {
  const fallback = defaultMessageByStatus(status);

  if (isRecord(payload) && "success" in payload && payload.success === false && "error" in payload) {
    const error = (payload as ApiFailure).error;
    const message = error.message || fallback;
    const code = error.code || "REQUEST_FAILED";
    const parsed = parseValidationDetails(error.details);

    return new ApiClientError({
      message,
      status,
      code,
      details: error.details,
      fieldErrors: parsed.fieldErrors,
      issues: parsed.issues,
    });
  }

  return new ApiClientError({
    message: fallback,
    status,
    code: "REQUEST_FAILED",
  });
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text || null;
}

function createRequestHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    credentials: "same-origin",
    headers: createRequestHeaders(init),
  });

  const payload = (await readResponsePayload(response)) as ApiResponse<T> | unknown;
  if (!response.ok) {
    throw buildApiClientError(payload, response.status);
  }

  if (!isRecord(payload) || !("success" in payload)) {
    throw new ApiClientError({
      message: "Unexpected response shape from server.",
      status: response.status,
      code: "INVALID_RESPONSE",
    });
  }

  if ((payload as ApiResponse<T>).success === false) {
    throw buildApiClientError(payload, response.status);
  }

  return (payload as ApiResponse<T> & { success: true }).data;
}

export async function apiFetchForm<T>(input: RequestInfo | URL, formData: FormData, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    credentials: "same-origin",
    method: init?.method ?? "POST",
    body: formData,
  });

  const payload = (await readResponsePayload(response)) as ApiResponse<T> | unknown;
  if (!response.ok) {
    throw buildApiClientError(payload, response.status);
  }

  if (!isRecord(payload) || !("success" in payload)) {
    throw new ApiClientError({
      message: "Unexpected response shape from server.",
      status: response.status,
      code: "INVALID_RESPONSE",
    });
  }

  if ((payload as ApiResponse<T>).success === false) {
    throw buildApiClientError(payload, response.status);
  }

  return (payload as ApiResponse<T> & { success: true }).data;
}

export function parseClientError(error: unknown) {
  if (error instanceof ApiClientError) {
    return {
      message: error.message,
      code: error.code,
      status: error.status,
      fieldErrors: error.fieldErrors,
      issues: error.issues,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: "UNKNOWN_ERROR",
      status: 0,
      fieldErrors: {} as FieldErrors,
      issues: [] as ApiValidationIssue[],
    };
  }

  return {
    message: "Unexpected error occurred.",
    code: "UNKNOWN_ERROR",
    status: 0,
    fieldErrors: {} as FieldErrors,
    issues: [] as ApiValidationIssue[],
  };
}
