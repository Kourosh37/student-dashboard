import { NextRequest, NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { handleApiError, fail, validationFail } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { findUserByEmail } from "@/lib/services/user-service";
import { loginSchema } from "@/lib/validators/auth";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limiter = checkRateLimit(`auth:login:${ip}`, {
      windowMs: 60_000,
      maxRequests: 12,
    });

    if (!limiter.allowed) {
      return fail("Too many requests", 429, "RATE_LIMITED", {
        retryAfter: limiter.retryAfter,
      });
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const user = await findUserByEmail(parsed.data.email);
    if (!user) {
      return fail("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    const passwordValid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!passwordValid) {
      return fail("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
    setSessionCookie(response, token);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
