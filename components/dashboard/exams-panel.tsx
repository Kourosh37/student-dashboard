"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { examStatusLabel, examTypeLabel, formatDateTime } from "@/lib/fa";
import { fieldError, toPanelError, type PanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";
import { useConflictConfirm } from "@/lib/use-conflict-confirm";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";
import type { Course, Exam, ExamStatus, ExamType, ScheduleConflict, Semester } from "@/types/dashboard";

const examTypeOptions: ExamType[] = ["MIDTERM", "FINAL", "QUIZ", "PROJECT", "PRESENTATION", "ASSIGNMENT", "OTHER"];
const examStatusOptions: ExamStatus[] = ["SCHEDULED", "COMPLETED", "MISSED"];

type ExamsResponse = {
  items: Exam[];
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

export function ExamsPanel() {
  const router = useRouter();
  const { requestConfirm, conflictDialog } = useConflictConfirm();
  const { requestConfirm: requestDeleteConfirm, confirmDialog: deleteConfirmDialog } = useConfirmDialog();
  const [items, setItems] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<PanelError | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ExamStatus>("");
  const [form, setForm] = useState({
    title: "",
    semesterId: "",
    courseId: "",
    examType: "MIDTERM" as ExamType,
    status: "SCHEDULED" as ExamStatus,
    examDate: "",
    startTime: "",
    durationMinutes: "",
    location: "",
    notes: "",
    isPinned: false,
  });

  const availableCourses = useMemo(
    () => (form.semesterId ? courses.filter((course) => course.semesterId === form.semesterId) : courses),
    [courses, form.semesterId],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "120");
      params.set("offset", "0");
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter) params.set("status", statusFilter);

      const [examData, courseData, semesterData] = await Promise.all([
        apiFetch<ExamsResponse>(`/api/v1/exams?${params.toString()}`),
        apiFetch<{ items: Course[]; total: number }>("/api/v1/courses?limit=200&offset=0"),
        apiFetch<Semester[]>("/api/v1/semesters"),
      ]);
      setItems(examData.items);
      setCourses(courseData.items);
      setSemesters(semesterData);
    } catch (error) {
      const parsed = toPanelError(error, "بارگذاری امتحانات انجام نشد");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({ tone: "error", title: "بارگذاری ناموفق بود", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtime({
    onMessage: (message) => {
      if (["exam.created", "exam.updated", "exam.deleted"].includes(message.type)) {
        loadData();
      }
    },
  });

  async function submitCreate(allowConflicts: boolean) {
    const examDateIso = combineDateAndTimeToIso(form.examDate, form.startTime || null);

    if (!examDateIso) {
      setFormError({
        message: "تاریخ امتحان معتبر نیست.",
        code: "VALIDATION_ERROR",
        details: ["تاریخ امتحان معتبر نیست."],
        fieldErrors: { examDate: ["تاریخ امتحان معتبر نیست."] },
        status: 400,
      });
      return false;
    }

    await apiFetch<Exam>("/api/v1/exams", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        semesterId: form.semesterId || null,
        courseId: form.courseId || null,
        examDate: examDateIso,
        startTime: form.startTime || null,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
        location: form.location || null,
        notes: form.notes || null,
        allowConflicts,
      }),
    });

    return true;
  }

  async function createExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      await submitCreate(false);
      setForm({
        title: "",
        semesterId: "",
        courseId: "",
        examType: "MIDTERM",
        status: "SCHEDULED",
        examDate: "",
        startTime: "",
        durationMinutes: "",
        location: "",
        notes: "",
        isPinned: false,
      });
      setCreateOpen(false);
      pushToast({ tone: "success", title: "امتحان ایجاد شد" });
      await loadData();
    } catch (error) {
      const conflicts = extractConflicts(error);
      if (conflicts.length > 0) {
        const shouldContinue = await requestConfirm(conflicts);
        if (shouldContinue) {
        try {
          await submitCreate(true);
          setForm({
            title: "",
            semesterId: "",
            courseId: "",
            examType: "MIDTERM",
            status: "SCHEDULED",
            examDate: "",
            startTime: "",
            durationMinutes: "",
            location: "",
            notes: "",
            isPinned: false,
          });
          setCreateOpen(false);
          pushToast({ tone: "success", title: "امتحان با وجود تداخل ایجاد شد" });
          await loadData();
          setSaving(false);
          return;
        } catch (retryError) {
          const parsedRetry = toPanelError(retryError, "ایجاد امتحان انجام نشد");
          setFormError(parsedRetry);
          pushToast({ tone: "error", title: "ایجاد ناموفق بود", description: parsedRetry.message });
          setSaving(false);
          return;
        }
        }
      }

      const parsed = toPanelError(error, "ایجاد امتحان انجام نشد");
      setFormError(parsed);
      pushToast({ tone: "error", title: "ایجاد ناموفق بود", description: parsed.message });
    } finally {
      setSaving(false);
    }
  }

  async function updateExam(id: string, payload: Partial<Exam>) {
    try {
      const updated = await apiFetch<Exam>(`/api/v1/exams/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch (error) {
      const parsed = toPanelError(error, "بروزرسانی امتحان انجام نشد");
      pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsed.message });
    }
  }

  async function removeExam(id: string) {
    const shouldDelete = await requestDeleteConfirm({ title: "این امتحان حذف شود؟" });
    if (!shouldDelete) return;
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/exams/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
      pushToast({ tone: "success", title: "امتحان حذف شد" });
    } catch (error) {
      const parsed = toPanelError(error, "حذف امتحان انجام نشد");
      pushToast({ tone: "error", title: "حذف ناموفق بود", description: parsed.message });
    }
  }

  const titleError = fieldError(formError?.fieldErrors ?? {}, "title");
  const examDateError = fieldError(formError?.fieldErrors ?? {}, "examDate");

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">امتحانات</h2>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          امتحان جدید
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>لیست امتحانات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input placeholder="جستجوی امتحان" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "" | ExamStatus)}
            >
              <option value="">{examStatusLabel("")}</option>
              {examStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {examStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex min-h-24 items-center justify-center">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">امتحانی پیدا نشد.</p>
          ) : (
            <div className="space-y-3">
              {items.map((exam) => (
                <article key={exam.id} className="rounded-md border border-border/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{exam.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(exam.examDate)}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="secondary">{examTypeLabel(exam.examType)}</Badge>
                        <Badge variant="outline">{examStatusLabel(exam.status)}</Badge>
                        {exam.course && <Badge variant="outline">{exam.course.name}</Badge>}
                        {exam.location && <Badge variant="outline">{exam.location}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={exam.status}
                        onChange={(event) => updateExam(exam.id, { status: event.target.value as ExamStatus })}
                      >
                        {examStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {examStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                      <Button type="button" variant="outline" size="icon" onClick={() => updateExam(exam.id, { isPinned: !exam.isPinned })}>
                        <Pin className={`h-4 w-4 ${exam.isPinned ? "fill-current" : ""}`} />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeExam(exam.id)}>
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ایجاد امتحان" description="ایجاد امتحان در پنجره پاپ آپ">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={createExam}>
          <div className="space-y-2 md:col-span-2">
            <Label>عنوان</Label>
            <Input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} aria-invalid={Boolean(titleError)} required />
            {titleError && <p className="text-xs text-destructive">{titleError}</p>}
          </div>

          <div className="space-y-2">
            <Label>ترم</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.semesterId}
              onChange={(event) => setForm((prev) => ({ ...prev, semesterId: event.target.value, courseId: "" }))}
            >
              <option value="">هیچ کدام</option>
              {semesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>درس</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.courseId}
              onChange={(event) => setForm((prev) => ({ ...prev, courseId: event.target.value }))}
            >
              <option value="">هیچ کدام</option>
              {availableCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>نوع</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.examType}
              onChange={(event) => setForm((prev) => ({ ...prev, examType: event.target.value as ExamType }))}
            >
              {examTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {examTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>وضعیت</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as ExamStatus }))}
            >
              {examStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {examStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>تاریخ امتحان (شمسی)</Label>
            <PersianDateInput
              value={form.examDate}
              onChange={(value) => setForm((prev) => ({ ...prev, examDate: value }))}
              ariaInvalid={Boolean(examDateError)}
              required
              placeholder="انتخاب تاریخ"
            />
            {examDateError && <p className="text-xs text-destructive">{examDateError}</p>}
          </div>

          <div className="space-y-2">
            <Label>ساعت شروع</Label>
            <Input type="time" value={form.startTime} onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>مدت زمان (دقیقه)</Label>
            <Input
              type="number"
              min={0}
              max={600}
              value={form.durationMinutes}
              onChange={(event) => setForm((prev) => ({ ...prev, durationMinutes: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>مکان</Label>
            <Input value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>یادداشت</Label>
            <Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </div>

          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={form.isPinned} onChange={(event) => setForm((prev) => ({ ...prev, isPinned: event.target.checked }))} />
            سنجاق کردن امتحان
          </label>

          <div className="md:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
              ایجاد امتحان
            </Button>
          </div>
        </form>
      </Modal>

      {conflictDialog}
      {deleteConfirmDialog}
    </section>
  );
}

