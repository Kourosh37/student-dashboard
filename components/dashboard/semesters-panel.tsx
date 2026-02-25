"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, LoaderCircle, Pin, Plus, Trash2, UploadCloud } from "lucide-react";

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
import type { Course, FileItem, Semester } from "@/types/dashboard";

type CourseListResponse = { items: Course[]; total: number };
type FileListResponse = { items: FileItem[]; total: number };

export function SemestersPanel() {
  const router = useRouter();
  const [items, setItems] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [createSemesterOpen, setCreateSemesterOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const [selectedSemester, setSelectedSemester] = useState<Semester | null>(null);
  const [semesterCourses, setSemesterCourses] = useState<Course[]>([]);
  const [semesterFiles, setSemesterFiles] = useState<FileItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [courseFileFilter, setCourseFileFilter] = useState("");
  const [fileQuery, setFileQuery] = useState("");

  const [savingSemester, setSavingSemester] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [semesterFormError, setSemesterFormError] = useState<PanelError | null>(null);
  const [courseFormError, setCourseFormError] = useState<PanelError | null>(null);
  const [uploadFormError, setUploadFormError] = useState<PanelError | null>(null);

  const [semesterForm, setSemesterForm] = useState({
    title: "",
    code: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    isPinned: false,
  });

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

  const loadSemesters = useCallback(async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (query.trim()) qs.set("q", query.trim());
      const data = await apiFetch<Semester[]>(`/api/v1/semesters?${qs.toString()}`);
      setItems(data);
    } catch (err) {
      const parsed = toPanelError(err, "Failed to load semesters");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({ tone: "error", title: "Load failed", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }, [query, router]);

  const loadDetail = useCallback(
    async (semesterId: string) => {
      try {
        setDetailLoading(true);
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
        setSemesterCourses(courseData.items);
        setSemesterFiles(fileData.items);
      } catch (err) {
        const parsed = toPanelError(err, "Failed to load semester details");
        pushToast({ tone: "error", title: "Load failed", description: parsed.message });
      } finally {
        setDetailLoading(false);
      }
    },
    [fileQuery, courseFileFilter],
  );

  useEffect(() => {
    loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    if (selectedSemester && detailOpen) {
      loadDetail(selectedSemester.id);
    }
  }, [selectedSemester, detailOpen, loadDetail]);

  useRealtime({
    onMessage: (message) => {
      if (
        ["semester.created", "semester.updated", "semester.deleted", "course.created", "course.updated", "course.deleted", "file.created", "file.updated", "file.deleted"].includes(message.type)
      ) {
        loadSemesters();
        if (selectedSemester && detailOpen) {
          loadDetail(selectedSemester.id);
        }
      }
    },
  });

  async function createSemester(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSemester(true);
    setSemesterFormError(null);
    try {
      await apiFetch<Semester>("/api/v1/semesters", {
        method: "POST",
        body: JSON.stringify({
          ...semesterForm,
          code: semesterForm.code || null,
          startDate: new Date(semesterForm.startDate).toISOString(),
          endDate: new Date(semesterForm.endDate).toISOString(),
        }),
      });
      setCreateSemesterOpen(false);
      setSemesterForm({ title: "", code: "", startDate: "", endDate: "", isCurrent: false, isPinned: false });
      pushToast({ tone: "success", title: "Semester created" });
      await loadSemesters();
    } catch (err) {
      const parsed = toPanelError(err, "Failed to create semester");
      setSemesterFormError(parsed);
      pushToast({ tone: "error", title: "Create failed", description: parsed.message });
    } finally {
      setSavingSemester(false);
    }
  }

  async function toggleSemesterPin(item: Semester) {
    try {
      await apiFetch<Semester>(`/api/v1/semesters/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPinned: !item.isPinned }),
      });
      await loadSemesters();
    } catch (err) {
      const parsed = toPanelError(err, "Failed to update semester");
      pushToast({ tone: "error", title: "Update failed", description: parsed.message });
    }
  }

  async function removeSemester(id: string) {
    if (!window.confirm("Delete this semester?")) return;
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/semesters/${id}`, { method: "DELETE" });
      if (selectedSemester?.id === id) {
        setSelectedSemester(null);
        setDetailOpen(false);
      }
      pushToast({ tone: "success", title: "Semester deleted" });
      await loadSemesters();
    } catch (err) {
      const parsed = toPanelError(err, "Failed to delete semester");
      pushToast({ tone: "error", title: "Delete failed", description: parsed.message });
    }
  }

  async function createCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSemester) return;
    setSavingCourse(true);
    setCourseFormError(null);
    try {
      await apiFetch<Course>("/api/v1/courses", {
        method: "POST",
        body: JSON.stringify({
          semesterId: selectedSemester.id,
          ...courseForm,
          code: courseForm.code || null,
          instructor: courseForm.instructor || null,
          location: courseForm.location || null,
          credits: courseForm.credits ? Number(courseForm.credits) : null,
          sessions: [],
        }),
      });
      setCourseForm({ name: "", code: "", instructor: "", location: "", credits: "", color: "#0F766E", isPinned: false });
      setCreateCourseOpen(false);
      pushToast({ tone: "success", title: "Course created" });
      await loadDetail(selectedSemester.id);
      await loadSemesters();
    } catch (err) {
      const parsed = toPanelError(err, "Failed to create course");
      setCourseFormError(parsed);
      pushToast({ tone: "error", title: "Create failed", description: parsed.message });
    } finally {
      setSavingCourse(false);
    }
  }

  async function toggleCoursePin(course: Course) {
    if (!selectedSemester) return;
    try {
      await apiFetch<Course>(`/api/v1/courses/${course.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPinned: !course.isPinned }),
      });
      await loadDetail(selectedSemester.id);
    } catch (err) {
      const parsed = toPanelError(err, "Failed to update course");
      pushToast({ tone: "error", title: "Update failed", description: parsed.message });
    }
  }

  async function removeCourse(courseId: string) {
    if (!selectedSemester || !window.confirm("Delete this course?")) return;
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/courses/${courseId}`, { method: "DELETE" });
      pushToast({ tone: "success", title: "Course deleted" });
      await loadDetail(selectedSemester.id);
      await loadSemesters();
    } catch (err) {
      const parsed = toPanelError(err, "Failed to delete course");
      pushToast({ tone: "error", title: "Delete failed", description: parsed.message });
    }
  }

  async function uploadSemesterFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSemester) return;
    if (!uploadFile) {
      setUploadFormError({
        message: "Select a file first.",
        code: "FILE_REQUIRED",
        details: [],
        fieldErrors: { file: ["Select a file first."] },
        status: 400,
      });
      return;
    }

    setUploading(true);
    setUploadFormError(null);
    try {
      const formData = new FormData();
      formData.set("file", uploadFile);
      formData.set("semesterId", selectedSemester.id);
      if (uploadForm.courseId) formData.set("courseId", uploadForm.courseId);
      if (uploadForm.isPinned) formData.set("isPinned", "true");
      if (uploadForm.tags.trim()) formData.set("tags", uploadForm.tags.trim());

      await apiFetchForm<FileItem>("/api/v1/files", formData, { method: "POST" });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadForm({ courseId: "", isPinned: false, tags: "" });
      pushToast({ tone: "success", title: "File uploaded" });
      await loadDetail(selectedSemester.id);
      await loadSemesters();
    } catch (err) {
      const parsed = toPanelError(err, "Failed to upload file");
      setUploadFormError(parsed);
      pushToast({ tone: "error", title: "Upload failed", description: parsed.message });
    } finally {
      setUploading(false);
    }
  }

  const titleError = fieldError(semesterFormError?.fieldErrors ?? {}, "title");
  const startError = fieldError(semesterFormError?.fieldErrors ?? {}, "startDate");
  const endError = fieldError(semesterFormError?.fieldErrors ?? {}, "endDate");
  const courseNameError = fieldError(courseFormError?.fieldErrors ?? {}, "name");
  const uploadFileError = fieldError(uploadFormError?.fieldErrors ?? {}, "file");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Semesters</h2>
          <p className="text-sm text-muted-foreground">Courses and files are managed inside each semester.</p>
        </div>
        <Button type="button" onClick={() => setCreateSemesterOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          Create Semester
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Semester List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Search semesters" value={query} onChange={(event) => setQuery(event.target.value)} />
          {loading ? (
            <div className="flex min-h-24 items-center justify-center">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No semesters found.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <article key={item.id} className="rounded-md border border-border/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Courses: {item._count?.courses ?? 0} | Exams: {item._count?.exams ?? 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={() => { setSelectedSemester(item); setDetailOpen(true); }}>
                        Open
                      </Button>
                      <Button type="button" variant="outline" size="icon" onClick={() => toggleSemesterPin(item)}>
                        <Pin className={`h-4 w-4 ${item.isPinned ? "fill-current" : ""}`} />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeSemester(item.id)}>
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

      <Modal open={createSemesterOpen} onClose={() => setCreateSemesterOpen(false)} title="Create Semester" description="Create semester in popup dialog.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={createSemester}>
          <div className="space-y-2 md:col-span-2">
            <Label>Title</Label>
            <Input value={semesterForm.title} onChange={(event) => setSemesterForm((prev) => ({ ...prev, title: event.target.value }))} aria-invalid={Boolean(titleError)} required />
            {titleError && <p className="text-xs text-destructive">{titleError}</p>}
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input value={semesterForm.code} onChange={(event) => setSemesterForm((prev) => ({ ...prev, code: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={semesterForm.startDate} onChange={(event) => setSemesterForm((prev) => ({ ...prev, startDate: event.target.value }))} aria-invalid={Boolean(startError)} required />
            {startError && <p className="text-xs text-destructive">{startError}</p>}
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input type="date" value={semesterForm.endDate} onChange={(event) => setSemesterForm((prev) => ({ ...prev, endDate: event.target.value }))} aria-invalid={Boolean(endError)} required />
            {endError && <p className="text-xs text-destructive">{endError}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={semesterForm.isCurrent} onChange={(event) => setSemesterForm((prev) => ({ ...prev, isCurrent: event.target.checked }))} />
            Set as current semester
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={savingSemester}>
              {savingSemester ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
              Create
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={detailOpen && Boolean(selectedSemester)} onClose={() => setDetailOpen(false)} title={selectedSemester?.title ?? "Semester"} description="Manage courses and files for this semester." className="max-w-6xl">
        {selectedSemester && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setCreateCourseOpen(true)}>
                <Plus className="me-2 h-4 w-4" />
                Add Course
              </Button>
              <Button type="button" variant="outline" onClick={() => setUploadOpen(true)}>
                <UploadCloud className="me-2 h-4 w-4" />
                Upload File
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href={`/dashboard/files?semesterId=${selectedSemester.id}`}>
                  <ExternalLink className="me-2 h-4 w-4" />
                  Open File Manager
                </Link>
              </Button>
            </div>

            <Card>
              <CardHeader><CardTitle>Courses</CardTitle></CardHeader>
              <CardContent>
                {detailLoading ? (
                  <div className="flex min-h-20 items-center justify-center"><LoaderCircle className="h-5 w-5 animate-spin text-primary" /></div>
                ) : semesterCourses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No courses yet.</p>
                ) : (
                  <div className="space-y-2">
                    {semesterCourses.map((course) => (
                      <article key={course.id} className="rounded-md border border-border/70 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{course.name} {course.code ? `(${course.code})` : ""}</p>
                            <p className="text-xs text-muted-foreground">{course.instructor ?? "No instructor"} | {course.location ?? "No location"}</p>
                            <p className="text-xs text-muted-foreground">Files: {course._count?.files ?? 0}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button type="button" size="sm" variant="outline" onClick={() => setCourseFileFilter(course.id)}>Files</Button>
                            <Button type="button" size="icon" variant="outline" onClick={() => toggleCoursePin(course)}>
                              <Pin className={`h-4 w-4 ${course.isPinned ? "fill-current" : ""}`} />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" onClick={() => removeCourse(course.id)}>
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

            <Card>
              <CardHeader><CardTitle>Files</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[1fr_260px]">
                  <Input placeholder="Search files in semester" value={fileQuery} onChange={(event) => setFileQuery(event.target.value)} />
                  <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={courseFileFilter} onChange={(event) => setCourseFileFilter(event.target.value)}>
                    <option value="">All courses</option>
                    {semesterCourses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
                  </select>
                </div>
                {detailLoading ? (
                  <div className="flex min-h-20 items-center justify-center"><LoaderCircle className="h-5 w-5 animate-spin text-primary" /></div>
                ) : semesterFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No files yet.</p>
                ) : (
                  <div className="space-y-2">
                    {semesterFiles.map((file) => (
                      <article key={file.id} className="rounded-md border border-border/70 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{file.originalName}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)} | {file.mimeType}</p>
                            <p className="text-xs text-muted-foreground">{file.course ? `Course: ${file.course.name}` : "No course"}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button asChild type="button" size="icon" variant="outline">
                              <a href={`/api/v1/files/${file.id}/preview`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                            </Button>
                            <Button asChild type="button" size="icon" variant="outline">
                              <a href={`/api/v1/files/${file.id}/download`}><Download className="h-4 w-4" /></a>
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
        )}
      </Modal>

      <Modal open={createCourseOpen} onClose={() => setCreateCourseOpen(false)} title="Create Course" description={selectedSemester ? `Semester: ${selectedSemester.title}` : ""}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={createCourse}>
          <div className="space-y-2 md:col-span-2">
            <Label>Course Name</Label>
            <Input value={courseForm.name} onChange={(event) => setCourseForm((prev) => ({ ...prev, name: event.target.value }))} aria-invalid={Boolean(courseNameError)} required />
            {courseNameError && <p className="text-xs text-destructive">{courseNameError}</p>}
          </div>
          <div className="space-y-2"><Label>Code</Label><Input value={courseForm.code} onChange={(event) => setCourseForm((prev) => ({ ...prev, code: event.target.value }))} /></div>
          <div className="space-y-2"><Label>Instructor</Label><Input value={courseForm.instructor} onChange={(event) => setCourseForm((prev) => ({ ...prev, instructor: event.target.value }))} /></div>
          <div className="space-y-2"><Label>Location</Label><Input value={courseForm.location} onChange={(event) => setCourseForm((prev) => ({ ...prev, location: event.target.value }))} /></div>
          <div className="space-y-2"><Label>Credits</Label><Input type="number" min={0} max={30} value={courseForm.credits} onChange={(event) => setCourseForm((prev) => ({ ...prev, credits: event.target.value }))} /></div>
          <div className="space-y-2"><Label>Color</Label><Input type="color" value={courseForm.color} onChange={(event) => setCourseForm((prev) => ({ ...prev, color: event.target.value }))} /></div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={courseForm.isPinned} onChange={(event) => setCourseForm((prev) => ({ ...prev, isPinned: event.target.checked }))} />
            Pin course
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={savingCourse}>
              {savingCourse ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
              Create Course
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload File" description={selectedSemester ? `Semester: ${selectedSemester.title}` : ""}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={uploadSemesterFile}>
          <div className="space-y-2 md:col-span-2">
            <Label>File</Label>
            <Input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} required />
            {uploadFileError && <p className="text-xs text-destructive">{uploadFileError}</p>}
          </div>
          <div className="space-y-2">
            <Label>Course (optional)</Label>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={uploadForm.courseId} onChange={(event) => setUploadForm((prev) => ({ ...prev, courseId: event.target.value }))}>
              <option value="">None</option>
              {semesterCourses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <Input value={uploadForm.tags} onChange={(event) => setUploadForm((prev) => ({ ...prev, tags: event.target.value }))} placeholder="lecture, exam" />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={uploadForm.isPinned} onChange={(event) => setUploadForm((prev) => ({ ...prev, isPinned: event.target.checked }))} />
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
    </section>
  );
}
