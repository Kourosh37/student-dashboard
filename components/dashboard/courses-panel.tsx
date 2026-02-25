"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pin, Plus, PlusCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client-api";
import { fieldError, toPanelError, type PanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";
import type { Course, CourseSession, Semester, Weekday } from "@/types/dashboard";

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

export function CoursesPanel() {
  const router = useRouter();
  const [items, setItems] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<PanelError | null>(null);
  const [query, setQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [form, setForm] = useState({
    semesterId: "",
    name: "",
    code: "",
    instructor: "",
    location: "",
    credits: "",
    color: "#0F766E",
    isPinned: false,
  });
  const [sessions, setSessions] = useState<SessionDraft[]>([
    { weekday: "MONDAY", startTime: "09:00", endTime: "10:30", room: "" },
  ]);

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
    } catch (err) {
      const parsed = toPanelError(err, "Failed to load courses");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({ tone: "error", title: "Load failed", description: parsed.message });
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

  async function createCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch<Course>("/api/v1/courses", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          credits: form.credits ? Number(form.credits) : null,
          code: form.code || null,
          instructor: form.instructor || null,
          location: form.location || null,
          sessions: sessions.map((session) => ({
            weekday: session.weekday,
            startTime: session.startTime,
            endTime: session.endTime,
            room: session.room || null,
          })),
        }),
      });
      setForm({
        semesterId: "",
        name: "",
        code: "",
        instructor: "",
        location: "",
        credits: "",
        color: "#0F766E",
        isPinned: false,
      });
      setSessions([{ weekday: "MONDAY", startTime: "09:00", endTime: "10:30", room: "" }]);
      pushToast({ tone: "success", title: "Course created" });
      await loadData();
    } catch (err) {
      const parsed = toPanelError(err, "Failed to create course");
      setFormError(parsed);
      pushToast({ tone: "error", title: "Create failed", description: parsed.message });
    } finally {
      setSaving(false);
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
    } catch (err) {
      const parsed = toPanelError(err, "Failed to update course");
      pushToast({ tone: "error", title: "Update failed", description: parsed.message });
    }
  }

  async function removeCourse(id: string) {
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/courses/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      const parsed = toPanelError(err, "Failed to delete course");
      pushToast({ tone: "error", title: "Delete failed", description: parsed.message });
    }
  }

  const nameError = fieldError(formError?.fieldErrors ?? {}, "name");
  const semesterError = fieldError(formError?.fieldErrors ?? {}, "semesterId");

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Courses</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Course</CardTitle>
          <CardDescription>Add classes and weekly class hours.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createCourse}>
            <div className="space-y-2">
              <Label>Semester</Label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.semesterId}
                onChange={(event) => setForm((prev) => ({ ...prev, semesterId: event.target.value }))}
                required
              >
                <option value="">Select semester</option>
                {filteredSemesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.title}
                  </option>
                ))}
              </select>
              {semesterError && <p className="text-xs text-destructive">{semesterError}</p>}
            </div>

            <div className="space-y-2">
              <Label>Course Name</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                aria-invalid={Boolean(nameError)}
                required
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Instructor</Label>
              <Input
                value={form.instructor}
                onChange={(event) => setForm((prev) => ({ ...prev, instructor: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Credits</Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={form.credits}
                onChange={(event) => setForm((prev) => ({ ...prev, credits: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <Input
                type="color"
                value={form.color}
                onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPinned}
                onChange={(event) => setForm((prev) => ({ ...prev, isPinned: event.target.checked }))}
              />
              Pin course
            </label>

            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Class Sessions</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSessions((prev) => [...prev, { weekday: "MONDAY", startTime: "09:00", endTime: "10:00", room: "" }])
                  }
                >
                  <PlusCircle className="me-2 h-4 w-4" />
                  Add Session
                </Button>
              </div>
              <div className="space-y-2">
                {sessions.map((session, index) => (
                  <div key={`${session.weekday}-${index}`} className="grid gap-2 rounded-md border border-border/70 p-3 md:grid-cols-5">
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={session.weekday}
                      onChange={(event) =>
                        setSessions((prev) =>
                          prev.map((entry, i) => (i === index ? { ...entry, weekday: event.target.value as Weekday } : entry)),
                        )
                      }
                    >
                      {weekdayOptions.map((weekday) => (
                        <option key={weekday} value={weekday}>
                          {weekday}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="time"
                      value={session.startTime}
                      onChange={(event) =>
                        setSessions((prev) =>
                          prev.map((entry, i) => (i === index ? { ...entry, startTime: event.target.value } : entry)),
                        )
                      }
                    />
                    <Input
                      type="time"
                      value={session.endTime}
                      onChange={(event) =>
                        setSessions((prev) =>
                          prev.map((entry, i) => (i === index ? { ...entry, endTime: event.target.value } : entry)),
                        )
                      }
                    />
                    <Input
                      placeholder="Room"
                      value={session.room}
                      onChange={(event) =>
                        setSessions((prev) =>
                          prev.map((entry, i) => (i === index ? { ...entry, room: event.target.value } : entry)),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSessions((prev) => prev.filter((_, i) => i !== index))}
                      disabled={sessions.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
                Create Course
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Course List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_260px]">
            <Input placeholder="Search courses" value={query} onChange={(event) => setQuery(event.target.value)} />
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
            <p className="text-sm text-muted-foreground">No courses found.</p>
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
                        {course.semester?.title ?? "No semester"} | {course.instructor ?? "No instructor"} |{" "}
                        {course.location ?? "No location"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Sessions: {(course.sessions as CourseSession[] | undefined)?.length ?? 0} | Files:{" "}
                        {course._count?.files ?? 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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
    </section>
  );
}
