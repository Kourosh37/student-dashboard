"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, LoaderCircle, Pin, Plus, PlusCircle, Trash2 } from "lucide-react";

import { ApiClientError, apiFetch } from "@/lib/client-api";
import { weekdayLabel } from "@/lib/fa";
import { fieldError, toPanelError, type PanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import type { Course, CourseSession, ScheduleConflict, Semester, Weekday } from "@/types/dashboard";

const weekdayOptions: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

type CourseListResponse = {
  items: Course[];
  total: number;
};

type SessionDraft = {
  weekday: Weekday;
  startTime: string;
  endTime: string;
  room: string;
};

type CourseFormState = {
  semesterId: string;
  name: string;
  code: string;
  instructor: string;
  location: string;
  credits: string;
  color: string;
  isPinned: boolean;
};

const initialForm: CourseFormState = {
  semesterId: "",
  name: "",
  code: "",
  instructor: "",
  location: "",
  credits: "",
  color: "#0F766E",
  isPinned: false,
};

const initialSessions: SessionDraft[] = [{ weekday: "MONDAY", startTime: "09:00", endTime: "10:30", room: "" }];

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

function mapCourseToForm(course: Course): CourseFormState {
  return {
    semesterId: course.semesterId,
    name: course.name,
    code: course.code ?? "",
    instructor: course.instructor ?? "",
    location: course.location ?? "",
    credits: course.credits === null ? "" : String(course.credits),
    color: course.color ?? "#0F766E",
    isPinned: course.isPinned,
  };
}

function mapCourseSessions(course: Course): SessionDraft[] {
  const sessions = (course.sessions as CourseSession[] | undefined) ?? [];
  if (sessions.length === 0) return initialSessions;

  return sessions.map((item) => ({
    weekday: item.weekday,
    startTime: item.startTime,
    endTime: item.endTime,
    room: item.room ?? "",
  }));
}

function buildPayload(form: CourseFormState, sessions: SessionDraft[], allowConflicts: boolean) {
  return {
    semesterId: form.semesterId,
    name: form.name,
    code: form.code || null,
    instructor: form.instructor || null,
    location: form.location || null,
    credits: form.credits ? Number(form.credits) : null,
    color: form.color || null,
    isPinned: form.isPinned,
    sessions: sessions.map((session) => ({
      weekday: session.weekday,
      startTime: session.startTime,
      endTime: session.endTime,
      room: session.room || null,
    })),
    allowConflicts,
  };
}

function SessionsEditor({
  sessions,
  onChange,
}: {
  sessions: SessionDraft[];
  onChange: (next: SessionDraft[]) => void;
}) {
  return (
    <div className="space-y-3 md:col-span-2">
      <div className="flex items-center justify-between">
        <Label>جلسه های کلاسی</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...sessions, { weekday: "MONDAY", startTime: "09:00", endTime: "10:00", room: "" }])}
        >
          <PlusCircle className="me-2 h-4 w-4" />
          افزودن جلسه
        </Button>
      </div>

      <div className="space-y-2">
        {sessions.map((session, index) => (
          <div key={`${session.weekday}-${index}`} className="grid gap-2 rounded-md border border-border/70 p-3 md:grid-cols-5">
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={session.weekday}
              onChange={(event) =>
                onChange(sessions.map((entry, i) => (i === index ? { ...entry, weekday: event.target.value as Weekday } : entry)))
              }
            >
              {weekdayOptions.map((weekday) => (
                <option key={weekday} value={weekday}>
                  {weekdayLabel(weekday)}
                </option>
              ))}
            </select>

            <Input
              type="time"
              value={session.startTime}
              onChange={(event) =>
                onChange(sessions.map((entry, i) => (i === index ? { ...entry, startTime: event.target.value } : entry)))
              }
            />

            <Input
              type="time"
              value={session.endTime}
              onChange={(event) =>
                onChange(sessions.map((entry, i) => (i === index ? { ...entry, endTime: event.target.value } : entry)))
              }
            />

            <Input
              placeholder="کلاس"
              value={session.room}
              onChange={(event) =>
                onChange(sessions.map((entry, i) => (i === index ? { ...entry, room: event.target.value } : entry)))
              }
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(sessions.filter((_, i) => i !== index))}
              disabled={sessions.length === 1}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CoursesPanel() {
  const router = useRouter();

  const [items, setItems] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);

  const [createSaving, setCreateSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [createError, setCreateError] = useState<PanelError | null>(null);
  const [editError, setEditError] = useState<PanelError | null>(null);

  const [query, setQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");

  const [createForm, setCreateForm] = useState<CourseFormState>(initialForm);
  const [createSessions, setCreateSessions] = useState<SessionDraft[]>(initialSessions);

  const [editOpen, setEditOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CourseFormState>(initialForm);
  const [editSessions, setEditSessions] = useState<SessionDraft[]>(initialSessions);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "150");
      params.set("offset", "0");
      if (query.trim()) params.set("q", query.trim());
      if (semesterFilter) params.set("semesterId", semesterFilter);

      const [coursesData, semesterData] = await Promise.all([
        apiFetch<CourseListResponse>(`/api/v1/courses?${params.toString()}`),
        apiFetch<Semester[]>("/api/v1/semesters"),
      ]);
      setItems(coursesData.items);
      setSemesters(semesterData);
    } catch (error) {
      const parsed = toPanelError(error, "بارگذاری درس ها انجام نشد");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({ tone: "error", title: "بارگذاری ناموفق بود", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }, [query, semesterFilter, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtime({
    onMessage: (message) => {
      const watched = ["course.created", "course.updated", "course.deleted", "semester.updated"];
      if (watched.includes(message.type)) {
        loadData();
      }
    },
  });

  const filteredSemesters = useMemo(() => semesters, [semesters]);

  async function submitCreate(allowConflicts: boolean) {
    return apiFetch<Course>("/api/v1/courses", {
      method: "POST",
      body: JSON.stringify(buildPayload(createForm, createSessions, allowConflicts)),
    });
  }

  async function createCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateSaving(true);
    setCreateError(null);

    try {
      await submitCreate(false);
      setCreateForm(initialForm);
      setCreateSessions(initialSessions);
      pushToast({ tone: "success", title: "درس ایجاد شد" });
      await loadData();
    } catch (error) {
      const conflicts = extractConflicts(error);
      if (conflicts.length > 0 && askConflictOverride(conflicts)) {
        try {
          await submitCreate(true);
          setCreateForm(initialForm);
          setCreateSessions(initialSessions);
          pushToast({ tone: "success", title: "درس با وجود تداخل ایجاد شد" });
          await loadData();
          setCreateSaving(false);
          return;
        } catch (retryError) {
          const parsedRetry = toPanelError(retryError, "ایجاد درس انجام نشد");
          setCreateError(parsedRetry);
          pushToast({ tone: "error", title: "ایجاد ناموفق بود", description: parsedRetry.message });
          setCreateSaving(false);
          return;
        }
      }

      const parsed = toPanelError(error, "ایجاد درس انجام نشد");
      setCreateError(parsed);
      pushToast({ tone: "error", title: "ایجاد ناموفق بود", description: parsed.message });
    } finally {
      setCreateSaving(false);
    }
  }

  function openEdit(course: Course) {
    setEditingCourseId(course.id);
    setEditForm(mapCourseToForm(course));
    setEditSessions(mapCourseSessions(course));
    setEditError(null);
    setEditOpen(true);
  }

  async function submitEdit(allowConflicts: boolean) {
    if (!editingCourseId) return null;

    return apiFetch<Course>(`/api/v1/courses/${editingCourseId}`, {
      method: "PATCH",
      body: JSON.stringify(buildPayload(editForm, editSessions, allowConflicts)),
    });
  }

  async function updateCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCourseId) return;

    setEditSaving(true);
    setEditError(null);

    try {
      const updated = await submitEdit(false);
      if (updated) {
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }
      setEditOpen(false);
      setEditingCourseId(null);
      pushToast({ tone: "success", title: "درس بروزرسانی شد" });
      await loadData();
    } catch (error) {
      const conflicts = extractConflicts(error);
      if (conflicts.length > 0 && askConflictOverride(conflicts)) {
        try {
          const updated = await submitEdit(true);
          if (updated) {
            setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
          }
          setEditOpen(false);
          setEditingCourseId(null);
          pushToast({ tone: "success", title: "بروزرسانی با وجود تداخل انجام شد" });
          await loadData();
          setEditSaving(false);
          return;
        } catch (retryError) {
          const parsedRetry = toPanelError(retryError, "بروزرسانی درس انجام نشد");
          setEditError(parsedRetry);
          pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsedRetry.message });
          setEditSaving(false);
          return;
        }
      }

      const parsed = toPanelError(error, "بروزرسانی درس انجام نشد");
      setEditError(parsed);
      pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsed.message });
    } finally {
      setEditSaving(false);
    }
  }

  async function togglePin(item: Course) {
    try {
      const updated = await apiFetch<Course>(`/api/v1/courses/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isPinned: !item.isPinned,
        }),
      });
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? updated : entry)));
    } catch (error) {
      const parsed = toPanelError(error, "بروزرسانی درس انجام نشد");
      pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsed.message });
    }
  }

  async function removeCourse(id: string) {
    if (!window.confirm("این درس حذف شود؟")) return;

    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/courses/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      const parsed = toPanelError(error, "حذف درس انجام نشد");
      pushToast({ tone: "error", title: "حذف ناموفق بود", description: parsed.message });
    }
  }

  const createNameError = fieldError(createError?.fieldErrors ?? {}, "name");
  const createSemesterError = fieldError(createError?.fieldErrors ?? {}, "semesterId");

  const editNameError = fieldError(editError?.fieldErrors ?? {}, "name");
  const editSemesterError = fieldError(editError?.fieldErrors ?? {}, "semesterId");

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">درس ها</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ایجاد درس</CardTitle>
          <CardDescription>افزودن درس و ساعت های کلاسی هفتگی</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createCourse}>
            <div className="space-y-2">
              <Label>ترم</Label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={createForm.semesterId}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, semesterId: event.target.value }))}
                required
              >
                <option value="">انتخاب ترم</option>
                {filteredSemesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.title}
                  </option>
                ))}
              </select>
              {createSemesterError && <p className="text-xs text-destructive">{createSemesterError}</p>}
            </div>

            <div className="space-y-2">
              <Label>نام درس</Label>
              <Input
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                aria-invalid={Boolean(createNameError)}
                required
              />
              {createNameError && <p className="text-xs text-destructive">{createNameError}</p>}
            </div>

            <div className="space-y-2">
              <Label>کد</Label>
              <Input value={createForm.code} onChange={(event) => setCreateForm((prev) => ({ ...prev, code: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>استاد</Label>
              <Input
                value={createForm.instructor}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, instructor: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>مکان</Label>
              <Input
                value={createForm.location}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, location: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>واحد</Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={createForm.credits}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, credits: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>رنگ</Label>
              <Input
                type="color"
                value={createForm.color}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, color: event.target.value }))}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createForm.isPinned}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, isPinned: event.target.checked }))}
              />
              سنجاق کردن درس
            </label>

            <SessionsEditor sessions={createSessions} onChange={setCreateSessions} />

            <div className="md:col-span-2">
              <Button type="submit" disabled={createSaving}>
                {createSaving ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
                ایجاد درس
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>لیست درس ها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_260px]">
            <Input placeholder="جستجوی درس" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={semesterFilter}
              onChange={(event) => setSemesterFilter(event.target.value)}
            >
              <option value="">همه ترم ها</option>
              {semesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.title}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex min-h-24 items-center justify-center">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">درسی پیدا نشد.</p>
          ) : (
            <div className="space-y-3">
              {items.map((course) => (
                <article key={course.id} className="rounded-md border border-border/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {course.name} {course.code ? `(${course.code})` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {course.semester?.title ?? "بدون ترم"} | {course.instructor ?? "بدون استاد"} | {course.location ?? "بدون مکان"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        جلسات: {(course.sessions as CourseSession[] | undefined)?.length ?? 0} | فایل ها: {course._count?.files ?? 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => openEdit(course)}>
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => togglePin(course)}>
                        <Pin className={`h-4 w-4 ${course.isPinned ? "fill-current" : ""}`} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeCourse(course.id)}>
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

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="ویرایش درس" description="ویرایش اطلاعات درس و جلسه های کلاسی">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={updateCourse}>
          <div className="space-y-2">
            <Label>ترم</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={editForm.semesterId}
              onChange={(event) => setEditForm((prev) => ({ ...prev, semesterId: event.target.value }))}
              required
            >
              <option value="">انتخاب ترم</option>
              {filteredSemesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.title}
                </option>
              ))}
            </select>
            {editSemesterError && <p className="text-xs text-destructive">{editSemesterError}</p>}
          </div>

          <div className="space-y-2">
            <Label>نام درس</Label>
            <Input
              value={editForm.name}
              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              aria-invalid={Boolean(editNameError)}
              required
            />
            {editNameError && <p className="text-xs text-destructive">{editNameError}</p>}
          </div>

          <div className="space-y-2">
            <Label>کد</Label>
            <Input value={editForm.code} onChange={(event) => setEditForm((prev) => ({ ...prev, code: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>استاد</Label>
            <Input
              value={editForm.instructor}
              onChange={(event) => setEditForm((prev) => ({ ...prev, instructor: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>مکان</Label>
            <Input
              value={editForm.location}
              onChange={(event) => setEditForm((prev) => ({ ...prev, location: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>واحد</Label>
            <Input
              type="number"
              min={0}
              max={30}
              value={editForm.credits}
              onChange={(event) => setEditForm((prev) => ({ ...prev, credits: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>رنگ</Label>
            <Input type="color" value={editForm.color} onChange={(event) => setEditForm((prev) => ({ ...prev, color: event.target.value }))} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editForm.isPinned} onChange={(event) => setEditForm((prev) => ({ ...prev, isPinned: event.target.checked }))} />
            سنجاق کردن درس
          </label>

          <SessionsEditor sessions={editSessions} onChange={setEditSessions} />

          <div className="md:col-span-2">
            <Button type="submit" disabled={editSaving}>
              {editSaving ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Edit3 className="me-2 h-4 w-4" />}
              ذخیره تغییرات
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
