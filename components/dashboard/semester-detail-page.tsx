
"use client";

import type React from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Download,
  Edit3,
  ExternalLink,
  LoaderCircle,
  Pin,
  Plus,
  PlusCircle,
  Save,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import { ApiClientError, apiFetch, apiFetchForm } from "@/lib/client-api";
import { formatDate, formatDateTime, weekdayLabel } from "@/lib/fa";
import { fieldError, toPanelError, type PanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";
import { useConflictConfirm } from "@/lib/use-conflict-confirm";
import { formatFileSize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Course, CourseSession, FileItem, ScheduleConflict, Semester, Weekday } from "@/types/dashboard";

type Props = { semesterId: string };
type CourseListResponse = { items: Course[]; total: number };
type FileListResponse = { items: FileItem[]; total: number };

type SessionDraft = {
  weekday: Weekday;
  startTime: string;
  endTime: string;
  room: string;
};

type CourseFormState = {
  name: string;
  code: string;
  instructor: string;
  location: string;
  credits: string;
  color: string;
  isPinned: boolean;
};

const weekdayOptions: Weekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const initialCourseForm: CourseFormState = {
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

function mapCourseToForm(course: Course): CourseFormState {
  return {
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

  return sessions.map((session) => ({
    weekday: session.weekday,
    startTime: session.startTime,
    endTime: session.endTime,
    room: session.room ?? "",
  }));
}

function buildCoursePayload(semesterId: string, form: CourseFormState, sessions: SessionDraft[], allowConflicts: boolean) {
  return {
    semesterId,
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

function SessionsEditor({ sessions, onChange }: { sessions: SessionDraft[]; onChange: (next: SessionDraft[]) => void }) {
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

export function SemesterDetailPage({ semesterId }: Props) {
  const router = useRouter();
  const { requestConfirm, conflictDialog } = useConflictConfirm();
  const uploadSectionRef = useRef<HTMLDivElement | null>(null);

  const [semester, setSemester] = useState<Semester | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileQuery, setFileQuery] = useState("");
  const [courseFileFilter, setCourseFileFilter] = useState("");

  const [savingCourse, setSavingCourse] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [courseFormError, setCourseFormError] = useState<PanelError | null>(null);
  const [editFormError, setEditFormError] = useState<PanelError | null>(null);
  const [uploadFormError, setUploadFormError] = useState<PanelError | null>(null);

  const [courseForm, setCourseForm] = useState<CourseFormState>(initialCourseForm);
  const [courseSessions, setCourseSessions] = useState<SessionDraft[]>(initialSessions);

  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CourseFormState>(initialCourseForm);
  const [editSessions, setEditSessions] = useState<SessionDraft[]>(initialSessions);

  const [uploadForm, setUploadForm] = useState({ courseId: "", isPinned: false, tags: "" });

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      const semesters = await apiFetch<Semester[]>("/api/v1/semesters");
      const found = semesters.find((item) => item.id === semesterId) ?? null;
      if (!found) {
        setSemester(null);
        return;
      }
      setSemester(found);

      const fileParams = new URLSearchParams({ semesterId, limit: "200", offset: "0" });
      if (fileQuery.trim()) fileParams.set("q", fileQuery.trim());
      if (courseFileFilter) fileParams.set("courseId", courseFileFilter);

      const [courseData, fileData] = await Promise.all([
        apiFetch<CourseListResponse>(`/api/v1/courses?semesterId=${semesterId}&limit=200&offset=0`),
        apiFetch<FileListResponse>(`/api/v1/files?${fileParams.toString()}`),
      ]);

      setCourses(courseData.items);
      setFiles(fileData.items);
    } catch (error) {
      const parsed = toPanelError(error, "بارگذاری جزئیات ترم انجام نشد");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({ tone: "error", title: "بارگذاری ناموفق بود", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }, [courseFileFilter, fileQuery, router, semesterId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useRealtime({
    onMessage: (message) => {
      if (["semester.updated", "course.created", "course.updated", "course.deleted", "file.created", "file.updated", "file.deleted"].includes(message.type)) {
        loadDetail();
      }
    },
  });

  async function submitCreate(allowConflicts: boolean) {
    return apiFetch<Course>("/api/v1/courses", {
      method: "POST",
      body: JSON.stringify(buildCoursePayload(semesterId, courseForm, courseSessions, allowConflicts)),
    });
  }

  async function createCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCourse(true);
    setCourseFormError(null);
    try {
      await submitCreate(false);
      setCourseForm(initialCourseForm);
      setCourseSessions(initialSessions);
      pushToast({ tone: "success", title: "درس ایجاد شد" });
      await loadDetail();
    } catch (error) {
      const conflicts = extractConflicts(error);
      if (conflicts.length > 0) {
        const shouldContinue = await requestConfirm(conflicts);
        if (shouldContinue) {
        try {
          await submitCreate(true);
          setCourseForm(initialCourseForm);
          setCourseSessions(initialSessions);
          pushToast({ tone: "success", title: "درس با وجود تداخل ایجاد شد" });
          await loadDetail();
          setSavingCourse(false);
          return;
        } catch (retryError) {
          const parsedRetry = toPanelError(retryError, "ایجاد درس انجام نشد");
          setCourseFormError(parsedRetry);
          pushToast({ tone: "error", title: "ایجاد ناموفق بود", description: parsedRetry.message });
          setSavingCourse(false);
          return;
        }
        }
      }

      const parsed = toPanelError(error, "ایجاد درس انجام نشد");
      setCourseFormError(parsed);
      pushToast({ tone: "error", title: "ایجاد ناموفق بود", description: parsed.message });
    } finally {
      setSavingCourse(false);
    }
  }

  function openEdit(course: Course) {
    setEditingCourseId(course.id);
    setEditForm(mapCourseToForm(course));
    setEditSessions(mapCourseSessions(course));
    setEditFormError(null);
  }

  function closeEdit() {
    setEditingCourseId(null);
    setEditForm(initialCourseForm);
    setEditSessions(initialSessions);
    setEditFormError(null);
  }

  async function submitEdit(allowConflicts: boolean) {
    if (!editingCourseId) return null;
    return apiFetch<Course>(`/api/v1/courses/${editingCourseId}`, {
      method: "PATCH",
      body: JSON.stringify(buildCoursePayload(semesterId, editForm, editSessions, allowConflicts)),
    });
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCourseId) return;

    setEditSaving(true);
    setEditFormError(null);

    try {
      const updated = await submitEdit(false);
      if (updated) {
        setCourses((prev) => prev.map((course) => (course.id === updated.id ? updated : course)));
      }
      closeEdit();
      pushToast({ tone: "success", title: "درس بروزرسانی شد" });
      await loadDetail();
    } catch (error) {
      const conflicts = extractConflicts(error);
      if (conflicts.length > 0) {
        const shouldContinue = await requestConfirm(conflicts);
        if (shouldContinue) {
        try {
          const updated = await submitEdit(true);
          if (updated) {
            setCourses((prev) => prev.map((course) => (course.id === updated.id ? updated : course)));
          }
          closeEdit();
          pushToast({ tone: "success", title: "بروزرسانی با وجود تداخل انجام شد" });
          await loadDetail();
          setEditSaving(false);
          return;
        } catch (retryError) {
          const parsedRetry = toPanelError(retryError, "بروزرسانی درس انجام نشد");
          setEditFormError(parsedRetry);
          pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsedRetry.message });
          setEditSaving(false);
          return;
        }
        }
      }

      const parsed = toPanelError(error, "بروزرسانی درس انجام نشد");
      setEditFormError(parsed);
      pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsed.message });
    } finally {
      setEditSaving(false);
    }
  }

  async function toggleCoursePin(course: Course) {
    try {
      await apiFetch<Course>(`/api/v1/courses/${course.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPinned: !course.isPinned }),
      });
      await loadDetail();
    } catch (error) {
      const parsed = toPanelError(error, "بروزرسانی درس انجام نشد");
      pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsed.message });
    }
  }

  async function removeCourse(courseId: string) {
    if (!window.confirm("این درس حذف شود؟")) return;

    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/courses/${courseId}`, { method: "DELETE" });
      pushToast({ tone: "success", title: "درس حذف شد" });
      if (uploadForm.courseId === courseId) setUploadForm((prev) => ({ ...prev, courseId: "" }));
      if (editingCourseId === courseId) closeEdit();
      await loadDetail();
    } catch (error) {
      const parsed = toPanelError(error, "حذف درس انجام نشد");
      pushToast({ tone: "error", title: "حذف ناموفق بود", description: parsed.message });
    }
  }

  async function uploadSemesterFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile) {
      setUploadFormError({
        message: "ابتدا یک فایل انتخاب کنید.",
        code: "FILE_REQUIRED",
        details: [],
        fieldErrors: { file: ["ابتدا یک فایل انتخاب کنید."] },
        status: 400,
      });
      return;
    }

    setUploading(true);
    setUploadFormError(null);
    try {
      const formData = new FormData();
      formData.set("file", uploadFile);
      formData.set("semesterId", semesterId);
      if (uploadForm.courseId) formData.set("courseId", uploadForm.courseId);
      if (uploadForm.isPinned) formData.set("isPinned", "true");
      if (uploadForm.tags.trim()) formData.set("tags", uploadForm.tags.trim());

      await apiFetchForm<FileItem>("/api/v1/files", formData, { method: "POST" });

      setUploadFile(null);
      setUploadForm({ courseId: "", isPinned: false, tags: "" });
      pushToast({ tone: "success", title: "فایل آپلود شد" });
      await loadDetail();
    } catch (error) {
      const parsed = toPanelError(error, "آپلود فایل انجام نشد");
      setUploadFormError(parsed);
      pushToast({ tone: "error", title: "آپلود ناموفق بود", description: parsed.message });
    } finally {
      setUploading(false);
    }
  }

  function selectCourseForUpload(courseId: string) {
    setUploadForm((prev) => ({ ...prev, courseId }));
    uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const courseNameError = fieldError(courseFormError?.fieldErrors ?? {}, "name");
  const createSessionError = fieldError(courseFormError?.fieldErrors ?? {}, "sessions.0.endTime") || fieldError(courseFormError?.fieldErrors ?? {}, "sessions.0.startTime");
  const editNameError = fieldError(editFormError?.fieldErrors ?? {}, "name");
  const editSessionError = fieldError(editFormError?.fieldErrors ?? {}, "sessions.0.endTime") || fieldError(editFormError?.fieldErrors ?? {}, "sessions.0.startTime");
  const uploadFileError = fieldError(uploadFormError?.fieldErrors ?? {}, "file");

  const selectedCourseLabel = useMemo(() => {
    if (!uploadForm.courseId) return "برای کل ترم";
    const found = courses.find((item) => item.id === uploadForm.courseId);
    return found ? `برای درس: ${found.name}` : "برای کل ترم";
  }, [courses, uploadForm.courseId]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!semester) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">ترم پیدا نشد</h2>
        <p className="text-sm text-muted-foreground">ممکن است این ترم حذف شده باشد.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/semesters">بازگشت به ترم ها</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{semester.title}</h2>
          <p className="text-sm text-muted-foreground">
            بازه زمانی: {formatDate(semester.startDate)} تا {formatDate(semester.endDate)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/semesters">
              <ArrowRight className="me-2 h-4 w-4" />
              بازگشت به ترم ها
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dashboard/files?semesterId=${semester.id}`}>
              <ExternalLink className="me-2 h-4 w-4" />
              مدیریت فایل ها
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>درس های ترم</CardTitle>
          <CardDescription>ایجاد و مدیریت درس و جلسه های کلاسی بدون پاپ آپ</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createCourse}>
            <div className="space-y-2 md:col-span-2">
              <Label>نام درس</Label>
              <Input
                value={courseForm.name}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, name: event.target.value }))}
                aria-invalid={Boolean(courseNameError)}
                required
              />
              {courseNameError && <p className="text-xs text-destructive">{courseNameError}</p>}
            </div>

            <div className="space-y-2">
              <Label>کد</Label>
              <Input value={courseForm.code} onChange={(event) => setCourseForm((prev) => ({ ...prev, code: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>استاد</Label>
              <Input value={courseForm.instructor} onChange={(event) => setCourseForm((prev) => ({ ...prev, instructor: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>مکان</Label>
              <Input value={courseForm.location} onChange={(event) => setCourseForm((prev) => ({ ...prev, location: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>واحد</Label>
              <Input type="number" min={0} max={30} value={courseForm.credits} onChange={(event) => setCourseForm((prev) => ({ ...prev, credits: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>رنگ</Label>
              <Input type="color" value={courseForm.color} onChange={(event) => setCourseForm((prev) => ({ ...prev, color: event.target.value }))} />
            </div>

            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={courseForm.isPinned} onChange={(event) => setCourseForm((prev) => ({ ...prev, isPinned: event.target.checked }))} />
              سنجاق کردن درس
            </label>

            <SessionsEditor sessions={courseSessions} onChange={setCourseSessions} />
            {createSessionError && <p className="text-xs text-destructive md:col-span-2">{createSessionError}</p>}

            <div className="md:col-span-2">
              <Button type="submit" disabled={savingCourse}>
                {savingCourse ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
                ایجاد درس
              </Button>
            </div>
          </form>

          <div className="mt-6 space-y-3">
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">هنوز درسی ثبت نشده است.</p>
            ) : (
              courses.map((course) => {
                const isEditing = editingCourseId === course.id;
                const sessions = (course.sessions as CourseSession[] | undefined) ?? [];

                return (
                  <article key={course.id} className="rounded-md border border-border/80 bg-background p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{course.name} {course.code ? `(${course.code})` : ""}</p>
                        <p className="text-xs text-muted-foreground">{course.instructor ?? "بدون استاد"} | {course.location ?? "بدون مکان"}</p>
                        <p className="text-xs text-muted-foreground">فایل ها: {course._count?.files ?? 0} | جلسات: {sessions.length}</p>
                        {sessions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {sessions.map((session) => (
                              <span key={session.id} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px]">
                                {weekdayLabel(session.weekday)} {session.startTime}-{session.endTime}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => selectCourseForUpload(course.id)}>آپلود فایل برای این درس</Button>
                        <Button type="button" variant="outline" size="icon" onClick={() => openEdit(course)}><Edit3 className="h-4 w-4" /></Button>
                        <Button type="button" variant="outline" size="icon" onClick={() => toggleCoursePin(course)}><Pin className={`h-4 w-4 ${course.isPinned ? "fill-current" : ""}`} /></Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeCourse(course.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>

                    {isEditing && (
                      <form className="mt-4 grid gap-3 rounded-md border border-border/70 p-3 md:grid-cols-2" onSubmit={saveEdit}>
                        <div className="space-y-2 md:col-span-2">
                          <Label>نام درس</Label>
                          <Input value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} aria-invalid={Boolean(editNameError)} required />
                          {editNameError && <p className="text-xs text-destructive">{editNameError}</p>}
                        </div>

                        <div className="space-y-2"><Label>کد</Label><Input value={editForm.code} onChange={(event) => setEditForm((prev) => ({ ...prev, code: event.target.value }))} /></div>
                        <div className="space-y-2"><Label>استاد</Label><Input value={editForm.instructor} onChange={(event) => setEditForm((prev) => ({ ...prev, instructor: event.target.value }))} /></div>
                        <div className="space-y-2"><Label>مکان</Label><Input value={editForm.location} onChange={(event) => setEditForm((prev) => ({ ...prev, location: event.target.value }))} /></div>
                        <div className="space-y-2"><Label>واحد</Label><Input type="number" min={0} max={30} value={editForm.credits} onChange={(event) => setEditForm((prev) => ({ ...prev, credits: event.target.value }))} /></div>
                        <div className="space-y-2"><Label>رنگ</Label><Input type="color" value={editForm.color} onChange={(event) => setEditForm((prev) => ({ ...prev, color: event.target.value }))} /></div>

                        <label className="flex items-center gap-2 text-sm md:col-span-2">
                          <input type="checkbox" checked={editForm.isPinned} onChange={(event) => setEditForm((prev) => ({ ...prev, isPinned: event.target.checked }))} />
                          سنجاق کردن درس
                        </label>

                        <SessionsEditor sessions={editSessions} onChange={setEditSessions} />
                        {editSessionError && <p className="text-xs text-destructive md:col-span-2">{editSessionError}</p>}

                        <div className="flex gap-2 md:col-span-2">
                          <Button type="submit" disabled={editSaving}>{editSaving ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}ذخیره تغییرات</Button>
                          <Button type="button" variant="outline" onClick={closeEdit}><X className="me-2 h-4 w-4" />انصراف</Button>
                        </div>
                      </form>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Card ref={uploadSectionRef}>
        <CardHeader>
          <CardTitle>آپلود مستقیم فایل</CardTitle>
          <CardDescription>{selectedCourseLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={uploadSemesterFile}>
            <div className="space-y-2 md:col-span-2">
              <Label>فایل</Label>
              <Input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} required />
              {uploadFileError && <p className="text-xs text-destructive">{uploadFileError}</p>}
            </div>

            <div className="space-y-2">
              <Label>درس (اختیاری)</Label>
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={uploadForm.courseId} onChange={(event) => setUploadForm((prev) => ({ ...prev, courseId: event.target.value }))}>
                <option value="">برای کل ترم</option>
                {courses.map((course) => (<option key={course.id} value={course.id}>{course.name}</option>))}
              </select>
            </div>

            <div className="space-y-2"><Label>برچسب ها</Label><Input value={uploadForm.tags} onChange={(event) => setUploadForm((prev) => ({ ...prev, tags: event.target.value }))} placeholder="جزوه، تمرین، مهم" /></div>

            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={uploadForm.isPinned} onChange={(event) => setUploadForm((prev) => ({ ...prev, isPinned: event.target.checked }))} />
              سنجاق کردن فایل
            </label>

            <div className="md:col-span-2">
              <Button type="submit" disabled={uploading}>{uploading ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <UploadCloud className="me-2 h-4 w-4" />}آپلود</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>فایل های ترم</CardTitle>
          <CardDescription>جستجو و فیلتر بر اساس درس</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_260px]">
            <Input placeholder="جستجو در فایل های ترم" value={fileQuery} onChange={(event) => setFileQuery(event.target.value)} />
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={courseFileFilter} onChange={(event) => setCourseFileFilter(event.target.value)}>
              <option value="">همه درس ها</option>
              {courses.map((course) => (<option key={course.id} value={course.id}>{course.name}</option>))}
            </select>
          </div>

          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">فایلی ثبت نشده است.</p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <article key={file.id} className="rounded-md border border-border/80 bg-background p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{file.originalName}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)} | {file.mimeType}</p>
                      <p className="text-xs text-muted-foreground">{file.course ? `درس: ${file.course.name}` : "بدون درس"} | {formatDateTime(file.createdAt)}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button asChild type="button" size="icon" variant="outline"><a href={`/api/v1/files/${file.id}/preview`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                      <Button asChild type="button" size="icon" variant="outline"><a href={`/api/v1/files/${file.id}/download`}><Download className="h-4 w-4" /></a></Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {conflictDialog}
    </section>
  );
}

