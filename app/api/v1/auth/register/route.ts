import { NextRequest, NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { handleApiError, fail, validationFail } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { createUser, findUserByEmail } from "@/lib/services/user-service";
import { registerSchema } from "@/lib/validators/auth";

function isPrismaUniqueError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeCode = (error as { code?: unknown }).code;
  return maybeCode === "P2002";
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limiter = checkRateLimit(`auth:register:${ip}`, {
      windowMs: 60_000,
      maxRequests: 8,
    });

    if (!limiter.allowed) {
      return fail("Too many requests", 429, "RATE_LIMITED", {
        retryAfter: limiter.retryAfter,
      });
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const existing = await findUserByEmail(parsed.data.email);
    if (existing) {
      return fail("Email already exists", 409, "EMAIL_EXISTS");
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await createUser({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
    });

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json({
      success: true,
      data: user,
    });
    setSessionCookie(response, token);

    return response;
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return fail("Email already exists", 409, "EMAIL_EXISTS");
    }
    return handleApiError(error);
  }
}
