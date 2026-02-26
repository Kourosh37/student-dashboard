"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pin, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PersianDateInput } from "@/components/ui/persian-date-input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError, apiFetch } from "@/lib/client-api";
import { combineDateAndTimeToIso } from "@/lib/date-time";
import { formatDateTime, plannerCadenceLabel, plannerPriorityLabel, plannerStatusLabel } from "@/lib/fa";
import { fieldError, toPanelError, type PanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";
import type { PlannerCadence, PlannerItem, PlannerPriority, PlannerStatus, ScheduleConflict } from "@/types/dashboard";

const statusOptions: PlannerStatus[] = ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"];
const priorityOptions: PlannerPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const cadenceOptions: PlannerCadence[] = ["DAILY", "WEEKLY", "MONTHLY"];

type PlannerListResponse = {
  items: PlannerItem[];
  total: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractConflicts(error: unknown): ScheduleConflict[] {
  if (!(error instanceof ApiClientError)) return [];
  if (error.code !== "SCHEDULE_CONFLICT") return [];
  if (!isRecord(error.details)) return [];

  const rawConflicts = error.details.conflicts;
  if (!Array.isArray(rawConflicts)) return [];

  return rawConflicts
    .filter((item): item is ScheduleConflict => {
      if (!isRecord(item)) return false;
      return (
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.startAt === "string" &&
        typeof item.endAt === "string" &&
        typeof item.source === "string"
      );
    })
    .map((item) => item);
}

function conflictSourceLabel(source: ScheduleConflict["source"]) {
  if (source === "CLASS") return "کلاس";
  if (source === "PLANNER") return "برنامه ریزی";
  if (source === "EXAM") return "امتحان";
  return "رویداد";
}

function askConflictOverride(conflicts: ScheduleConflict[]) {
  const lines = conflicts.slice(0, 4).map((item) => {
    const when = new Date(item.startAt).toLocaleString("fa-IR-u-ca-persian", {
      hour: "2-digit",
      minute: "2-digit",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    return `${conflictSourceLabel(item.source)} | ${when} | ${item.title}`;
  });

  const suffix = conflicts.length > 4 ? `\n... و ${conflicts.length - 4} مورد دیگر` : "";
  return window.confirm(`تداخل زمانی پیدا شد:\n${lines.join("\n")}${suffix}\n\nبا وجود تداخل ذخیره شود؟`);
}

export function PlannerPanel() {
  const router = useRouter();
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<PanelError | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | PlannerStatus>("");
  const [cadenceFilter, setCadenceFilter] = useState<"" | PlannerCadence>("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "TODO" as PlannerStatus,
    priority: "MEDIUM" as PlannerPriority,
    cadence: "DAILY" as PlannerCadence,
    plannedForDate: "",
    plannedForTime: "",
    startAtDate: "",
    startAtTime: "",
    dueAtDate: "",
    dueAtTime: "",
    isPinned: false,
  });

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "100");
      params.set("offset", "0");
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (cadenceFilter) params.set("cadence", cadenceFilter);

      const plannerData = await apiFetch<PlannerListResponse>(`/api/v1/planner?${params.toString()}`);
      setItems(plannerData.items);
    } catch (error) {
      const parsed = toPanelError(error, "بارگذاری برنامه ریزی انجام نشد");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({ tone: "error", title: "بارگذاری ناموفق بود", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, cadenceFilter, router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useRealtime({
    onMessage: (message) => {
      if (["planner.created", "planner.updated", "planner.deleted"].includes(message.type)) {
        loadAll();
      }
    },
  });

  async function submitCreate(allowConflicts: boolean) {
    const plannedFor = form.plannedForDate ? combineDateAndTimeToIso(form.plannedForDate, form.plannedForTime || null) : null;
    const startAt = form.startAtDate ? combineDateAndTimeToIso(form.startAtDate, form.startAtTime || null) : null;
    const dueAt = form.dueAtDate ? combineDateAndTimeToIso(form.dueAtDate, form.dueAtTime || null) : null;

    await apiFetch<PlannerItem>("/api/v1/planner", {
      method: "POST",
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        cadence: form.cadence,
        plannedFor,
        startAt,
        dueAt,
        isPinned: form.isPinned,
        allowConflicts,
      }),
    });
  }

  async function createItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      await submitCreate(false);
      setForm({
        title: "",
        description: "",
        status: "TODO",
        priority: "MEDIUM",
        cadence: "DAILY",
        plannedForDate: "",
        plannedForTime: "",
        startAtDate: "",
        startAtTime: "",
        dueAtDate: "",
        dueAtTime: "",
        isPinned: false,
      });
      setCreateOpen(false);
      pushToast({ tone: "success", title: "آیتم برنامه ریزی ایجاد شد" });
      await loadAll();
    } catch (error) {
      const conflicts = extractConflicts(error);
      if (conflicts.length > 0 && askConflictOverride(conflicts)) {
        try {
          await submitCreate(true);
          setForm({
            title: "",
            description: "",
            status: "TODO",
            priority: "MEDIUM",
            cadence: "DAILY",
            plannedForDate: "",
            plannedForTime: "",
            startAtDate: "",
            startAtTime: "",
            dueAtDate: "",
            dueAtTime: "",
            isPinned: false,
          });
          setCreateOpen(false);
          pushToast({ tone: "success", title: "آیتم با وجود تداخل ایجاد شد" });
          await loadAll();
          setSaving(false);
          return;
        } catch (retryError) {
          const parsedRetry = toPanelError(retryError, "ایجاد آیتم برنامه ریزی انجام نشد");
          setFormError(parsedRetry);
          pushToast({ tone: "error", title: "ایجاد ناموفق بود", description: parsedRetry.message });
          setSaving(false);
          return;
        }
      }

      const parsed = toPanelError(error, "ایجاد آیتم برنامه ریزی انجام نشد");
      setFormError(parsed);
      pushToast({ tone: "error", title: "ایجاد ناموفق بود", description: parsed.message });
    } finally {
      setSaving(false);
    }
  }

  async function patchItem(id: string, payload: Partial<PlannerItem>) {
    try {
      const updated = await apiFetch<PlannerItem>(`/api/v1/planner/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch (error) {
      const parsed = toPanelError(error, "بروزرسانی آیتم برنامه ریزی انجام نشد");
      pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsed.message });
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm("این آیتم برنامه ریزی حذف شود؟")) return;
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/planner/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
      pushToast({ tone: "success", title: "آیتم برنامه ریزی حذف شد" });
    } catch (error) {
      const parsed = toPanelError(error, "حذف آیتم برنامه ریزی انجام نشد");
      pushToast({ tone: "error", title: "حذف ناموفق بود", description: parsed.message });
    }
  }

  const titleError = fieldError(formError?.fieldErrors ?? {}, "title");
  const descriptionError = fieldError(formError?.fieldErrors ?? {}, "description");

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">برنامه ریزی مستقل</h2>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          آیتم جدید
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>آیتم های برنامه ریزی</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
            <Input placeholder="جستجوی آیتم ها" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "" | PlannerStatus)}
            >
              <option value="">{plannerStatusLabel("")}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {plannerStatusLabel(status)}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={cadenceFilter}
              onChange={(event) => setCadenceFilter(event.target.value as "" | PlannerCadence)}
            >
              <option value="">{plannerCadenceLabel("")}</option>
              {cadenceOptions.map((cadence) => (
                <option key={cadence} value={cadence}>
                  {plannerCadenceLabel(cadence)}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex min-h-24 items-center justify-center">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">آیتمی پیدا نشد.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <article key={item.id} className="rounded-md border border-border/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary">{plannerStatusLabel(item.status)}</Badge>
                        <Badge variant={item.priority === "URGENT" ? "warning" : "outline"}>{plannerPriorityLabel(item.priority)}</Badge>
                        <Badge variant="outline">{plannerCadenceLabel(item.cadence)}</Badge>
                        {item.plannedFor && <Badge variant="outline">برنامه: {formatDateTime(item.plannedFor)}</Badge>}
                        {item.dueAt && <Badge variant="outline">مهلت: {formatDateTime(item.dueAt)}</Badge>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={item.status}
                        onChange={(event) => patchItem(item.id, { status: event.target.value as PlannerStatus })}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {plannerStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                      <Button type="button" variant="outline" size="icon" onClick={() => patchItem(item.id, { isPinned: !item.isPinned })}>
                        <Pin className={`h-4 w-4 ${item.isPinned ? "fill-current" : ""}`} />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ایجاد آیتم برنامه ریزی" description="برنامه ریزی روزانه، هفتگی یا ماهانه">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={createItem}>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="planner-title">عنوان</Label>
            <Input
              id="planner-title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              aria-invalid={Boolean(titleError)}
              required
            />
            {titleError && <p className="text-xs text-destructive">{titleError}</p>}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="planner-description">توضیحات</Label>
            <Textarea
              id="planner-description"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              aria-invalid={Boolean(descriptionError)}
            />
            {descriptionError && <p className="text-xs text-destructive">{descriptionError}</p>}
          </div>

          <div className="space-y-2">
            <Label>وضعیت</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as PlannerStatus }))}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {plannerStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>اولویت</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.priority}
              onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as PlannerPriority }))}
            >
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {plannerPriorityLabel(priority)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>بازه برنامه</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.cadence}
              onChange={(event) => setForm((prev) => ({ ...prev, cadence: event.target.value as PlannerCadence }))}
            >
              {cadenceOptions.map((cadence) => (
                <option key={cadence} value={cadence}>
                  {plannerCadenceLabel(cadence)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>تاریخ مرجع برنامه (شمسی)</Label>
            <PersianDateInput
              value={form.plannedForDate}
              onChange={(value) => setForm((prev) => ({ ...prev, plannedForDate: value }))}
              placeholder="اختیاری"
            />
          </div>

          <div className="space-y-2">
            <Label>ساعت مرجع برنامه</Label>
            <Input
              type="time"
              value={form.plannedForTime}
              onChange={(event) => setForm((prev) => ({ ...prev, plannedForTime: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>تاریخ شروع (شمسی)</Label>
            <PersianDateInput
              value={form.startAtDate}
              onChange={(value) => setForm((prev) => ({ ...prev, startAtDate: value }))}
              placeholder="اختیاری"
            />
          </div>

          <div className="space-y-2">
            <Label>ساعت شروع</Label>
            <Input
              type="time"
              value={form.startAtTime}
              onChange={(event) => setForm((prev) => ({ ...prev, startAtTime: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>تاریخ مهلت (شمسی)</Label>
            <PersianDateInput
              value={form.dueAtDate}
              onChange={(value) => setForm((prev) => ({ ...prev, dueAtDate: value }))}
              placeholder="اختیاری"
            />
          </div>

          <div className="space-y-2">
            <Label>ساعت مهلت</Label>
            <Input
              type="time"
              value={form.dueAtTime}
              onChange={(event) => setForm((prev) => ({ ...prev, dueAtTime: event.target.value }))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={form.isPinned} onChange={(event) => setForm((prev) => ({ ...prev, isPinned: event.target.checked }))} />
            سنجاق کردن آیتم
          </label>

          <div className="md:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
              ایجاد
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
