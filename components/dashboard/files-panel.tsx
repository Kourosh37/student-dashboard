"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, FolderPlus, LoaderCircle, Pin, Save, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { apiFetch, apiFetchForm } from "@/lib/client-api";
import { fieldError, toPanelError, type PanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";
import { formatFileSize } from "@/lib/utils";
import type { Course, FileItem, Folder, PlannerItem, Semester } from "@/types/dashboard";

type FileListResponse = {
  items: FileItem[];
  total: number;
};

type CourseResponse = {
  items: Course[];
  total: number;
};

type PlannerResponse = {
  items: PlannerItem[];
  total: number;
};

type PreviewMeta = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  isPinned: boolean;
  tags: string[];
  previewType: "image" | "video" | "audio" | "pdf" | "text" | "office" | "binary";
  previewUrl: string;
  downloadUrl: string;
};

export function FilesPanel() {
  const router = useRouter();
  const { requestConfirm: requestDeleteConfirm, confirmDialog: deleteConfirmDialog } = useConfirmDialog();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [planner, setPlanner] = useState<PlannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewMeta | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [formError, setFormError] = useState<PanelError | null>(null);
  const [query, setQuery] = useState("");
  const [mimeGroupFilter, setMimeGroupFilter] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [uploadForm, setUploadForm] = useState({
    folderId: "",
    semesterId: "",
    courseId: "",
    plannerItemId: "",
    isPinned: false,
    tags: "",
  });
  const [folderForm, setFolderForm] = useState({
    name: "",
    color: "#0F766E",
    parentId: "",
    isPinned: false,
  });
  const [previewForm, setPreviewForm] = useState({
    originalName: "",
    tags: "",
    isPinned: false,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const semesterId = params.get("semesterId") ?? "";
    const courseId = params.get("courseId") ?? "";
    setSelectedSemesterId(semesterId);
    setSelectedCourseId(courseId);
    setUploadForm((prev) => ({
      ...prev,
      semesterId,
      courseId,
    }));
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "100");
      params.set("offset", "0");
      if (query.trim()) params.set("q", query.trim());
      if (mimeGroupFilter) params.set("mimeGroup", mimeGroupFilter);
      if (selectedFolderId) params.set("folderId", selectedFolderId);
      if (selectedSemesterId) params.set("semesterId", selectedSemesterId);
      if (selectedCourseId) params.set("courseId", selectedCourseId);

      const [fileData, folderData, courseData, semesterData, plannerData] = await Promise.all([
        apiFetch<FileListResponse>(`/api/v1/files?${params.toString()}`),
        apiFetch<Folder[]>("/api/v1/folders"),
        apiFetch<CourseResponse>("/api/v1/courses?limit=200&offset=0"),
        apiFetch<Semester[]>("/api/v1/semesters"),
        apiFetch<PlannerResponse>("/api/v1/planner?limit=200&offset=0"),
      ]);

      setFiles(fileData.items);
      setFolders(folderData);
      setCourses(courseData.items);
      setSemesters(semesterData);
      setPlanner(plannerData.items);
    } catch (err) {
      const parsed = toPanelError(err, "بارگذاری فایل ها انجام نشد");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({
        tone: "error",
        title: "بارگذاری ناموفق بود",
        description: parsed.message,
      });
    } finally {
      setLoading(false);
    }
  }, [query, mimeGroupFilter, selectedFolderId, selectedSemesterId, selectedCourseId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtime({
    onMessage: (message) => {
      if (["file.created", "file.updated", "file.deleted", "folder.created", "folder.updated", "folder.deleted"].includes(message.type)) {
        loadData();
      }
    },
  });

  function openUploadModal() {
    setFormError(null);
    setUploadForm((prev) => ({
      ...prev,
      folderId: selectedFolderId || prev.folderId,
      semesterId: selectedSemesterId || prev.semesterId,
      courseId: selectedCourseId || prev.courseId,
    }));
    setUploadOpen(true);
  }

  async function handleCreateFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingFolder(true);
    setFormError(null);
    try {
      await apiFetch<Folder>("/api/v1/folders", {
        method: "POST",
        body: JSON.stringify({
          name: folderForm.name,
          color: folderForm.color || null,
          parentId: folderForm.parentId || null,
          isPinned: folderForm.isPinned,
        }),
      });

      setFolderForm({ name: "", color: "#0F766E", parentId: "", isPinned: false });
      setFolderOpen(false);
      pushToast({ tone: "success", title: "پوشه ایجاد شد" });
      await loadData();
    } catch (err) {
      const parsed = toPanelError(err, "ایجاد پوشه انجام نشد");
      setFormError(parsed);
      pushToast({ tone: "error", title: "ایجاد پوشه ناموفق بود", description: parsed.message });
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setFormError({
        message: "ابتدا یک فایل انتخاب کنید.",
        code: "FILE_REQUIRED",
        details: [],
        fieldErrors: { file: ["ابتدا یک فایل انتخاب کنید."] },
        status: 400,
      });
      return;
    }

    setUploading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      if (uploadForm.folderId) formData.set("folderId", uploadForm.folderId);
      if (uploadForm.semesterId) formData.set("semesterId", uploadForm.semesterId);
      if (uploadForm.courseId) formData.set("courseId", uploadForm.courseId);
      if (uploadForm.plannerItemId) formData.set("plannerItemId", uploadForm.plannerItemId);
      if (uploadForm.isPinned) formData.set("isPinned", "true");
      if (uploadForm.tags.trim()) formData.set("tags", uploadForm.tags.trim());

      await apiFetchForm<FileItem>("/api/v1/files", formData, { method: "POST" });
      setUploadOpen(false);
      setSelectedFile(null);
      setUploadForm({
        folderId: selectedFolderId,
        semesterId: selectedSemesterId,
        courseId: selectedCourseId,
        plannerItemId: "",
        isPinned: false,
        tags: "",
      });
      pushToast({ tone: "success", title: "فایل آپلود شد" });
      await loadData();
    } catch (err) {
      const parsed = toPanelError(err, "آپلود ناموفق بود");
      setFormError(parsed);
      pushToast({ tone: "error", title: "آپلود ناموفق بود", description: parsed.message });
    } finally {
      setUploading(false);
    }
  }

  async function toggleFolderPin(folder: Folder) {
    try {
      await apiFetch<Folder>(`/api/v1/folders/${folder.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPinned: !folder.isPinned }),
      });
      await loadData();
    } catch (err) {
      const parsed = toPanelError(err, "بروزرسانی پوشه انجام نشد");
      pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsed.message });
    }
  }

  async function removeFolder(folderId: string) {
    const shouldDelete = await requestDeleteConfirm({ title: "این پوشه حذف شود؟" });
    if (!shouldDelete) return;
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/folders/${folderId}`, { method: "DELETE" });
      if (selectedFolderId === folderId) {
        setSelectedFolderId("");
      }
      pushToast({ tone: "success", title: "پوشه حذف شد" });
      await loadData();
    } catch (err) {
      const parsed = toPanelError(err, "حذف پوشه انجام نشد");
      pushToast({ tone: "error", title: "حذف ناموفق بود", description: parsed.message });
    }
  }

  async function removeFile(id: string) {
    const shouldDelete = await requestDeleteConfirm({ title: "این فایل حذف شود؟" });
    if (!shouldDelete) return;
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/files/${id}`, { method: "DELETE" });
      if (preview?.id === id) {
        setPreview(null);
        setPreviewOpen(false);
      }
      pushToast({ tone: "success", title: "فایل حذف شد" });
      await loadData();
    } catch (err) {
      const parsed = toPanelError(err, "حذف فایل انجام نشد");
      pushToast({ tone: "error", title: "حذف ناموفق بود", description: parsed.message });
    }
  }

  async function togglePin(file: FileItem) {
    try {
      await apiFetch<FileItem>(`/api/v1/files/${file.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isPinned: !file.isPinned,
        }),
      });
      await loadData();
    } catch (err) {
      const parsed = toPanelError(err, "بروزرسانی فایل انجام نشد");
      pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsed.message });
    }
  }

  async function openPreview(file: FileItem) {
    try {
      const meta = await apiFetch<PreviewMeta>(`/api/v1/files/${file.id}`);
      setPreview(meta);
      setPreviewForm({
        originalName: meta.originalName,
        tags: meta.tags.join(", "),
        isPinned: meta.isPinned,
      });
      setPreviewOpen(true);
    } catch (err) {
      const parsed = toPanelError(err, "باز کردن فایل انجام نشد");
      pushToast({ tone: "error", title: "پیش نمایش ناموفق بود", description: parsed.message });
    }
  }

  async function savePreviewMetadata() {
    if (!preview) return;
    setEditingMeta(true);
    try {
      await apiFetch<FileItem>(`/api/v1/files/${preview.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          originalName: previewForm.originalName,
          isPinned: previewForm.isPinned,
          tags: previewForm.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });

      setPreview((prev) =>
        prev
          ? {
              ...prev,
              originalName: previewForm.originalName,
              isPinned: previewForm.isPinned,
              tags: previewForm.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            }
          : null,
      );
      pushToast({ tone: "success", title: "فایل بروزرسانی شد" });
      await loadData();
    } catch (err) {
      const parsed = toPanelError(err, "ذخیره فایل انجام نشد");
      pushToast({ tone: "error", title: "ذخیره ناموفق بود", description: parsed.message });
    } finally {
      setEditingMeta(false);
    }
  }

  const folderNameError = fieldError(formError?.fieldErrors ?? {}, "name");
  const fileError = fieldError(formError?.fieldErrors ?? {}, "file");

  const filteredCourses = useMemo(
    () => (selectedSemesterId ? courses.filter((course) => course.semesterId === selectedSemesterId) : courses),
    [courses, selectedSemesterId],
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">مدیریت فایل</h2>
          <p className="text-sm text-muted-foreground">مدیریت پوشه ها و فایل ها با پیش نمایش، سنجاق و آپلود سریع</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setFolderOpen(true)}>
            <FolderPlus className="me-2 h-4 w-4" />
            پوشه جدید
          </Button>
          <Button type="button" onClick={openUploadModal}>
            <UploadCloud className="me-2 h-4 w-4" />
            آپلود فایل
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>پوشه ها</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              type="button"
              className={`w-full rounded-md border px-3 py-2 text-start text-sm ${selectedFolderId ? "border-border/70" : "border-primary bg-primary/10"}`}
              onClick={() => setSelectedFolderId("")}
            >
              همه فایل ها
            </button>
            {folders.map((folder) => (
              <article
                key={folder.id}
                className={`rounded-md border p-2 ${selectedFolderId === folder.id ? "border-primary bg-primary/10" : "border-border/70"}`}
              >
                <button type="button" className="w-full text-start" onClick={() => setSelectedFolderId(folder.id)}>
                  <p className="truncate text-sm font-medium">{folder.name}</p>
                  <p className="text-xs text-muted-foreground">
                    فایل ها: {folder._count?.files ?? 0} | زیرپوشه ها: {folder._count?.children ?? 0}
                  </p>
                </button>
                <div className="mt-2 flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" onClick={() => toggleFolderPin(folder)}>
                    <Pin className={`h-3.5 w-3.5 ${folder.isPinned ? "fill-current" : ""}`} />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeFolder(folder.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>کتابخانه فایل</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input placeholder="جستجوی فایل" value={query} onChange={(event) => setQuery(event.target.value)} />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={mimeGroupFilter}
                onChange={(event) => setMimeGroupFilter(event.target.value)}
              >
                <option value="">همه نوع فایل</option>
                <option value="image">تصویر</option>
                <option value="video">ویدیو</option>
                <option value="audio">صوت</option>
                <option value="pdf">پی دی اف</option>
                <option value="document">اسناد</option>
                <option value="other">سایر</option>
              </select>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedSemesterId}
                onChange={(event) => {
                  const nextSemesterId = event.target.value;
                  setSelectedSemesterId(nextSemesterId);
                  setSelectedCourseId("");
                }}
              >
                <option value="">همه ترم ها</option>
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.title}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
              >
                <option value="">همه درس ها</option>
                {filteredCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="flex min-h-32 items-center justify-center">
                <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : files.length === 0 ? (
              <p className="text-sm text-muted-foreground">فایلی پیدا نشد.</p>
            ) : (
              <div className="space-y-2">
                {files.map((file) => (
                  <article key={file.id} className="rounded-md border border-border/70 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{file.originalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)} | {file.mimeType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {file.folder ? `پوشه: ${file.folder.name}` : "بدون پوشه"} |{" "}
                          {file.course ? `درس: ${file.course.name}` : "بدون درس"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon" onClick={() => openPreview(file)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button asChild type="button" variant="outline" size="icon">
                          <a href={`/api/v1/files/${file.id}/download`}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button type="button" variant="outline" size="icon" onClick={() => togglePin(file)}>
                          <Pin className={`h-4 w-4 ${file.isPinned ? "fill-current" : ""}`} />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeFile(file.id)}>
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
      </div>

      <Modal open={folderOpen} onClose={() => setFolderOpen(false)} title="ایجاد پوشه" description="ایجاد پوشه با والد اختیاری">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateFolder}>
          <div className="space-y-2 md:col-span-2">
            <Label>نام پوشه</Label>
            <Input
              value={folderForm.name}
              onChange={(event) => setFolderForm((prev) => ({ ...prev, name: event.target.value }))}
              aria-invalid={Boolean(folderNameError)}
              required
            />
            {folderNameError && <p className="text-xs text-destructive">{folderNameError}</p>}
          </div>
          <div className="space-y-2">
            <Label>والد</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={folderForm.parentId}
              onChange={(event) => setFolderForm((prev) => ({ ...prev, parentId: event.target.value }))}
            >
              <option value="">ریشه</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>رنگ</Label>
            <Input
              type="color"
              value={folderForm.color}
              onChange={(event) => setFolderForm((prev) => ({ ...prev, color: event.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={folderForm.isPinned}
              onChange={(event) => setFolderForm((prev) => ({ ...prev, isPinned: event.target.checked }))}
            />
            سنجاق کردن پوشه
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={creatingFolder}>
              {creatingFolder ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <FolderPlus className="me-2 h-4 w-4" />}
              Create
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="آپلود فایل" description="همه اتصال ها اختیاری هستند.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleUpload}>
          <div className="space-y-2 md:col-span-2">
            <Label>فایل</Label>
            <Input type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} required />
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          </div>

          <div className="space-y-2">
            <Label>پوشه (اختیاری)</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={uploadForm.folderId}
              onChange={(event) => setUploadForm((prev) => ({ ...prev, folderId: event.target.value }))}
            >
              <option value="">هیچ کدام</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>ترم (اختیاری)</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={uploadForm.semesterId}
              onChange={(event) => {
                const semesterId = event.target.value;
                setUploadForm((prev) => ({ ...prev, semesterId, courseId: semesterId ? prev.courseId : "" }));
              }}
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
            <Label>درس (اختیاری)</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={uploadForm.courseId}
              onChange={(event) => setUploadForm((prev) => ({ ...prev, courseId: event.target.value }))}
            >
              <option value="">هیچ کدام</option>
              {courses
                .filter((course) => !uploadForm.semesterId || course.semesterId === uploadForm.semesterId)
                .map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>آیتم برنامه ریزی (اختیاری)</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={uploadForm.plannerItemId}
              onChange={(event) => setUploadForm((prev) => ({ ...prev, plannerItemId: event.target.value }))}
            >
              <option value="">هیچ کدام</option>
              {planner.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
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
              Upload
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={previewOpen && Boolean(preview)}
        onClose={() => setPreviewOpen(false)}
        title={preview ? `باز کردن: ${preview.originalName}` : "باز کردن فایل"}
        description={preview ? `${preview.mimeType} | ${formatFileSize(preview.size)}` : undefined}
        className="max-w-5xl"
      >
        {preview && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-md border border-border/70 p-3 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label>نام فایل</Label>
                <Input
                  value={previewForm.originalName}
                  onChange={(event) => setPreviewForm((prev) => ({ ...prev, originalName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>برچسب ها</Label>
                <Input
                  value={previewForm.tags}
                  onChange={(event) => setPreviewForm((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder="برچسب 1، برچسب 2"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={previewForm.isPinned}
                  onChange={(event) => setPreviewForm((prev) => ({ ...prev, isPinned: event.target.checked }))}
                />
                سنجاق کردن فایل
              </label>
              <div>
                <Button type="button" size="sm" onClick={savePreviewMetadata} disabled={editingMeta}>
                  {editingMeta ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                  ذخیره
                </Button>
              </div>
            </div>

            {preview.previewType === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.previewUrl} alt={preview.originalName} className="max-h-[560px] w-full rounded-md object-contain" />
            )}
            {preview.previewType === "video" && (
              <video controls className="w-full rounded-md">
                <source src={preview.previewUrl} />
              </video>
            )}
            {preview.previewType === "audio" && (
              <audio controls className="w-full">
                <source src={preview.previewUrl} />
              </audio>
            )}
            {preview.previewType === "pdf" && (
              <iframe src={preview.previewUrl} className="h-[560px] w-full rounded-md border border-border" title={preview.originalName} />
            )}
            {preview.previewType === "text" && (
              <iframe src={preview.previewUrl} className="h-[460px] w-full rounded-md border border-border" title={preview.originalName} />
            )}
            {preview.previewType === "office" && (
              <p className="text-sm text-muted-foreground">
                فایل های Office (DOCX/PPTX/XLSX) قابل دانلود هستند. ویرایش مستقیم در مرورگر به برنامه های نصب شده بستگی دارد.
              </p>
            )}
            <div className="flex gap-2">
              <Button asChild>
                <a href={preview.downloadUrl}>
                  <Download className="me-2 h-4 w-4" />
                  دانلود
                </a>
              </Button>
              <Button type="button" variant="outline" onClick={() => window.open(preview.previewUrl, "_blank")}>
                باز کردن در تب جدید
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {deleteConfirmDialog}
    </section>
  );
}





