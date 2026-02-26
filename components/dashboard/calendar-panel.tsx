"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  setHours,
  setMinutes,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client-api";
import { plannerStatusLabel, weekdayLabel } from "@/lib/fa";
import { toPanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";
import type {
  CalendarExamEvent,
  CalendarPlannerEvent,
  CalendarSessionEvent,
  Course,
  PlannerItem,
  PlannerStatus,
  Semester,
  Weekday,
} from "@/types/dashboard";

type ViewMode = "week" | "month";
type CalendarResponse = {
  plannerItems: CalendarPlannerEvent[];
  exams: CalendarExamEvent[];
  sessions: CalendarSessionEvent[];
};

const statusFilters: Array<"" | PlannerStatus> = ["", "TODO", "IN_PROGRESS", "DONE", "ARCHIVED"];

function weekdayToDayIndex(weekday: Weekday) {
  const map: Record<Weekday, number> = {
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
    SUNDAY: 0,
  };
  return map[weekday];
}

function dateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function parseEventDate(item: { dueAt: string | null; startAt: string | null }) {
  if (item.dueAt) return parseISO(item.dueAt);
  if (item.startAt) return parseISO(item.startAt);
  return null;
}

export function CalendarPanel() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [focusDate, setFocusDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState<"" | PlannerStatus>("");
  const [draggingPlannerId, setDraggingPlannerId] = useState<string | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [plannerItems, setPlannerItems] = useState<CalendarPlannerEvent[]>([]);
  const [examItems, setExamItems] = useState<CalendarExamEvent[]>([]);
  const [sessionItems, setSessionItems] = useState<CalendarSessionEvent[]>([]);

  const range = useMemo(() => {
    if (viewMode === "week") {
      const from = startOfWeek(focusDate, { weekStartsOn: 1 });
      const to = endOfWeek(focusDate, { weekStartsOn: 1 });
      return { from, to };
    }

    const from = startOfWeek(startOfMonth(focusDate), { weekStartsOn: 1 });
    const to = endOfWeek(endOfMonth(focusDate), { weekStartsOn: 1 });
    return { from, to };
  }, [focusDate, viewMode]);

  const days = useMemo(() => eachDayOfInterval({ start: range.from, end: range.to }), [range]);

  const loadCalendar = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("from", range.from.toISOString());
      params.set("to", range.to.toISOString());
      if (query.trim()) params.set("q", query.trim());
      if (semesterId) params.set("semesterId", semesterId);
      if (courseId) params.set("courseId", courseId);
      if (status) params.set("status", status);

      const [calendar, semestersData, coursesData] = await Promise.all([
        apiFetch<CalendarResponse>(`/api/v1/calendar?${params.toString()}`),
        apiFetch<Semester[]>("/api/v1/semesters"),
        apiFetch<{ items: Course[]; total: number }>("/api/v1/courses?limit=200&offset=0"),
      ]);

      setPlannerItems(calendar.plannerItems);
      setExamItems(calendar.exams);
      setSessionItems(calendar.sessions);
      setSemesters(semestersData);
      setCourses(coursesData.items);
    } catch (err) {
      const parsed = toPanelError(err, "بارگذاری تقویم انجام نشد");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({ tone: "error", title: "بارگذاری ناموفق بود", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }, [courseId, query, range.from, range.to, router, semesterId, status]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  useRealtime({
    onMessage: (message) => {
      const watched = [
        "planner.created",
        "planner.updated",
        "planner.deleted",
        "exam.created",
        "exam.updated",
        "exam.deleted",
        "course.updated",
      ];
      if (watched.includes(message.type)) {
        loadCalendar();
      }
    },
  });

  const plannerByDay = useMemo(() => {
    const map = new Map<string, CalendarPlannerEvent[]>();
    for (const item of plannerItems) {
      const dt = parseEventDate(item);
      if (!dt) continue;
      const key = dateKey(dt);
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }
    return map;
  }, [plannerItems]);

  const examsByDay = useMemo(() => {
    const map = new Map<string, CalendarExamEvent[]>();
    for (const exam of examItems) {
      const key = dateKey(parseISO(exam.examDate));
      const current = map.get(key) ?? [];
      current.push(exam);
      map.set(key, current);
    }
    return map;
  }, [examItems]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, CalendarSessionEvent[]>();
    for (const day of days) {
      const dayIndex = day.getDay();
      const relevant = sessionItems.filter((session) => weekdayToDayIndex(session.weekday) === dayIndex);
      if (relevant.length > 0) {
        map.set(dateKey(day), relevant);
      }
    }
    return map;
  }, [days, sessionItems]);

  function moveRange(direction: "prev" | "next") {
    if (viewMode === "week") {
      setFocusDate((prev) => (direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1)));
      return;
    }
    setFocusDate((prev) => (direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)));
  }

  async function handleDropOnDate(targetDate: Date) {
    if (!draggingPlannerId) return;
    const item = plannerItems.find((entry) => entry.id === draggingPlannerId);
    if (!item) return;

    const anchor = parseEventDate(item);
    const oldDate = anchor ? new Date(anchor) : new Date();
    const diffDays = differenceInCalendarDays(targetDate, oldDate);

    const oldDue = item.dueAt ? parseISO(item.dueAt) : null;
    const oldStart = item.startAt ? parseISO(item.startAt) : null;

    const nextDue = oldDue
      ? addDays(oldDue, diffDays)
      : setMinutes(setHours(targetDate, 12), 0);
    const nextStart = oldStart ? addDays(oldStart, diffDays) : null;

    try {
      const updated = await apiFetch<PlannerItem>(`/api/v1/planner/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          dueAt: nextDue.toISOString(),
          startAt: nextStart ? nextStart.toISOString() : item.startAt,
        }),
      });

      setPlannerItems((prev) =>
        prev.map((entry) =>
          entry.id === updated.id
            ? {
                ...entry,
                dueAt: updated.dueAt,
                startAt: updated.startAt,
                status: updated.status,
                priority: updated.priority,
                isPinned: updated.isPinned,
              }
            : entry,
        ),
      );
    } catch (err) {
      const parsed = toPanelError(err, "جابجایی آیتم برنامه ریزی انجام نشد");
      pushToast({ tone: "error", title: "جابجایی ناموفق بود", description: parsed.message });
    } finally {
      setDraggingPlannerId(null);
    }
  }

  function dayLabel(date: Date) {
    return date.toLocaleDateString("fa-IR-u-ca-persian", { weekday: "short", day: "2-digit" });
  }

  const rangeLabel =
    viewMode === "week"
      ? `${range.from.toLocaleDateString("fa-IR-u-ca-persian", { month: "long", day: "numeric" })} تا ${range.to.toLocaleDateString("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" })}`
      : focusDate.toLocaleDateString("fa-IR-u-ca-persian", { year: "numeric", month: "long" });

  const isMonthView = viewMode === "month";
  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("from", range.from.toISOString());
    params.set("to", range.to.toISOString());
    if (query.trim()) params.set("q", query.trim());
    if (semesterId) params.set("semesterId", semesterId);
    if (courseId) params.set("courseId", courseId);
    if (status) params.set("status", status);
    return `/api/v1/calendar/ics?${params.toString()}`;
  }, [range.from, range.to, query, semesterId, courseId, status]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">تقویم</h2>
          <p className="text-sm text-muted-foreground">نمای هفتگی و ماهانه با امکان جابجایی آیتم های برنامه ریزی</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={exportUrl}>خروجی تقویم</a>
          </Button>
          <Button variant={viewMode === "week" ? "default" : "outline"} onClick={() => setViewMode("week")}>
            هفتگی
          </Button>
          <Button variant={viewMode === "month" ? "default" : "outline"} onClick={() => setViewMode("month")}>
            ماهانه
          </Button>
          <Button variant="outline" onClick={() => setFocusDate(new Date())}>
            امروز
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>فیلترها</CardTitle>
          <CardDescription>جستجو و فیلتر داده های تقویم</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input placeholder="جستجو در عنوان یا درس" value={query} onChange={(event) => setQuery(event.target.value)} />
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
            value={status}
            onChange={(event) => setStatus(event.target.value as "" | PlannerStatus)}
          >
            {statusFilters.map((statusItem) => (
              <option key={statusItem || "ALL"} value={statusItem}>
                {plannerStatusLabel(statusItem)}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{rangeLabel}</CardTitle>
            <CardDescription>برای تغییر تاریخ، کارت برنامه ریزی را بکشید و رها کنید.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => moveRange("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => moveRange("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-60 items-center justify-center">
              <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className={`grid gap-3 ${isMonthView ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-7" : "grid-cols-1 xl:grid-cols-7"}`}>
              {days.map((day) => {
                const key = dateKey(day);
                const planner = plannerByDay.get(key) ?? [];
                const exams = examsByDay.get(key) ?? [];
                const sessions = sessionsByDay.get(key) ?? [];
                const inCurrentMonth = isMonthView ? isSameMonth(day, focusDate) : true;

                return (
                  <div
                    key={key}
                    className={`min-h-[160px] rounded-md border border-border/70 p-2 ${
                      inCurrentMonth ? "bg-background" : "bg-muted/35"
                    }`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDropOnDate(day)}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className={`text-xs font-semibold ${isSameDay(day, new Date()) ? "text-primary" : "text-muted-foreground"}`}>
                        {dayLabel(day)}
                      </p>
                      {(planner.length + exams.length + sessions.length) > 0 && (
                        <Badge variant="outline">{planner.length + exams.length + sessions.length}</Badge>
                      )}
                    </div>

                    <div className="space-y-1">
                      {sessions.map((session) => (
                        <div key={`${session.id}-${key}`} className="rounded bg-sky-100 px-2 py-1 text-[11px] text-sky-900">
                          کلاس {session.startTime} {session.course.code ? `| ${session.course.code}` : ""}
                        </div>
                      ))}

                      {exams.map((exam) => (
                        <div key={exam.id} className="rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-900">
                          امتحان {exam.title}
                        </div>
                      ))}

                      {planner.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          draggable
                          onDragStart={() => setDraggingPlannerId(item.id)}
                          className="w-full rounded bg-emerald-100 px-2 py-1 text-start text-[11px] text-emerald-900"
                          title={`${item.title}${item.course ? ` (${item.course.name})` : ""}`}
                        >
                          {item.title}
                        </button>
                      ))}

                      {planner.length === 0 && exams.length === 0 && sessions.length === 0 && (
                        <div className="rounded border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground">
                          <CalendarDays className="me-1 inline h-3 w-3" />
                          خالی
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

