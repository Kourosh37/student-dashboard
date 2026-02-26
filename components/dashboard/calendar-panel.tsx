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
import { Modal } from "@/components/ui/modal";
import { ApiClientError, apiFetch } from "@/lib/client-api";
import { plannerStatusLabel } from "@/lib/fa";
import { toPanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";
import type {
  CalendarExamEvent,
  CalendarPlannerEvent,
  CalendarSessionEvent,
  CalendarUserEvent,
  Course,
  PlannerItem,
  PlannerStatus,
  ScheduleConflict,
  Semester,
  Weekday,
} from "@/types/dashboard";

type ViewMode = "week" | "month";
type CalendarResponse = {
  plannerItems: CalendarPlannerEvent[];
  events: CalendarUserEvent[];
  exams: CalendarExamEvent[];
  sessions: CalendarSessionEvent[];
};

type DayTimelineItem = {
  id: string;
  type: "CLASS" | "PLANNER" | "EVENT" | "EXAM";
  title: string;
  subtitle: string;
  startAt: Date;
  endAt: Date;
  colorClass: string;
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

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function parseEventDate(item: { dueAt: string | null; startAt: string | null; plannedFor: string | null }) {
  if (item.startAt) return parseISO(item.startAt);
  if (item.dueAt) return parseISO(item.dueAt);
  if (item.plannedFor) return parseISO(item.plannedFor);
  return null;
}

function parsePlannerInterval(item: CalendarPlannerEvent) {
  const anchor = parseEventDate(item);
  if (!anchor) return null;

  const start = item.startAt ? parseISO(item.startAt) : anchor;
  const due = item.dueAt ? parseISO(item.dueAt) : null;

  if (!due) return { startAt: start, endAt: addMinutes(start, 60) };
  if (due.getTime() >= start.getTime()) return { startAt: start, endAt: due };
  return { startAt: due, endAt: start };
}

function parseTimeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function combineDayAndTime(day: Date, time: string) {
  const minutes = parseTimeToMinutes(time);
  const result = new Date(day);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

function toClockLabel(date: Date) {
  return date.toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [plannerItems, setPlannerItems] = useState<CalendarPlannerEvent[]>([]);
  const [eventItems, setEventItems] = useState<CalendarUserEvent[]>([]);
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
      setEventItems(calendar.events);
      setExamItems(calendar.exams);
      setSessionItems(calendar.sessions);
      setSemesters(semestersData);
      setCourses(coursesData.items);
    } catch (error) {
      const parsed = toPanelError(error, "بارگذاری تقویم انجام نشد");
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
        "event.created",
        "event.updated",
        "event.deleted",
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

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarUserEvent[]>();
    for (const item of eventItems) {
      const key = dateKey(parseISO(item.startAt));
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }
    return map;
  }, [eventItems]);

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

  const selectedDayItems = useMemo(() => {
    if (!selectedDay) return [] as DayTimelineItem[];

    const key = dateKey(selectedDay);
    const items: DayTimelineItem[] = [];

    const selectedPlanner = plannerByDay.get(key) ?? [];
    for (const item of selectedPlanner) {
      const interval = parsePlannerInterval(item);
      if (!interval) continue;

      items.push({
        id: `planner-${item.id}`,
        type: "PLANNER",
        title: item.title,
        subtitle: item.status === "DONE" ? "انجام شده" : plannerStatusLabel(item.status),
        startAt: interval.startAt,
        endAt: interval.endAt,
        colorClass: "bg-emerald-100 text-emerald-900",
      });
    }

    const selectedEvents = eventsByDay.get(key) ?? [];
    for (const item of selectedEvents) {
      const startAt = parseISO(item.startAt);
      const endAt = item.endAt ? parseISO(item.endAt) : addMinutes(startAt, 60);

      items.push({
        id: `event-${item.id}`,
        type: "EVENT",
        title: item.title,
        subtitle: item.location ? `مکان: ${item.location}` : "رویداد شخصی",
        startAt,
        endAt,
        colorClass: "bg-violet-100 text-violet-900",
      });
    }

    const selectedExams = examsByDay.get(key) ?? [];
    for (const item of selectedExams) {
      const startAt = parseISO(item.examDate);
      const endAt = addMinutes(startAt, item.durationMinutes ?? 90);

      items.push({
        id: `exam-${item.id}`,
        type: "EXAM",
        title: item.title,
        subtitle: item.course?.name ?? "امتحان",
        startAt,
        endAt,
        colorClass: "bg-amber-100 text-amber-900",
      });
    }

    const selectedSessions = sessionsByDay.get(key) ?? [];
    for (const item of selectedSessions) {
      const startAt = combineDayAndTime(selectedDay, item.startTime);
      const endAt = combineDayAndTime(selectedDay, item.endTime);

      items.push({
        id: `class-${item.id}`,
        type: "CLASS",
        title: item.course.name,
        subtitle: item.room ? `کلاس: ${item.room}` : "کلاس",
        startAt,
        endAt,
        colorClass: "bg-sky-100 text-sky-900",
      });
    }

    return items.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }, [selectedDay, plannerByDay, eventsByDay, examsByDay, sessionsByDay]);

  function moveRange(direction: "prev" | "next") {
    if (viewMode === "week") {
      setFocusDate((prev) => (direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1)));
      return;
    }
    setFocusDate((prev) => (direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)));
  }

  async function patchPlannerWithOptionalOverride(itemId: string, payload: Record<string, unknown>) {
    try {
      return await apiFetch<PlannerItem>(`/api/v1/planner/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      const conflicts = extractConflicts(error);
      if (conflicts.length > 0 && askConflictOverride(conflicts)) {
        return apiFetch<PlannerItem>(`/api/v1/planner/${itemId}`, {
          method: "PATCH",
          body: JSON.stringify({ ...payload, allowConflicts: true }),
        });
      }
      throw error;
    }
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
    const oldPlannedFor = item.plannedFor ? parseISO(item.plannedFor) : null;

    const nextDue = oldDue
      ? addDays(oldDue, diffDays)
      : oldPlannedFor
        ? addDays(oldPlannedFor, diffDays)
        : setMinutes(setHours(targetDate, 12), 0);
    const nextStart = oldStart ? addDays(oldStart, diffDays) : null;
    const nextPlannedFor = oldPlannedFor ? addDays(oldPlannedFor, diffDays) : null;

    try {
      const updated = await patchPlannerWithOptionalOverride(item.id, {
        dueAt: nextDue.toISOString(),
        startAt: nextStart ? nextStart.toISOString() : item.startAt,
        plannedFor: nextPlannedFor ? nextPlannedFor.toISOString() : item.plannedFor,
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
                cadence: updated.cadence,
                plannedFor: updated.plannedFor,
                isPinned: updated.isPinned,
              }
            : entry,
        ),
      );
    } catch (error) {
      const parsed = toPanelError(error, "جابجایی آیتم برنامه ریزی انجام نشد");
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
      ? `${range.from.toLocaleDateString("fa-IR-u-ca-persian", { month: "long", day: "numeric" })} تا ${range.to.toLocaleDateString("fa-IR-u-ca-persian", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`
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
          <p className="text-sm text-muted-foreground">نمای هفتگی و ماهانه با رویداد، برنامه ریزی، امتحان و کلاس</p>
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
            <CardDescription>با کلیک روی هر روز، همه برنامه ها به ترتیب ساعت نمایش داده می شوند.</CardDescription>
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
                const events = eventsByDay.get(key) ?? [];
                const exams = examsByDay.get(key) ?? [];
                const sessions = sessionsByDay.get(key) ?? [];
                const inCurrentMonth = isMonthView ? isSameMonth(day, focusDate) : true;
                const total = planner.length + events.length + exams.length + sessions.length;

                return (
                  <button
                    type="button"
                    key={key}
                    className={`min-h-[170px] rounded-md border border-border/70 p-2 text-start ${
                      inCurrentMonth ? "bg-background" : "bg-muted/35"
                    }`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDropOnDate(day)}
                    onClick={() => setSelectedDay(day)}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className={`text-xs font-semibold ${isSameDay(day, new Date()) ? "text-primary" : "text-muted-foreground"}`}>
                        {dayLabel(day)}
                      </p>
                      {total > 0 && <Badge variant="outline">{total}</Badge>}
                    </div>

                    <div className="space-y-1">
                      {sessions.slice(0, 1).map((session) => (
                        <div key={`${session.id}-${key}`} className="rounded bg-sky-100 px-2 py-1 text-[11px] text-sky-900">
                          کلاس {session.startTime}
                        </div>
                      ))}

                      {events.slice(0, 1).map((item) => (
                        <div key={item.id} className="rounded bg-violet-100 px-2 py-1 text-[11px] text-violet-900">
                          رویداد {toClockLabel(parseISO(item.startAt))}
                        </div>
                      ))}

                      {exams.slice(0, 1).map((exam) => (
                        <div key={exam.id} className="rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-900">
                          امتحان {exam.title}
                        </div>
                      ))}

                      {planner.slice(0, 2).map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          draggable
                          onClick={(event) => event.stopPropagation()}
                          onDragStart={() => setDraggingPlannerId(item.id)}
                          className="w-full rounded bg-emerald-100 px-2 py-1 text-start text-[11px] text-emerald-900"
                          title={item.title}
                        >
                          {item.title}
                        </button>
                      ))}

                      {total === 0 && (
                        <div className="rounded border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground">
                          <CalendarDays className="me-1 inline h-3 w-3" />
                          خالی
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(selectedDay)}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? `برنامه روز ${selectedDay.toLocaleDateString("fa-IR-u-ca-persian", { day: "numeric", month: "long", year: "numeric" })}` : "برنامه روز"}
        description="همه موارد این روز به ترتیب ساعت"
      >
        {selectedDayItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">برای این روز موردی ثبت نشده است.</p>
        ) : (
          <div className="space-y-2">
            {selectedDayItems.map((item) => (
              <article key={item.id} className={`rounded-md px-3 py-2 ${item.colorClass}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs">
                    {toClockLabel(item.startAt)} - {toClockLabel(item.endAt)}
                  </p>
                </div>
                <p className="text-xs opacity-85">{item.subtitle}</p>
              </article>
            ))}
          </div>
        )}
      </Modal>
    </section>
  );
}
