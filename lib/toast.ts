type ToastTone = "default" | "success" | "error";

export type ToastMessage = {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastInput = Omit<ToastMessage, "id">;
type ToastListener = (toast: ToastMessage) => void;

const listeners = new Set<ToastListener>();

export function subscribeToast(listener: ToastListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function pushToast(input: ToastInput) {
  const toast: ToastMessage = {
    ...input,
    id: crypto.randomUUID(),
    tone: input.tone ?? "default",
    durationMs: input.durationMs ?? 3500,
  };

  for (const listener of listeners) {
    listener(toast);
  }
}
