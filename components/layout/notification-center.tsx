"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, LoaderCircle, RefreshCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/client-api";
import { plannerCadenceLabel } from "@/lib/fa";
import { toPanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";

type ReminderItem = {
  id: string;
  type: "PLANNER" | "EXAM" | "EVENT";
  title: string;
  when: string;
  cadence: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  course: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  semester: {
    id: string;
    title: string;
  } | null;
};

type ReminderResponse = {
  windowHours: number;
  count: number;
  items: ReminderItem[];
};

const STORAGE_KEY = "student_dashboard_notified_reminders";

export function NotificationCenter() {
  const [items, setItems] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [notificationSupported, setNotificationSupported] = useState(false);
  const [secureContext, setSecureContext] = useState(false);
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  const count = items.length;
  const hasCritical = useMemo(() => items.length > 0, [items.length]);

  const loadReminders = useCallback(async () => {
    try {
      const response = await apiFetch<ReminderResponse>("/api/v1/notifications/reminders?hours=24&limit=20", { cache: "no-store" });
      setItems(response.items);
    } catch (err) {
      const parsed = toPanelError(err, "بارگذاری یادآورها انجام نشد");
      pushToast({ tone: "error", title: "همگام سازی یادآورها ناموفق بود", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useRealtime({
    onMessage: (message) => {
      const syncTypes = [
        "planner.created",
        "planner.updated",
        "planner.deleted",
        "exam.created",
        "exam.updated",
        "exam.deleted",
        "event.created",
        "event.updated",
        "event.deleted",
      ];
      if (syncTypes.includes(message.type)) {
        loadReminders();
      }
    },
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSecureContext(window.isSecureContext);
      const supported = "Notification" in window;
      setNotificationSupported(supported);
      if (supported) {
        setPermission(Notification.permission);
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as string[];
          notifiedIdsRef.current = new Set(parsed);
        } catch {
          // Ignore invalid persisted state.
        }
      }
    }

    loadReminders();
    const timer = setInterval(loadReminders, 60_000);
    return () => clearInterval(timer);
  }, [loadReminders]);

  useEffect(() => {
    if (permission !== "granted" || typeof window === "undefined") return;

    const notified = notifiedIdsRef.current;
    let changed = false;
    for (const item of items) {
      if (notified.has(item.id)) continue;
      const when = new Date(item.when);
      const bodyParts = [formatDistanceToNow(when, { addSuffix: true, locale: faIR })];
      if (item.type === "PLANNER" && item.cadence) bodyParts.push(plannerCadenceLabel(item.cadence));
      if (item.course?.name) bodyParts.push(item.course.name);
      new Notification(item.type === "EXAM" ? "امتحان نزدیک" : item.type === "EVENT" ? "رویداد نزدیک" : "کار نزدیک", {
        body: `${item.title} | ${bodyParts.join(" | ")}`,
      });
      notified.add(item.id);
      changed = true;
    }

    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...notified]));
    }
  }, [items, permission]);

  async function enableBrowserNotifications() {
    if (typeof window === "undefined") return;

    if (!notificationSupported) {
      pushToast({
        tone: "error",
        title: "اعلان مرورگر پشتیبانی نمی شود",
        description: "مرورگر فعلی شما از Notification API پشتیبانی نمی کند.",
      });
      return;
    }

    if (!secureContext) {
      pushToast({
        tone: "error",
        title: "بستر ناامن",
        description: "برای فعال سازی اعلان مرورگر باید روی HTTPS یا localhost باشید.",
      });
      return;
    }

    if (permission === "denied") {
      pushToast({
        tone: "error",
        title: "اعلان مسدود شده است",
        description: "اجازه اعلان برای این سایت بسته است. از تنظیمات مرورگر آن را روی Allow بگذارید.",
      });
      return;
    }

    if (permission === "granted") {
      pushToast({ tone: "default", title: "اعلان مرورگر فعال است" });
      return;
    }

    setRequestingPermission(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        pushToast({ tone: "success", title: "اعلان مرورگر فعال شد" });
        new Notification("اعلان فعال شد", {
          body: "از این پس یادآوری های نزدیک برای شما نمایش داده می شوند.",
        });
      } else if (result === "denied") {
        pushToast({
          tone: "error",
          title: "اجازه اعلان داده نشد",
          description: "برای فعال سازی، اجازه اعلان را از تنظیمات مرورگر فعال کنید.",
        });
      } else {
        pushToast({ tone: "default", title: "درخواست اعلان لغو شد" });
      }
    } catch (error) {
      const parsed = toPanelError(error, "فعال سازی اعلان مرورگر انجام نشد");
      pushToast({ tone: "error", title: "فعال سازی ناموفق بود", description: parsed.message });
    } finally {
      setRequestingPermission(false);
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          {hasCritical ? <BellRing className="h-4 w-4 text-amber-600" /> : <Bell className="h-4 w-4" />}
          اعلان ها
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadReminders}>
            <RefreshCcw className="me-2 h-3.5 w-3.5" />
            بروزرسانی
          </Button>

          {permission !== "granted" ? (
            <Button size="sm" onClick={enableBrowserNotifications} disabled={requestingPermission}>
              {requestingPermission ? <LoaderCircle className="me-2 h-3.5 w-3.5 animate-spin" /> : null}
              {permission === "denied" ? "اعلان مسدود است" : "فعال سازی اعلان مرورگر"}
            </Button>
          ) : (
            <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">اعلان فعال است</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex min-h-12 items-center justify-center">
            <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          </div>
        ) : count === 0 ? (
          <p className="text-sm text-muted-foreground">در 24 ساعت آینده یادآوری ثبت نشده است.</p>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-md border border-border/70 p-2">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.type === "EXAM" ? "امتحان" : item.type === "EVENT" ? "رویداد" : "برنامه ریزی"} | {new Date(item.when).toLocaleString("fa-IR-u-ca-persian")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.type === "PLANNER"
                    ? `بازه: ${plannerCadenceLabel(item.cadence ?? "DAILY")}`
                    : item.type === "EVENT"
                      ? "رویداد شخصی"
                      : `${item.course ? `درس: ${item.course.name}` : "بدون درس"} | ${item.semester ? `ترم: ${item.semester.title}` : "بدون ترم"}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}