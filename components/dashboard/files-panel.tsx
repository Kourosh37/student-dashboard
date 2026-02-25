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
      const parsed = toPanelError(err, "Failed to load files");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({
        tone: "error",
        title: "Load failed",
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
      pushToast({ tone: "success", title: "Folder created" });
      await loadData();
    } catch (err) {
      const parsed = toPanelError(err, "Failed to create folder");
      setFormError(parsed);
      pushToast({ tone: "error", title: "Create folder failed", description: parsed.message });
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setFormError({
        message: "Select a file first.",
        code: "FILE_REQUIRED",
        details: [],
        fieldErrors: { file: ["Select a file first."] },
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
      pushToast({ tone: "success", title: "File uploaded" });
      await loadData();
    } catch (err) {
      const parsed = toPanelError(err, "Upload failed");
      setFormError(parsed);
      pushToast({ tone: "error", title: "Upload failed", description: parsed.message });
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
      const parsed = toPanelError(err, "Failed to update folder");
      pushToast({ tone: "error", title: "Update failed", description: parsed.message });
    }
  }

  async function removeFolder(folderId: string) {
    if (!window.confirm("Delete this folder?")) return;
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/folders/${folderId}`, { method: "DELETE" });
      if (selectedFolderId === folderId) {
        setSelectedFolderId("");
      }
      pushToast({ tone: "success", title: "Folder deleted" });
      await loadData();
    } catch (err) {
      const parsed = toPanelError(err, "Failed to delete folder");
      pushToast({ tone: "error", title: "Delete failed", description: parsed.message });
    }
  }

  async function removeFile(id: string) {
    if (!window.confirm("Delete this file?")) return;
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/files/${id}`, { method: "DELETE" });
      if (preview?.id === id) {
        setPreview(null);
        setPreviewOpen(false);
      }
      pushToast({ tone: "success", title: "File deleted" });
      await loadData();
    } catch (err) {
      const parsed = toPanelError(err, "Failed to delete file");
      pushToast({ tone: "error", title: "Delete failed", description: parsed.message });
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
      const parsed = toPanelError(err, "Failed to update file");
      pushToast({ tone: "error", title: "Update failed", description: parsed.message });
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
      const parsed = toPanelError(err, "Failed to open file");
      pushToast({ tone: "error", title: "Preview failed", description: parsed.message });
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
      pushToast({ tone: "success", title: "File updated" });
      await loadData();
    } catch (err) {
      const parsed = toPanelError(err, "Failed to save file");
      pushToast({ tone: "error", title: "Save failed", description: parsed.message });
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
          <h2 className="text-2xl font-bold">File Manager</h2>
          <p className="text-sm text-muted-foreground">Folders, files, preview, pin and quick upload with modal dialogs.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setFolderOpen(true)}>
            <FolderPlus className="me-2 h-4 w-4" />
            New Folder
          </Button>
          <Button type="button" onClick={openUploadModal}>
            <UploadCloud className="me-2 h-4 w-4" />
            Upload File
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Folders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              type="button"
              className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selectedFolderId ? "border-border/70" : "border-primary bg-primary/10"}`}
              onClick={() => setSelectedFolderId("")}
            >
              All files
            </button>
            {folders.map((folder) => (
              <article
                key={folder.id}
                className={`rounded-md border p-2 ${selectedFolderId === folder.id ? "border-primary bg-primary/10" : "border-border/70"}`}
              >
                <button type="button" className="w-full text-left" onClick={() => setSelectedFolderId(folder.id)}>
                  <p className="truncate text-sm font-medium">{folder.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Files: {folder._count?.files ?? 0} | Subfolders: {folder._count?.children ?? 0}
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
            <CardTitle>Library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input placeholder="Search files" value={query} onChange={(event) => setQuery(event.target.value)} />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={mimeGroupFilter}
                onChange={(event) => setMimeGroupFilter(event.target.value)}
              >
                <option value="">All types</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
                <option value="pdf">PDF</option>
                <option value="document">Documents</option>
                <option value="other">Other</option>
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
                <option value="">All semesters</option>
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
                <option value="">All courses</option>
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
              <p className="text-sm text-muted-foreground">No files found.</p>
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
                          {file.folder ? `Folder: ${file.folder.name}` : "No folder"} |{" "}
                          {file.course ? `Course: ${file.course.name}` : "No course"}
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

      <Modal open={folderOpen} onClose={() => setFolderOpen(false)} title="Create Folder" description="Create folder with optional parent.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateFolder}>
          <div className="space-y-2 md:col-span-2">
            <Label>Folder Name</Label>
            <Input
              value={folderForm.name}
              onChange={(event) => setFolderForm((prev) => ({ ...prev, name: event.target.value }))}
              aria-invalid={Boolean(folderNameError)}
              required
            />
            {folderNameError && <p className="text-xs text-destructive">{folderNameError}</p>}
          </div>
          <div className="space-y-2">
            <Label>Parent</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={folderForm.parentId}
              onChange={(event) => setFolderForm((prev) => ({ ...prev, parentId: event.target.value }))}
            >
              <option value="">Root</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
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
            Pin folder
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={creatingFolder}>
              {creatingFolder ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <FolderPlus className="me-2 h-4 w-4" />}
              Create
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload File" description="All links are optional.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleUpload}>
          <div className="space-y-2 md:col-span-2">
            <Label>File</Label>
            <Input type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} required />
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          </div>

          <div className="space-y-2">
            <Label>Folder (optional)</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={uploadForm.folderId}
              onChange={(event) => setUploadForm((prev) => ({ ...prev, folderId: event.target.value }))}
            >
              <option value="">None</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Semester (optional)</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={uploadForm.semesterId}
              onChange={(event) => {
                const semesterId = event.target.value;
                setUploadForm((prev) => ({ ...prev, semesterId, courseId: semesterId ? prev.courseId : "" }));
              }}
            >
              <option value="">None</option>
              {semesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Course (optional)</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={uploadForm.courseId}
              onChange={(event) => setUploadForm((prev) => ({ ...prev, courseId: event.target.value }))}
            >
              <option value="">None</option>
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
            <Label>Planner Item (optional)</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={uploadForm.plannerItemId}
              onChange={(event) => setUploadForm((prev) => ({ ...prev, plannerItemId: event.target.value }))}
            >
              <option value="">None</option>
              {planner.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Tags</Label>
            <Input
              value={uploadForm.tags}
              onChange={(event) => setUploadForm((prev) => ({ ...prev, tags: event.target.value }))}
              placeholder="lecture, assignment, important"
            />
          </div>

          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={uploadForm.isPinned}
              onChange={(event) => setUploadForm((prev) => ({ ...prev, isPinned: event.target.checked }))}
            />
            Pin file
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
        title={preview ? `Open: ${preview.originalName}` : "Open File"}
        description={preview ? `${preview.mimeType} | ${formatFileSize(preview.size)}` : undefined}
        className="max-w-5xl"
      >
        {preview && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-md border border-border/70 p-3 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label>File Name</Label>
                <Input
                  value={previewForm.originalName}
                  onChange={(event) => setPreviewForm((prev) => ({ ...prev, originalName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <Input
                  value={previewForm.tags}
                  onChange={(event) => setPreviewForm((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder="tag1, tag2"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={previewForm.isPinned}
                  onChange={(event) => setPreviewForm((prev) => ({ ...prev, isPinned: event.target.checked }))}
                />
                Pin file
              </label>
              <div>
                <Button type="button" size="sm" onClick={savePreviewMetadata} disabled={editingMeta}>
                  {editingMeta ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                  Save
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
                Office files (DOCX/PPTX/XLSX) are downloadable. Browser inline editing depends on your installed apps.
              </p>
            )}
            <div className="flex gap-2">
              <Button asChild>
                <a href={preview.downloadUrl}>
                  <Download className="me-2 h-4 w-4" />
                  Download
                </a>
              </Button>
              <Button type="button" variant="outline" onClick={() => window.open(preview.previewUrl, "_blank")}>
                Open in New Tab
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
