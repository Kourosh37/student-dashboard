"use client";

import { useEffect, useState } from "react";

export function useUploadProgress(active: boolean, resetKey: string) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress((prev) => (prev === 0 ? 0 : 100));
      const timeoutId = window.setTimeout(() => setProgress(0), 420);
      return () => window.clearTimeout(timeoutId);
    }

    setProgress((prev) => (prev > 6 ? prev : 6));
    const intervalId = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        if (prev < 45) return Math.min(92, prev + 9);
        if (prev < 75) return Math.min(92, prev + 5);
        return Math.min(92, prev + 2);
      });
    }, 220);

    return () => window.clearInterval(intervalId);
  }, [active, resetKey]);

  return progress;
}
