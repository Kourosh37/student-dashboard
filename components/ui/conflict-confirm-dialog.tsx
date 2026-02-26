"use client";

import { AlertTriangle, CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { ScheduleConflict } from "@/types/dashboard";

type ConflictConfirmDialogProps = {
  open: boolean;
  conflicts: ScheduleConflict[];
  onConfirm: () => void;
  onCancel: () => void;
};

function sourceLabel(source: ScheduleConflict["source"]) {
  if (source === "CLASS") return "کلاس";
  if (source === "PLANNER") return "برنامه ریزی";
  if (source === "EXAM") return "امتحان";
  return "رویداد";
}

function sourceTone(source: ScheduleConflict["source"]) {
  if (source === "CLASS") return "bg-sky-100 text-sky-900 border-sky-200";
  if (source === "PLANNER") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (source === "EXAM") return "bg-amber-100 text-amber-900 border-amber-200";
  return "bg-violet-100 text-violet-900 border-violet-200";
}

export function ConflictConfirmDialog({ open, conflicts, onConfirm, onCancel }: ConflictConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="تداخل زمانی پیدا شد"
      description="در صورت ادامه، آیتم جدید با وجود تداخل ثبت خواهد شد."
      className="max-w-2xl"
    >
      <div className="space-y-3">
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />
            این زمان با {conflicts.length} مورد دیگر تداخل دارد.
          </p>
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto pe-1">
          {conflicts.map((item) => (
            <article key={`${item.source}-${item.id}-${item.startAt}`} className="rounded-md border border-border/70 p-2">
              <div className="mb-1 flex items-center gap-2">
                <Badge className={`border ${sourceTone(item.source)}`}>{sourceLabel(item.source)}</Badge>
                <p className="text-sm font-medium">{item.title}</p>
              </div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {new Date(item.startAt).toLocaleString("fa-IR-u-ca-persian", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {" - "}
                {new Date(item.endAt).toLocaleTimeString("fa-IR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </article>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            انصراف
          </Button>
          <Button type="button" onClick={onConfirm}>
            ادامه با وجود تداخل
          </Button>
        </div>
      </div>
    </Modal>
  );
}

