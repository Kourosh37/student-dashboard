"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { subscribeToast, type ToastMessage } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return subscribeToast((toast) => {
      setItems((prev) => [...prev, toast]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== toast.id));
      }, toast.durationMs ?? 3500);
    });
  }, []);

  function dismiss(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4">
      {items.map((item) => (
        <article
          key={item.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border px-3 py-2 shadow-lg backdrop-blur-sm",
            item.tone === "error" && "border-rose-300 bg-rose-50 text-rose-900",
            item.tone === "success" && "border-emerald-300 bg-emerald-50 text-emerald-900",
            item.tone === "default" && "border-border bg-background text-foreground",
          )}
        >
          <div className="mt-0.5">
            {item.tone === "error" ? (
              <TriangleAlert className="h-4 w-4" />
            ) : item.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Info className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{item.title}</p>
            {item.description && <p className="truncate text-xs opacity-80">{item.description}</p>}
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => dismiss(item.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </article>
      ))}
    </div>
  );
}
