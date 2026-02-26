"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client-api";
import { weekdayLabel } from "@/lib/fa";
import { toPanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";
import type { Course, ScheduleEntry, Semester, Weekday } from "@/types/dashboard";

const weekdays: Array<Weekday | ""> = [
  "",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export function SchedulePanel() {
  const router = useRouter();
  const [items, setItems] = useState<ScheduleEntry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [weekday, setWeekday] = useState<Weekday | "">("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (semesterId) params.set("semesterId", semesterId);
      if (courseId) params.set("courseId", courseId);
      if (weekday) params.set("weekday", weekday);

      const [scheduleData, courseData, semesterData] = await Promise.all([
        apiFetch<ScheduleEntry[]>(`/api/v1/schedule?${params.toString()}`),
        apiFetch<{ items: Course[]; total: number }>("/api/v1/courses?limit=200&offset=0"),
        apiFetch<Semester[]>("/api/v1/semesters"),
      ]);
      setItems(scheduleData);
      setCourses(courseData.items);
      setSemesters(semesterData);
    } catch (err) {
      const parsed = toPanelError(err, "بارگذاری برنامه هفتگی انجام نشد");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({ tone: "error", title: "بارگذاری ناموفق بود", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }, [query, semesterId, courseId, weekday, router]);

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

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">برنامه هفتگی</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>جدول کلاس ها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input placeholder="جستجوی برنامه کلاسی" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={semesterId}
              onChange={(event) => setSemesterId(event.target.value)}
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
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              <option value="">همه درس ها</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={weekday}
              onChange={(event) => setWeekday(event.target.value as Weekday | "")}
            >
              {weekdays.map((day) => (
                <option key={day || "ALL"} value={day}>
                  {weekdayLabel(day)}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex min-h-24 items-center justify-center">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">ورودی برنامه ای پیدا نشد.</p>
          ) : (
            <div className="space-y-2">
              {items.map((entry) => (
                <article key={entry.sessionId} className="rounded-md border border-border/70 p-3">
                  <p className="font-semibold">
                    {entry.course.name} {entry.course.code ? `(${entry.course.code})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {weekdayLabel(entry.weekday)} | {entry.startTime}-{entry.endTime} | {entry.room ?? "بدون کلاس"}
                  </p>
                  <p className="text-xs text-muted-foreground">{entry.course.semesterTitle}</p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

