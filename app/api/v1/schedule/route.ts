import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, ok, validationFail } from "@/lib/http";
import { listSchedule } from "@/lib/services/course-service";
import { scheduleQuerySchema } from "@/lib/validators/schedule";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = scheduleQuerySchema.safeParse(query);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const result = await listSchedule(session.userId, parsed.data);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
