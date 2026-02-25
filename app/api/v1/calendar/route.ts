import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, ok, validationFail } from "@/lib/http";
import { getCalendarData } from "@/lib/services/calendar-service";
import { calendarQuerySchema } from "@/lib/validators/calendar";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = calendarQuerySchema.safeParse(query);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const result = await getCalendarData(session.userId, {
      from: new Date(parsed.data.from),
      to: new Date(parsed.data.to),
      semesterId: parsed.data.semesterId,
      courseId: parsed.data.courseId,
      status: parsed.data.status,
      q: parsed.data.q,
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
