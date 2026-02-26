"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  FileUp,
  GraduationCap,
  LoaderCircle,
  RotateCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/client-api";
import { formatDate, formatDateTime, weekdayLabel } from "@/lib/fa";
import { toPanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";
import { formatFileSize } from "@/lib/utils";
import type { Exam, FileItem, ScheduleEntry, Semester, UserProfile } from "@/types/dashboard";

type SummaryResponse = {
  profile: UserProfile | null;
  semesters: Semester[];
  upcomingExams: Exam[];
  todaySchedule: ScheduleEntry[];
  recentFiles: FileItem[];
  planner: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    archived: number;
  };
};

export function OverviewPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [data, setData] = useState<SummaryResponse | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      const summary = await apiFetch<SummaryResponse>("/api/v1/dashboard/summary");
      setData(summary);
    } catch (err) {
      const parsed = toPanelError(err, "بارگذاری داشبورد انجام نشد");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      setLoadFailed(true);
      pushToast({ tone: "error", title: "بارگذاری ناموفق بود", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtime({
    onMessage: (message) => {
      const watched = [
        "planner.created",
        "planner.updated",
        "planner.deleted",
        "exam.created",
        "exam.updated",
        "exam.deleted",
        "file.created",
        "file.updated",
        "file.deleted",
        "semester.updated",
        "course.updated",
        "profile.updated",
      ];
      if (watched.includes(message.type)) {
        loadData();
      }
    },
  });

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">داده های داشبورد بارگذاری نشد.</p>
        <Button variant="outline" onClick={loadData}>
          <RotateCw className="me-2 h-4 w-4" />
          تلاش دوباره
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const currentSemester = data.semesters.find((item) => item.isCurrent) ?? null;
  const pinnedFiles = data.recentFiles.filter((file) => file.isPinned);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">داشبورد دانشجو</h2>
        <p className="text-sm text-muted-foreground">نمای کلی برنامه ریزی، کلاس ها، امتحانات و فایل ها</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="کارهای برنامه ریزی" value={data.planner.total} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatsCard title="امتحانات پیش رو" value={data.upcomingExams.length} icon={<GraduationCap className="h-4 w-4" />} />
        <StatsCard title="جلسه های کلاسی" value={data.todaySchedule.length} icon={<CalendarClock className="h-4 w-4" />} />
        <StatsCard title="فایل های اخیر" value={data.recentFiles.length} icon={<FileUp className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ترم جاری</CardTitle>
            <CardDescription>{currentSemester ? "ترم فعال" : "ترم فعالی انتخاب نشده است"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentSemester ? (
              <>
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <p className="font-semibold">{currentSemester.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(currentSemester.startDate)} تا {formatDate(currentSemester.endDate)}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">تعداد کل ترم ها: {data.semesters.length}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">برای شروع مدیریت درس ها و امتحانات، یک ترم ایجاد کنید.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>خلاصه پروفایل</CardTitle>
            <CardDescription>اطلاعات هویتی و تحصیلی</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="mb-3">
              {data.profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.profile.avatarUrl}
                  alt="تصویر پروفایل"
                  className="h-20 w-20 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground">
                  بدون عکس
                </div>
              )}
            </div>
            <p className="text-sm">
              <span className="text-muted-foreground">نام: </span>
              {data.profile?.name ?? "-"}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">شماره دانشجویی: </span>
              {data.profile?.studentId ?? "-"}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">دانشگاه: </span>
              {data.profile?.university ?? "-"}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">رشته: </span>
              {data.profile?.major ?? "-"}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">ترم فعلی: </span>
              {data.profile?.currentTerm ?? "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>امتحانات پیش رو</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.upcomingExams.length === 0 ? (
              <p className="text-sm text-muted-foreground">امتحان ثبت نشده است.</p>
            ) : (
              data.upcomingExams.slice(0, 5).map((exam) => (
                <div key={exam.id} className="rounded-md border border-border/70 p-2">
                  <p className="text-sm font-medium">{exam.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(exam.examDate)}</p>
                  {exam.course && <Badge variant="outline">{exam.course.name}</Badge>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>برنامه هفتگی</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.todaySchedule.length === 0 ? (
              <p className="text-sm text-muted-foreground">جلسه کلاسی ثبت نشده است.</p>
            ) : (
              data.todaySchedule.slice(0, 8).map((entry) => (
                <div key={entry.sessionId} className="rounded-md border border-border/70 p-2">
                  <p className="text-sm font-medium">
                    {entry.course.name} {entry.course.code ? `(${entry.course.code})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {weekdayLabel(entry.weekday)} | {entry.startTime}-{entry.endTime}
                  </p>
                  <p className="text-xs text-muted-foreground">{entry.room ?? "بدون کلاس"}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>فایل های سنجاق شده</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pinnedFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">فایل سنجاق شده ای وجود ندارد.</p>
            ) : (
              pinnedFiles.slice(0, 8).map((file) => (
                <div key={file.id} className="rounded-md border border-border/70 p-2">
                  <p className="text-sm font-medium">{file.originalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)} | {formatDateTime(file.createdAt)}
                  </p>
                  {file.folder && <p className="text-xs text-muted-foreground">پوشه: {file.folder.name}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function StatsCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
