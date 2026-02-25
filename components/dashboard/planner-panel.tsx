"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pin, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-api";
import { fieldError, toPanelError, type PanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";
import type { Course, PlannerItem, PlannerPriority, PlannerStatus, Semester } from "@/types/dashboard";

const statusOptions: PlannerStatus[] = ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"];
const priorityOptions: PlannerPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

type PlannerListResponse = {
  items: PlannerItem[];
  total: number;
};

export function PlannerPanel() {
  const router = useRouter();
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<PanelError | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | PlannerStatus>("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "TODO" as PlannerStatus,
    priority: "MEDIUM" as PlannerPriority,
    semesterId: "",
    courseId: "",
    startAt: "",
    dueAt: "",
    isPinned: false,
  });

  const availableCourses = useMemo(
    () => (form.semesterId ? courses.filter((course) => course.semesterId === form.semesterId) : courses),
    [courses, form.semesterId],
  );

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "100");
      params.set("offset", "0");
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (semesterFilter) params.set("semesterId", semesterFilter);

      const [plannerData, courseData, semesterData] = await Promise.all([
        apiFetch<PlannerListResponse>(`/api/v1/planner?${params.toString()}`),
        apiFetch<{ items: Course[]; total: number }>("/api/v1/courses?limit=200&offset=0"),
        apiFetch<Semester[]>("/api/v1/semesters"),
      ]);
      setItems(plannerData.items);
      setCourses(courseData.items);
      setSemesters(semesterData);
    } catch (err) {
      const parsed = toPanelError(err, "Failed to load planner");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({ tone: "error", title: "Load failed", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, semesterFilter, router]);

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

  async function createItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch<PlannerItem>("/api/v1/planner", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          semesterId: form.semesterId || null,
          courseId: form.courseId || null,
          startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        }),
      });
      setForm({
        title: "",
        description: "",
        status: "TODO",
        priority: "MEDIUM",
        semesterId: "",
        courseId: "",
        startAt: "",
        dueAt: "",
        isPinned: false,
      });
      setCreateOpen(false);
      pushToast({ tone: "success", title: "Planner item created" });
      await loadAll();
    } catch (err) {
      const parsed = toPanelError(err, "Failed to create planner item");
      setFormError(parsed);
      pushToast({ tone: "error", title: "Create failed", description: parsed.message });
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
    } catch (err) {
      const parsed = toPanelError(err, "Failed to update planner item");
      pushToast({ tone: "error", title: "Update failed", description: parsed.message });
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm("Delete this planner item?")) return;
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/planner/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
      pushToast({ tone: "success", title: "Planner item deleted" });
    } catch (err) {
      const parsed = toPanelError(err, "Failed to delete planner item");
      pushToast({ tone: "error", title: "Delete failed", description: parsed.message });
    }
  }

  const titleError = fieldError(formError?.fieldErrors ?? {}, "title");
  const descriptionError = fieldError(formError?.fieldErrors ?? {}, "description");

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Planner</h2>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          New Planner Item
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planner Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
            <Input placeholder="Search planner items" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "" | PlannerStatus)}
            >
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={semesterFilter}
              onChange={(event) => setSemesterFilter(event.target.value)}
            >
              <option value="">All semesters</option>
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
            <p className="text-sm text-muted-foreground">No planner items found.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <article key={item.id} className="rounded-md border border-border/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary">{item.status}</Badge>
                        <Badge variant={item.priority === "URGENT" ? "warning" : "outline"}>{item.priority}</Badge>
                        {item.semester && <Badge variant="outline">{item.semester.title}</Badge>}
                        {item.course && <Badge variant="outline">{item.course.name}</Badge>}
                        {item.dueAt && <Badge variant="outline">Due: {new Date(item.dueAt).toLocaleString()}</Badge>}
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
                            {status}
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Planner Item" description="Create task in a popup dialog.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={createItem}>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="planner-title">Title</Label>
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
            <Label htmlFor="planner-description">Description</Label>
            <Textarea
              id="planner-description"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              aria-invalid={Boolean(descriptionError)}
            />
            {descriptionError && <p className="text-xs text-destructive">{descriptionError}</p>}
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as PlannerStatus }))}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.priority}
              onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as PlannerPriority }))}
            >
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Semester</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.semesterId}
              onChange={(event) => setForm((prev) => ({ ...prev, semesterId: event.target.value, courseId: "" }))}
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
            <Label>Course</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.courseId}
              onChange={(event) => setForm((prev) => ({ ...prev, courseId: event.target.value }))}
            >
              <option value="">None</option>
              {availableCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Start At</Label>
            <Input type="datetime-local" value={form.startAt} onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Due At</Label>
            <Input type="datetime-local" value={form.dueAt} onChange={(event) => setForm((prev) => ({ ...prev, dueAt: event.target.value }))} />
          </div>

          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={form.isPinned} onChange={(event) => setForm((prev) => ({ ...prev, isPinned: event.target.checked }))} />
            Pin item
          </label>

          <div className="md:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
