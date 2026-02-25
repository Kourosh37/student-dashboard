import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, ok } from "@/lib/http";
import { plannerStats } from "@/lib/services/planner-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const stats = await plannerStats(session.userId);
    return ok(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
