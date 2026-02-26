"use client";

import { useCallback, useEffect, useState } from "react";

import { ConflictConfirmDialog } from "@/components/ui/conflict-confirm-dialog";
import type { ScheduleConflict } from "@/types/dashboard";

type PendingConfirm = {
  conflicts: ScheduleConflict[];
  resolve: (value: boolean) => void;
};

export function useConflictConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    return () => {
      if (pending) pending.resolve(false);
    };
  }, [pending]);

  const requestConfirm = useCallback((conflicts: ScheduleConflict[]) => {
    return new Promise<boolean>((resolve) => {
      setPending({ conflicts, resolve });
    });
  }, []);

  const handleCancel = useCallback(() => {
    if (!pending) return;
    pending.resolve(false);
    setPending(null);
  }, [pending]);

  const handleConfirm = useCallback(() => {
    if (!pending) return;
    pending.resolve(true);
    setPending(null);
  }, [pending]);

  const conflictDialog = (
    <ConflictConfirmDialog
      open={Boolean(pending)}
      conflicts={pending?.conflicts ?? []}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  );

  return {
    requestConfirm,
    conflictDialog,
  };
}

