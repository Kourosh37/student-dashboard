"use client";

import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ButtonProps } from "@/components/ui/button";

export type ConfirmRequestOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonProps["variant"];
};

type PendingConfirm = {
  options: ConfirmRequestOptions;
  resolve: (value: boolean) => void;
};

export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    return () => {
      if (pending) pending.resolve(false);
    };
  }, [pending]);

  const requestConfirm = useCallback((options: ConfirmRequestOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
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

  const confirmDialog = (
    <ConfirmDialog
      open={Boolean(pending)}
      title={pending?.options.title ?? ""}
      description={pending?.options.description}
      confirmLabel={pending?.options.confirmLabel}
      cancelLabel={pending?.options.cancelLabel}
      confirmVariant={pending?.options.confirmVariant}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  );

  return {
    requestConfirm,
    confirmDialog,
  };
}