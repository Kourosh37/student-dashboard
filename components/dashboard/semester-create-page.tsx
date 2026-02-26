"use client";

import type React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, LoaderCircle, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client-api";
import { fieldError, toPanelError, type PanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import type { Semester } from "@/types/dashboard";

export function SemesterCreatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<PanelError | null>(null);
  const [form, setForm] = useState({
    title: "",
    code: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    isPinned: false,
  });

  async function createSemester(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const created = await apiFetch<Semester>("/api/v1/semesters", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          code: form.code || null,
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
        }),
      });

      pushToast({ tone: "success", title: "ترم ایجاد شد" });
      router.push(`/dashboard/semesters/${created.id}`);
      router.refresh();
    } catch (err) {
      const parsed = toPanelError(err, "ایجاد ترم انجام نشد");
      setFormError(parsed);
      pushToast({ tone: "error", title: "ایجاد ناموفق بود", description: parsed.message });
    } finally {
      setSaving(false);
    }
  }

  const titleError = fieldError(formError?.fieldErrors ?? {}, "title");
  const startError = fieldError(formError?.fieldErrors ?? {}, "startDate");
  const endError = fieldError(formError?.fieldErrors ?? {}, "endDate");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">ایجاد ترم جدید</h2>
          <p className="text-sm text-muted-foreground">پس از ایجاد، وارد صفحه اختصاصی ترم می شوید.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/semesters">
            <ArrowRight className="me-2 h-4 w-4" />
            بازگشت به ترم ها
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>فرم ترم</CardTitle>
          <CardDescription>اطلاعات اصلی ترم را تکمیل کنید.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={createSemester}>
            <div className="space-y-2 md:col-span-2">
              <Label>عنوان</Label>
              <Input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                aria-invalid={Boolean(titleError)}
                required
              />
              {titleError && <p className="text-xs text-destructive">{titleError}</p>}
            </div>

            <div className="space-y-2">
              <Label>کد ترم</Label>
              <Input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>تاریخ شروع</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                aria-invalid={Boolean(startError)}
                required
              />
              {startError && <p className="text-xs text-destructive">{startError}</p>}
            </div>

            <div className="space-y-2">
              <Label>تاریخ پایان</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                aria-invalid={Boolean(endError)}
                required
              />
              {endError && <p className="text-xs text-destructive">{endError}</p>}
            </div>

            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={form.isCurrent}
                onChange={(event) => setForm((prev) => ({ ...prev, isCurrent: event.target.checked }))}
              />
              انتخاب به عنوان ترم جاری
            </label>

            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={form.isPinned}
                onChange={(event) => setForm((prev) => ({ ...prev, isPinned: event.target.checked }))}
              />
              سنجاق کردن ترم
            </label>

            <div className="md:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
                ایجاد ترم
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
