import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError } from "@/lib/http";
import { subscribeUserEvents } from "@/lib/realtime";

export const runtime = "nodejs";

const encoder = new TextEncoder();

function encodeSseChunk(chunk: string) {
  return encoder.encode(chunk);
}

function formatSseEvent(input: {
  id: string;
  event: string;
  data: Record<string, unknown>;
}) {
  return `id: ${input.id}\nevent: ${input.event}\ndata: ${JSON.stringify(input.data)}\n\n`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);

    let unsubscribe: (() => void) | null = null;
    let heartbeatTimer: NodeJS.Timeout | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encodeSseChunk(
            formatSseEvent({
              id: crypto.randomUUID(),
              event: "message",
              data: { type: "connected", ok: true, at: new Date().toISOString() },
            }),
          ),
        );

        unsubscribe = subscribeUserEvents(session.userId, (event) => {
          controller.enqueue(
            encodeSseChunk(
              formatSseEvent({
                id: event.id,
                event: "message",
                data: {
                  type: event.type,
                  timestamp: event.timestamp,
                  payload: event.payload,
                },
              }),
            ),
          );
        });

        heartbeatTimer = setInterval(() => {
          controller.enqueue(
            encodeSseChunk(
              formatSseEvent({
                id: crypto.randomUUID(),
                event: "message",
                data: { type: "heartbeat", at: new Date().toISOString() },
              }),
            ),
          );
        }, 20_000);
      },
      cancel() {
        if (unsubscribe) unsubscribe();
        if (heartbeatTimer) clearInterval(heartbeatTimer);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
