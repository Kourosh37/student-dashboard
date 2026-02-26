type RealtimeEvent = {
  id: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

type RealtimeListener = (event: RealtimeEvent) => void;

const listenersByUser = new Map<string, Set<RealtimeListener>>();

function createEvent(type: string, payload: Record<string, unknown>): RealtimeEvent {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    payload,
  };
}

export function subscribeUserEvents(userId: string, listener: RealtimeListener) {
  const listeners = listenersByUser.get(userId) ?? new Set<RealtimeListener>();
  listeners.add(listener);
  listenersByUser.set(userId, listeners);

  return () => {
    const current = listenersByUser.get(userId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listenersByUser.delete(userId);
    }
  };
}

export function publishUserEvent(userId: string, type: string, payload: Record<string, unknown> = {}) {
  const listeners = listenersByUser.get(userId);
  if (!listeners || listeners.size === 0) return;

  const event = createEvent(type, payload);
  for (const listener of listeners) {
    listener(event);
  }
}

