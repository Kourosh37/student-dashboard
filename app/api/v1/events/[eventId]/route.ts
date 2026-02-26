import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { fail, handleApiError, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { eventDraftInterval, detectScheduleConflicts } from "@/lib/services/conflict-service";
import { deleteEvent, getEventById, updateEvent } from "@/lib/services/event-service";
import { updateEventSchema } from "@/lib/validators/event";

type Context = {
  params: Promise<{ eventId: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { eventId } = await context.params;
    const event = await getEventById(session.userId, eventId);
    if (!event) {
      return fail("Event not found", 404, "EVENT_NOT_FOUND");
    }

    return ok(event);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { eventId } = await context.params;
    const body = await request.json();
    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const existing = await getEventById(session.userId, eventId);
    if (!existing) {
      return fail("Event not found", 404, "EVENT_NOT_FOUND");
    }

    const nextStartAt = parsed.data.startAt === undefined ? existing.startAt : new Date(parsed.data.startAt);
    const nextEndAt =
      parsed.data.endAt === undefined
        ? existing.endAt
        : parsed.data.endAt
          ? new Date(parsed.data.endAt)
          : null;

    if (!parsed.data.allowConflicts) {
      const interval = eventDraftInterval({
        startAt: nextStartAt,
        endAt: nextEndAt,
      });
      const conflicts = await detectScheduleConflicts(session.userId, interval, {
        ignoreEventId: eventId,
      });
      if (conflicts.length > 0) {
        return fail("Schedule conflict detected", 409, "SCHEDULE_CONFLICT", { conflicts });
      }
    }

    const updated = await updateEvent(session.userId, eventId, {
      title: parsed.data.title,
      description: parsed.data.description,
      location: parsed.data.location,
      startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : undefined,
      endAt:
        parsed.data.endAt === undefined
          ? undefined
          : parsed.data.endAt
            ? new Date(parsed.data.endAt)
            : null,
      isPinned: parsed.data.isPinned,
    });

    if (!updated) {
      return fail("Event not found", 404, "EVENT_NOT_FOUND");
    }

    publishUserEvent(session.userId, "event.updated", { eventId: updated.id });
    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const session = await requireSession(request);
    const { eventId } = await context.params;
    const deleted = await deleteEvent(session.userId, eventId);
    if (!deleted) {
      return fail("Event not found", 404, "EVENT_NOT_FOUND");
    }

    publishUserEvent(session.userId, "event.deleted", { eventId });
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
