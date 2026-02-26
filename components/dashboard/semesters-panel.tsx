"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pin, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client-api";
import { formatDate } from "@/lib/fa";
import { toPanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";
import type { Semester } from "@/types/dashboard";

export function SemestersPanel() {
  const router = useRouter();
  const [items, setItems] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const loadSemesters = useCallback(async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (query.trim()) qs.set("q", query.trim());
      const data = await apiFetch<Semester[]>(`/api/v1/semesters?${qs.toString()}`);
      setItems(data);
    } catch (err) {
      const parsed = toPanelError(err, "بارگذاری ترم ها انجام نشد");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({ tone: "error", title: "بارگذاری ناموفق بود", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }, [query, router]);

  useEffect(() => {
    loadSemesters();
  }, [loadSemesters]);

  useRealtime({
    onMessage: (message) => {
      if (
        ["semester.created", "semester.updated", "semester.deleted", "course.created", "course.updated", "course.deleted", "file.created", "file.updated", "file.deleted"].includes(
          message.type,
        )
      ) {
        loadSemesters();
      }
    },
  });

  async function toggleSemesterPin(item: Semester) {
    try {
      await apiFetch<Semester>(`/api/v1/semesters/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPinned: !item.isPinned }),
      });
      await loadSemesters();
    } catch (err) {
      const parsed = toPanelError(err, "بروزرسانی ترم انجام نشد");
      pushToast({ tone: "error", title: "بروزرسانی ناموفق بود", description: parsed.message });
    }
  }

  async function removeSemester(id: string) {
    if (!window.confirm("این ترم حذف شود؟")) return;
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/semesters/${id}`, { method: "DELETE" });
      pushToast({ tone: "success", title: "ترم حذف شد" });
      await loadSemesters();
    } catch (err) {
      const parsed = toPanelError(err, "حذف ترم انجام نشد");
      pushToast({ tone: "error", title: "حذف ناموفق بود", description: parsed.message });
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">ترم ها</h2>
          <p className="text-sm text-muted-foreground">هر ترم صفحه اختصاصی برای مدیریت درس ها و فایل ها دارد.</p>
        </div>
        <Button asChild type="button">
          <Link href="/dashboard/semesters/new">
            <Plus className="me-2 h-4 w-4" />
            ایجاد ترم جدید
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>لیست ترم ها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="جستجوی ترم" value={query} onChange={(event) => setQuery(event.target.value)} />
          {loading ? (
            <div className="flex min-h-24 items-center justify-center">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">ترمی پیدا نشد.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <article key={item.id} className="rounded-md border border-border/80 bg-background p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.startDate)} تا {formatDate(item.endDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        درس ها: {item._count?.courses ?? 0} | امتحانات: {item._count?.exams ?? 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild type="button" variant="outline">
                        <Link href={`/dashboard/semesters/${item.id}`}>ورود به صفحه ترم</Link>
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
    </section>
  );
}

