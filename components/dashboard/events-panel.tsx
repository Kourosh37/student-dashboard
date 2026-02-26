"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, LoaderCircle, Pin, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PersianDateInput } from "@/components/ui/persian-date-input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError, apiFetch } from "@/lib/client-api";
import { combineDateAndTimeToIso, splitIsoToDateAndTime } from "@/lib/date-time";
import { formatDateTime } from "@/lib/fa";
import { fieldError, toPanelError, type PanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";
import { useConflictConfirm } from "@/lib/use-conflict-confirm";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";
import type { ScheduleConflict, StudentEvent } from "@/types/dashboard";

type EventsResponse = {
  items: StudentEvent[];
  total: number;
};

type EventForm = {
  title: string;
  description: string;
  location: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  isPinned: boolean;
};

const initialForm: EventForm = {
  title: "",
  description: "",
  location: "",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  isPinned: false,
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

function eventToForm(item: StudentEvent): EventForm {
  const start = splitIsoToDateAndTime(item.startAt);
  const end = splitIsoToDateAndTime(item.endAt);

  return {
    title: item.title,
    description: item.description ?? "",
    location: item.location ?? "",
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    isPinned: item.isPinned,
  };
}

function buildEventPayload(form: EventForm, allowConflicts = false) {
  const startAt = combineDateAndTimeToIso(form.startDate, form.startTime || null);
  if (!startAt) return null;

  const endAt = form.endDate
    ? combineDateAndTimeToIso(form.endDate, form.endTime || form.startTime || null)
    : null;

  if (form.endDate && !endAt) return null;

  return {
    title: form.title,
    description: form.description || null,
    location: form.location || null,
    startAt,
    endAt,
    isPinned: form.isPinned,
    allowConflicts,
  };
}

export function EventsPanel() {
  const router = useRouter();
  const { requestConfirm, conflictDialog } = useConflictConfirm();
  const { requestConfirm: requestDeleteConfirm, confirmDialog: deleteConfirmDialog } = useConfirmDialog();

  const [items, setItems] = useState<StudentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<EventForm>(initialForm);
  const [editForm, setEditForm] = useState<EventForm>(initialForm);

  const [createError, setCreateError] = useState<PanelError | null>(null);
  const [editError, setEditError] = useState<PanelError | null>(null);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [items],
  );

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "200");
      params.set("offset", "0");
      if (query.trim()) params.set("q", query.trim());

      const response = await apiFetch<EventsResponse>(`/api/v1/events?${params.toString()}`);
      setItems(response.items);
    } catch (error) {
      const parsed = toPanelError(error, "بارگذاری رویدادها انجام نشد");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({ tone: "error", title: "بارگذاری ناموفق بود", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }, [query, router]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useRealtime({
    onMessage: (message) => {
      if (["event.created", "event.updated", "event.deleted"].includes(message.type)) {
        loadEvents();
      }
    },
  });

  async function submitCreate(allowConflicts: boolean) {
    const payload = buildEventPayload(createForm, allowConflicts);
    if (!payload) {
      setCreateError({
        message: "تاریخ/ساعت شروع یا پایان نامعتبر است.",
        code: "VALIDATION_ERROR",
        details: ["تاریخ/ساعت شروع یا پایان نامعتبر است."],
        fieldErrors: {
          startDate: ["تاریخ شروع الزامی است."],
        },
        status: 400,
      });
      return false;
    }

    await apiFetch<StudentEvent>("/api/v1/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return true;
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setCreateError(null);

    try {
      await submitCreate(false);
      setCreateForm(initialForm);
      setCreateOpen(false);
      pushToast({ tone: "success", title: "رویداد ایجاد شد" });
      await loadEvents();
    } catch (error) {
      const conflicts = extractConflicts(error);
      if (conflicts.length > 0) {
        const shouldContinue = await requestConfirm(conflicts);
        if (shouldContinue) {
        try {
          await submitCreate(true);
          setCreateForm(initialForm);
          setCreateOpen(false);
          pushToast({ tone: "success", title: "رویداد با وجود تداخل ایجاد شد" });
          await loadEvents();
          setSaving(false);
          return;
        } catch (retryError) {
          const parsedRetry = toPanelError(retryError, "ایجاد رویداد انجام نشد");
          setCreateError(parsedRetry);
          pushToast({ tone: "error", title: "ایجاد ناموفق بود", description: parsedRetry.message });
          setSaving(false);
          return;
        }
        }
      }

      const parsed = toPanelError(error, "ایجاد رویداد انجام نشد");
      setCreateError(parsed);
      pushToast({ tone: "error", title: "ایجاد ناموفق بود", description: parsed.message });
    } finally {
      setSaving(false);
    }
  }

  function openEdit(item: StudentEvent) {
    setEditingId(item.id);
    setEditForm(eventToForm(item));
    setEditError(null);
    setEditOpen(true);
  }

  async function submitEdit(allowConflicts: boolean) {
    if (!editingId) return false;

    const payload = buildEventPayload(editForm, allowConflicts);
    if (!payload) {
      setEditError({
        message: "تاریخ/ساعت شروع یا پایان نامعتبر است.",
        code: "VALIDATION_ERROR",
        details: ["تاریخ/ساعت شروع یا پایان نامعتبر است."],
        fieldErrors: {
          startDate: ["تاریخ شروع الزامی است."],
        },
        status: 400,
      });
      return false;
    }

    await apiFetch<StudentEvent>(`/api/v1/events/${editingId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    return true;
  }

  async function handleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;

    setSaving(true);
    setEditError(null);

    try {
      await submitEdit(false);
      setEditOpen(false);
      setEditingId(null);
      pushToast({ tone: "success", title: "رویداد بروزرسانی شد" });
      await loadEvents();
    } catch (error) {
      const conflicts = extractConflicts(error);
      if (conflicts.length > 0) {
        const shouldContinue = await requestConfirm(conflicts);
        if (shouldContinue) {
        try {
          await submitEdit(true);
          setEditOpen(false);
          setEditingId(null);
          pushToast({ tone: "success", title: "رویداد با وجود تداخل بروزرسانی شد" });
          await loadEvents();
          setSaving(false);
          return;
        } catch (retryError) {
          const parsedRetry = toPanelError(retryError, "بروزرسانی رویداد انجام نشد");
          setEditError(parsedRetry);
          pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsedRetry.message });
          setSaving(false);
          return;
        }
        }
      }

      const parsed = toPanelError(error, "بروزرسانی رویداد انجام نشد");
      setEditError(parsed);
      pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsed.message });
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(id: string) {
    const shouldDelete = await requestDeleteConfirm({ title: "این رویداد حذف شود؟" });
    if (!shouldDelete) return;

    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/events/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
      pushToast({ tone: "success", title: "رویداد حذف شد" });
    } catch (error) {
      const parsed = toPanelError(error, "حذف رویداد انجام نشد");
      pushToast({ tone: "error", title: "حذف ناموفق بود", description: parsed.message });
    }
  }

  const createTitleError = fieldError(createError?.fieldErrors ?? {}, "title");
  const createStartDateError = fieldError(createError?.fieldErrors ?? {}, "startDate") || fieldError(createError?.fieldErrors ?? {}, "startAt");
  const editTitleError = fieldError(editError?.fieldErrors ?? {}, "title");
  const editStartDateError = fieldError(editError?.fieldErrors ?? {}, "startDate") || fieldError(editError?.fieldErrors ?? {}, "startAt");

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">رویدادها</h2>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          رویداد جدید
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>مدیریت رویدادها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="جستجوی رویداد" value={query} onChange={(event) => setQuery(event.target.value)} />

          {loading ? (
            <div className="flex min-h-24 items-center justify-center">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : sortedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">رویدادی پیدا نشد.</p>
          ) : (
            <div className="space-y-3">
              {sortedItems.map((item) => (
                <article key={item.id} className="rounded-md border border-border/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">شروع: {formatDateTime(item.startAt)}</p>
                      {item.endAt && <p className="text-xs text-muted-foreground">پایان: {formatDateTime(item.endAt)}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.location && <Badge variant="outline">{item.location}</Badge>}
                        {item.description && <Badge variant="outline">توضیحات دارد</Badge>}
                        {item.isPinned && <Badge variant="secondary">سنجاق شده</Badge>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" onClick={() => openEdit(item)}>
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={async () => {
                          try {
                            const updated = await apiFetch<StudentEvent>(`/api/v1/events/${item.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({ isPinned: !item.isPinned }),
                            });
                            setItems((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
                          } catch (error) {
                            const parsed = toPanelError(error, "بروزرسانی رویداد انجام نشد");
                            pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsed.message });
                          }
                        }}
                      >
                        <Pin className={`h-4 w-4 ${item.isPinned ? "fill-current" : ""}`} />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeEvent(item.id)}>
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ایجاد رویداد" description="ثبت رویداد شخصی با تاریخ و ساعت">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
          <div className="space-y-2 md:col-span-2">
            <Label>عنوان</Label>
            <Input
              value={createForm.title}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
              aria-invalid={Boolean(createTitleError)}
              required
            />
            {createTitleError && <p className="text-xs text-destructive">{createTitleError}</p>}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>توضیحات</Label>
            <Textarea value={createForm.description} onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>مکان</Label>
            <Input value={createForm.location} onChange={(event) => setCreateForm((prev) => ({ ...prev, location: event.target.value }))} />
          </div>

          <div className="space-y-2" />

          <div className="space-y-2">
            <Label>تاریخ شروع (شمسی)</Label>
            <PersianDateInput
              value={createForm.startDate}
              onChange={(value) => setCreateForm((prev) => ({ ...prev, startDate: value }))}
              ariaInvalid={Boolean(createStartDateError)}
              required
              placeholder="انتخاب تاریخ"
            />
            {createStartDateError && <p className="text-xs text-destructive">{createStartDateError}</p>}
          </div>

          <div className="space-y-2">
            <Label>ساعت شروع</Label>
            <Input type="time" value={createForm.startTime} onChange={(event) => setCreateForm((prev) => ({ ...prev, startTime: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>تاریخ پایان (اختیاری)</Label>
            <PersianDateInput
              value={createForm.endDate}
              onChange={(value) => setCreateForm((prev) => ({ ...prev, endDate: value }))}
              placeholder="اختیاری"
            />
          </div>

          <div className="space-y-2">
            <Label>ساعت پایان</Label>
            <Input type="time" value={createForm.endTime} onChange={(event) => setCreateForm((prev) => ({ ...prev, endTime: event.target.value }))} />
          </div>

          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={createForm.isPinned} onChange={(event) => setCreateForm((prev) => ({ ...prev, isPinned: event.target.checked }))} />
            سنجاق کردن رویداد
          </label>

          <div className="md:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
              ایجاد رویداد
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="ویرایش رویداد" description="ویرایش جزئیات رویداد">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleEdit}>
          <div className="space-y-2 md:col-span-2">
            <Label>عنوان</Label>
            <Input
              value={editForm.title}
              onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
              aria-invalid={Boolean(editTitleError)}
              required
            />
            {editTitleError && <p className="text-xs text-destructive">{editTitleError}</p>}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>توضیحات</Label>
            <Textarea value={editForm.description} onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>مکان</Label>
            <Input value={editForm.location} onChange={(event) => setEditForm((prev) => ({ ...prev, location: event.target.value }))} />
          </div>

          <div className="space-y-2" />

          <div className="space-y-2">
            <Label>تاریخ شروع (شمسی)</Label>
            <PersianDateInput
              value={editForm.startDate}
              onChange={(value) => setEditForm((prev) => ({ ...prev, startDate: value }))}
              ariaInvalid={Boolean(editStartDateError)}
              required
              placeholder="انتخاب تاریخ"
            />
            {editStartDateError && <p className="text-xs text-destructive">{editStartDateError}</p>}
          </div>

          <div className="space-y-2">
            <Label>ساعت شروع</Label>
            <Input type="time" value={editForm.startTime} onChange={(event) => setEditForm((prev) => ({ ...prev, startTime: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>تاریخ پایان (اختیاری)</Label>
            <PersianDateInput value={editForm.endDate} onChange={(value) => setEditForm((prev) => ({ ...prev, endDate: value }))} placeholder="اختیاری" />
          </div>

          <div className="space-y-2">
            <Label>ساعت پایان</Label>
            <Input type="time" value={editForm.endTime} onChange={(event) => setEditForm((prev) => ({ ...prev, endTime: event.target.value }))} />
          </div>

          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={editForm.isPinned} onChange={(event) => setEditForm((prev) => ({ ...prev, isPinned: event.target.checked }))} />
            سنجاق کردن رویداد
          </label>

          <div className="md:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Edit3 className="me-2 h-4 w-4" />}
              ذخیره تغییرات
            </Button>
          </div>
        </form>
      </Modal>

      {conflictDialog}
      {deleteConfirmDialog}
    </section>
  );
}

