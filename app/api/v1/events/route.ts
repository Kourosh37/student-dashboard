import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { fail, handleApiError, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { eventDraftInterval, detectScheduleConflicts } from "@/lib/services/conflict-service";
import { createEvent, listEvents } from "@/lib/services/event-service";
import { createEventSchema, listEventsQuerySchema } from "@/lib/validators/event";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = listEventsQuerySchema.safeParse(query);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const result = await listEvents(session.userId, {
      ...parsed.data,
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const startAt = new Date(parsed.data.startAt);
    const endAt = parsed.data.endAt ? new Date(parsed.data.endAt) : null;
    const interval = eventDraftInterval({ startAt, endAt });

    if (!parsed.data.allowConflicts) {
      const conflicts = await detectScheduleConflicts(session.userId, interval);
      if (conflicts.length > 0) {
        return fail("Schedule conflict detected", 409, "SCHEDULE_CONFLICT", { conflicts });
      }
    }

    const created = await createEvent(session.userId, {
      title: parsed.data.title,
      description: parsed.data.description,
      location: parsed.data.location,
      startAt,
      endAt,
      isPinned: parsed.data.isPinned,
    });

    publishUserEvent(session.userId, "event.created", { eventId: created.id });
    return ok(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
