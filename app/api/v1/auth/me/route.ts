import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, fail, ok } from "@/lib/http";
import { findUserById } from "@/lib/services/user-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const user = await findUserById(session.userId);
    if (!user) {
      return fail("User not found", 404, "USER_NOT_FOUND");
    }

    return ok(user);
  } catch (error) {
    return handleApiError(error);
  }
}
