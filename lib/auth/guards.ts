import { NextRequest } from "next/server";

import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/http";

export async function requireSession(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session?.sub) {
    throw new ApiError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    throw new ApiError("Unauthorized", 401, "UNAUTHORIZED");
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
  };
}