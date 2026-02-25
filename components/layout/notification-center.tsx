"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, LoaderCircle, RefreshCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/client-api";
import { toPanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import { useRealtime } from "@/lib/use-realtime";

type ReminderItem = {
  id: string;
  type: "PLANNER" | "EXAM";
  title: string;
  when: string;
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
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  const count = items.length;
  const hasCritical = useMemo(() => items.length > 0, [items.length]);

  const loadReminders = useCallback(async () => {
    try {
      const response = await apiFetch<ReminderResponse>("/api/v1/notifications/reminders?hours=24&limit=20");
      setItems(response.items);
    } catch (err) {
      const parsed = toPanelError(err, "Failed to load reminders");
      pushToast({ tone: "error", title: "Reminder sync failed", description: parsed.message });
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
      ];
      if (syncTypes.includes(message.type)) {
        loadReminders();
      }
    },
  });

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
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
      const bodyParts = [formatDistanceToNow(when, { addSuffix: true })];
      if (item.course?.name) bodyParts.push(item.course.name);
      new Notification(item.type === "EXAM" ? "Upcoming Exam" : "Upcoming Planner Task", {
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
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  return (
    <Card className="mb-4">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          {hasCritical ? <BellRing className="h-4 w-4 text-amber-600" /> : <Bell className="h-4 w-4" />}
          Notifications
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadReminders}>
            <RefreshCcw className="me-2 h-3.5 w-3.5" />
            Refresh
          </Button>
          {permission !== "granted" && (
            <Button size="sm" onClick={enableBrowserNotifications}>
              Enable Browser Alerts
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex min-h-12 items-center justify-center">
            <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          </div>
        ) : count === 0 ? (
          <p className="text-sm text-muted-foreground">No reminders in the next 24 hours.</p>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-md border border-border/70 p-2">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.type} | {new Date(item.when).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.course ? `Course: ${item.course.name}` : "No course"} |{" "}
                  {item.semester ? `Semester: ${item.semester.title}` : "No semester"}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
