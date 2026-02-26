import { NextRequest } from "next/server";

import { getSessionFromRequest } from "@/lib/auth/session";
import { ApiError } from "@/lib/http";

export async function requireSession(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session?.sub) {
    throw new ApiError("Unauthorized", 401, "UNAUTHORIZED");
  }

  return {
    userId: session.sub,
    email: session.email,
    name: session.name,
  };
}

