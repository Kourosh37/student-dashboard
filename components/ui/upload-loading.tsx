"use client";

import { LoaderCircle, UploadCloud } from "lucide-react";

import { cn, formatFileSize } from "@/lib/utils";

type UploadLoadingProps = {
  active: boolean;
  progress: number;
  file: File | null;
  className?: string;
  label?: string;
};

export function UploadLoading({ active, progress, file, className, label }: UploadLoadingProps) {
  if (!active) return null;

  return (
    <div className={cn("rounded-lg border border-primary/35 bg-primary/5 p-3", className)}>
      <div className="flex items-center gap-2">
        <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
          <UploadCloud className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{label ?? "در حال آپلود فایل..."}</p>
          {file && (
            <p className="truncate text-xs text-muted-foreground">
              {file.name} | {formatFileSize(file.size)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold tabular-nums text-primary">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          <span>{progress}%</span>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="وضعیت آپلود"
        />
      </div>
    </div>
  );
}
