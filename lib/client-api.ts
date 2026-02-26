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

const messageMap: Record<string, string> = {
  "Unexpected server error": "خطای غیرمنتظره در سرور رخ داده است.",
  "Validation failed": "اعتبارسنجی داده ها ناموفق بود.",
  "Request failed.": "درخواست ناموفق بود.",
  "File is required": "فایل الزامی است.",
  "Select a file first.": "ابتدا یک فایل انتخاب کنید.",
  "File not found": "فایل پیدا نشد.",
  "Folder not found": "پوشه پیدا نشد.",
  "Profile not found": "پروفایل پیدا نشد.",
  "Semester not found": "ترم پیدا نشد.",
  "Course not found": "درس پیدا نشد.",
  "Exam not found": "امتحان پیدا نشد.",
  "Planner item not found": "آیتم برنامه ریزی پیدا نشد.",
  "User not found": "کاربر پیدا نشد.",
  Unauthorized: "ابتدا وارد حساب کاربری شوید.",
  "Invalid credentials": "ایمیل یا رمز عبور اشتباه است.",
  "Email already exists": "این ایمیل قبلا ثبت شده است.",
  "Too many requests": "تعداد درخواست ها زیاد است. کمی بعد دوباره تلاش کنید.",
  "Avatar image is required": "تصویر پروفایل الزامی است.",
  "Avatar image is empty": "فایل تصویر پروفایل خالی است.",
  "Avatar image is too large (max 5MB)": "حجم تصویر پروفایل بیش از حد مجاز است (حداکثر 5 مگابایت).",
  "Unsupported avatar image type": "فرمت تصویر پروفایل پشتیبانی نمی شود.",
  "Avatar not found": "تصویر پروفایل پیدا نشد.",
  "Stored avatar file is missing": "فایل ذخیره شده تصویر پروفایل پیدا نشد.",
  "Stored file is missing": "فایل ذخیره شده پیدا نشد.",
  "Preview is not available for this file type": "پیش نمایش برای این نوع فایل در دسترس نیست.",
  "Course does not belong to selected semester": "این درس متعلق به ترم انتخاب شده نیست.",
  "Name is too short": "نام خیلی کوتاه است.",
  "Name is too long": "نام خیلی طولانی است.",
  "Invalid email": "ایمیل نامعتبر است.",
  "Password is required": "رمز عبور الزامی است.",
  "Password must be at least 8 characters": "رمز عبور باید حداقل 8 کاراکتر باشد.",
  "Password is too long": "رمز عبور خیلی طولانی است.",
  "Password must include at least one uppercase letter": "رمز عبور باید حداقل یک حرف بزرگ داشته باشد.",
  "Password must include at least one lowercase letter": "رمز عبور باید حداقل یک حرف کوچک داشته باشد.",
  "Password must include at least one number": "رمز عبور باید حداقل یک عدد داشته باشد.",
  "Semester title is too short": "عنوان ترم خیلی کوتاه است.",
  "Semester title is too long": "عنوان ترم خیلی طولانی است.",
  "Code is too long": "کد خیلی طولانی است.",
  "Invalid start date": "تاریخ شروع نامعتبر است.",
  "Invalid end date": "تاریخ پایان نامعتبر است.",
  "Invalid from date": "تاریخ شروع بازه نامعتبر است.",
  "Invalid to date": "تاریخ پایان بازه نامعتبر است.",
  "Course name is too short": "نام درس خیلی کوتاه است.",
  "Course name is too long": "نام درس خیلی طولانی است.",
  "Invalid semester": "ترم انتخاب شده نامعتبر است.",
  "Start time must be HH:mm": "زمان شروع باید با فرمت HH:mm باشد.",
  "End time must be HH:mm": "زمان پایان باید با فرمت HH:mm باشد.",
  "Exam title is too short": "عنوان امتحان خیلی کوتاه است.",
  "Exam title is too long": "عنوان امتحان خیلی طولانی است.",
  "Invalid exam date": "تاریخ امتحان نامعتبر است.",
  "Title is too short": "عنوان خیلی کوتاه است.",
  "Title is too long": "عنوان خیلی طولانی است.",
  "Folder name is required": "نام پوشه الزامی است.",
  "Folder name is too long": "نام پوشه خیلی طولانی است.",
  "Invalid input": "ورودی نامعتبر است.",
};

function translateMessage(message: string) {
  if (messageMap[message]) return messageMap[message];

  if (message.startsWith("Too big:")) {
    return "مقدار وارد شده از حد مجاز بیشتر است.";
  }
  if (message.startsWith("Too small:")) {
    return "مقدار وارد شده از حداقل مجاز کمتر است.";
  }
  if (message.startsWith("Invalid input:")) {
    return "نوع مقدار وارد شده نامعتبر است.";
  }
  if (message.startsWith("String must contain")) {
    return "تعداد کاراکترهای ورودی خارج از محدوده مجاز است.";
  }

  return message;
}

function defaultMessageByStatus(status: number) {
  if (status === 401) return "نشست شما منقضی شده است. دوباره وارد شوید.";
  if (status === 403) return "دسترسی لازم برای انجام این عملیات را ندارید.";
  if (status === 404) return "مورد درخواستی پیدا نشد.";
  if (status === 429) return "تعداد درخواست ها زیاد است. کمی بعد دوباره تلاش کنید.";
  if (status >= 500) return "خطای سرور رخ داده است. کمی بعد دوباره تلاش کنید.";
  return "درخواست ناموفق بود.";
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

  for (const key of Object.keys(fieldErrors)) {
    fieldErrors[key] = fieldErrors[key].map((message) => translateMessage(message));
  }

  issues = issues.map((issue) => ({
    ...issue,
    message: issue.message ? translateMessage(issue.message) : issue.message,
  }));

  return { fieldErrors, issues };
}

function buildApiClientError(payload: unknown, status: number) {
  const fallback = defaultMessageByStatus(status);

  if (isRecord(payload) && "success" in payload && payload.success === false && "error" in payload) {
    const error = (payload as ApiFailure).error;
    const message = translateMessage(error.message || fallback);
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
      message: "پاسخ دریافتی از سرور معتبر نیست.",
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
      message: "پاسخ دریافتی از سرور معتبر نیست.",
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
      message: translateMessage(error.message),
      code: error.code,
      status: error.status,
      fieldErrors: error.fieldErrors,
      issues: error.issues,
    };
  }

  if (error instanceof Error) {
    return {
      message: translateMessage(error.message),
      code: "UNKNOWN_ERROR",
      status: 0,
      fieldErrors: {} as FieldErrors,
      issues: [] as ApiValidationIssue[],
    };
  }

  return {
    message: "یک خطای غیرمنتظره رخ داد.",
    code: "UNKNOWN_ERROR",
    status: 0,
    fieldErrors: {} as FieldErrors,
    issues: [] as ApiValidationIssue[],
  };
}
