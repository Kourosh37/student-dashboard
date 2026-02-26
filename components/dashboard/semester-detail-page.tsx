"use client";

import type React from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Download,
  ExternalLink,
  LoaderCircle,
  Pin,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, apiFetchForm } from "@/lib/client-api";
import { formatDate, formatDateTime } from "@/lib/fa";
import { fieldError, toPanelError, type PanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";
import { formatFileSize } from "@/lib/utils";
import type { Course, FileItem, Semester } from "@/types/dashboard";

type Props = {
  semesterId: string;
};

type CourseListResponse = { items: Course[]; total: number };
type FileListResponse = { items: FileItem[]; total: number };

export function SemesterDetailPage({ semesterId }: Props) {
  const router = useRouter();
  const uploadSectionRef = useRef<HTMLDivElement | null>(null);

  const [semester, setSemester] = useState<Semester | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileQuery, setFileQuery] = useState("");
  const [courseFileFilter, setCourseFileFilter] = useState("");

  const [savingCourse, setSavingCourse] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [courseFormError, setCourseFormError] = useState<PanelError | null>(null);
  const [uploadFormError, setUploadFormError] = useState<PanelError | null>(null);

  const [courseForm, setCourseForm] = useState({
    name: "",
    code: "",
    instructor: "",
    location: "",
    credits: "",
    color: "#0F766E",
    isPinned: false,
  });

  const [uploadForm, setUploadForm] = useState({
    courseId: "",
    isPinned: false,
    tags: "",
  });

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

      const fileParams = new URLSearchParams({
        semesterId,
        limit: "200",
        offset: "0",
      });
      if (fileQuery.trim()) fileParams.set("q", fileQuery.trim());
      if (courseFileFilter) fileParams.set("courseId", courseFileFilter);

      const [courseData, fileData] = await Promise.all([
        apiFetch<CourseListResponse>(`/api/v1/courses?semesterId=${semesterId}&limit=200&offset=0`),
        apiFetch<FileListResponse>(`/api/v1/files?${fileParams.toString()}`),
      ]);

      setCourses(courseData.items);
      setFiles(fileData.items);
    } catch (err) {
      const parsed = toPanelError(err, "بارگذاری جزئیات ترم انجام نشد");
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
      if (
        ["semester.updated", "course.created", "course.updated", "course.deleted", "file.created", "file.updated", "file.deleted"].includes(
          message.type,
        )
      ) {
        loadDetail();
      }
    },
  });

  async function createCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCourse(true);
    setCourseFormError(null);

    try {
      await apiFetch<Course>("/api/v1/courses", {
        method: "POST",
        body: JSON.stringify({
          semesterId,
          ...courseForm,
          code: courseForm.code || null,
          instructor: courseForm.instructor || null,
          location: courseForm.location || null,
          credits: courseForm.credits ? Number(courseForm.credits) : null,
          sessions: [],
        }),
      });

      setCourseForm({
        name: "",
        code: "",
        instructor: "",
        location: "",
        credits: "",
        color: "#0F766E",
        isPinned: false,
      });
      pushToast({ tone: "success", title: "درس ایجاد شد" });
      await loadDetail();
    } catch (err) {
      const parsed = toPanelError(err, "ایجاد درس انجام نشد");
      setCourseFormError(parsed);
      pushToast({ tone: "error", title: "ایجاد ناموفق بود", description: parsed.message });
    } finally {
      setSavingCourse(false);
    }
  }

  async function toggleCoursePin(course: Course) {
    try {
      await apiFetch<Course>(`/api/v1/courses/${course.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPinned: !course.isPinned }),
      });
      await loadDetail();
    } catch (err) {
      const parsed = toPanelError(err, "بروزرسانی درس انجام نشد");
      pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsed.message });
    }
  }

  async function removeCourse(courseId: string) {
    if (!window.confirm("این درس حذف شود؟")) return;

    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/courses/${courseId}`, { method: "DELETE" });
      pushToast({ tone: "success", title: "درس حذف شد" });
      if (uploadForm.courseId === courseId) {
        setUploadForm((prev) => ({ ...prev, courseId: "" }));
      }
      await loadDetail();
    } catch (err) {
      const parsed = toPanelError(err, "حذف درس انجام نشد");
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
    } catch (err) {
      const parsed = toPanelError(err, "آپلود فایل انجام نشد");
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
          <CardDescription>ایجاد درس جدید بدون پاپ آپ</CardDescription>
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
              <Input
                value={courseForm.instructor}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, instructor: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>مکان</Label>
              <Input value={courseForm.location} onChange={(event) => setCourseForm((prev) => ({ ...prev, location: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>واحد</Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={courseForm.credits}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, credits: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>رنگ</Label>
              <Input
                type="color"
                value={courseForm.color}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, color: event.target.value }))}
              />
            </div>

            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={courseForm.isPinned}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, isPinned: event.target.checked }))}
              />
              سنجاق کردن درس
            </label>

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
              courses.map((course) => (
                <article key={course.id} className="rounded-md border border-border/80 bg-background p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {course.name} {course.code ? `(${course.code})` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {course.instructor ?? "بدون استاد"} | {course.location ?? "بدون مکان"}
                      </p>
                      <p className="text-xs text-muted-foreground">فایل ها: {course._count?.files ?? 0}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => selectCourseForUpload(course.id)}>
                        آپلود فایل برای این درس
                      </Button>
                      <Button type="button" variant="outline" size="icon" onClick={() => toggleCoursePin(course)}>
                        <Pin className={`h-4 w-4 ${course.isPinned ? "fill-current" : ""}`} />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeCourse(course.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </article>
              ))
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
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={uploadForm.courseId}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, courseId: event.target.value }))}
              >
                <option value="">برای کل ترم</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>برچسب ها</Label>
              <Input
                value={uploadForm.tags}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="جزوه، تمرین، مهم"
              />
            </div>

            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={uploadForm.isPinned}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, isPinned: event.target.checked }))}
              />
              سنجاق کردن فایل
            </label>

            <div className="md:col-span-2">
              <Button type="submit" disabled={uploading}>
                {uploading ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <UploadCloud className="me-2 h-4 w-4" />}
                آپلود
              </Button>
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
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={courseFileFilter}
              onChange={(event) => setCourseFileFilter(event.target.value)}
            >
              <option value="">همه درس ها</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
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
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)} | {file.mimeType}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {file.course ? `درس: ${file.course.name}` : "بدون درس"} | {formatDateTime(file.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button asChild type="button" size="icon" variant="outline">
                        <a href={`/api/v1/files/${file.id}/preview`} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button asChild type="button" size="icon" variant="outline">
                        <a href={`/api/v1/files/${file.id}/download`}>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
