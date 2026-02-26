"use client";

import { useEffect, useRef } from "react";

type RealtimeMessage = {
  type: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
};

type Options = {
  enabled?: boolean;
  onMessage: (message: RealtimeMessage) => void;
};

export function useRealtime(options: Options) {
  const onMessageRef = useRef(options.onMessage);

  useEffect(() => {
    onMessageRef.current = options.onMessage;
  }, [options.onMessage]);

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }

    let closed = false;
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      eventSource = new EventSource("/api/v1/realtime/stream", {
        withCredentials: true,
      });

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as RealtimeMessage;
          onMessageRef.current({
            ...parsed,
            type: parsed.type || "message",
          });
        } catch {
          // Ignore malformed event payloads.
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        if (closed) return;
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [options.enabled]);
}

