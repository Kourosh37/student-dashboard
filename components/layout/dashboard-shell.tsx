"use client";

import type React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  Files,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
  X,
} from "lucide-react";

import { NotificationCenter } from "@/components/layout/notification-center";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client-api";
import { pushToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type MeResponse = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

const navItems = [
  { href: "/dashboard", label: "نمای کلی", icon: LayoutDashboard },
  { href: "/dashboard/semesters", label: "ترم ها", icon: FolderKanban },
  { href: "/dashboard/schedule", label: "برنامه هفتگی", icon: CalendarClock },
  { href: "/dashboard/calendar", label: "تقویم", icon: CalendarDays },
  { href: "/dashboard/exams", label: "امتحانات", icon: CalendarCheck2 },
  { href: "/dashboard/planner", label: "برنامه ریزی", icon: CalendarCheck2 },
  { href: "/dashboard/files", label: "مدیریت فایل", icon: Files },
  { href: "/dashboard/profile", label: "پروفایل", icon: UserRound },
];

type Props = {
  children: React.ReactNode;
};

function initials(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "D";
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

export function DashboardShell({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        const me = await apiFetch<MeResponse>("/api/v1/auth/me", { cache: "no-store" });
        if (!active) return;
        setUser(me);
      } catch {
        if (!active) return;
        router.replace("/login");
      } finally {
        if (active) setLoadingUser(false);
      }
    }

    loadMe();
    return () => {
      active = false;
    };
  }, [router]);

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(now),
    [now],
  );

  const timeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("fa-IR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(now),
    [now],
  );

  const userLabel = useMemo(() => {
    if (loadingUser) return "در حال بارگذاری...";
    return user?.name || "دانشجو";
  }, [loadingUser, user]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiFetch<{ loggedOut: boolean }>("/api/v1/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      pushToast({
        tone: "error",
        title: "خروج ناموفق بود",
        description: "لطفا دوباره تلاش کنید.",
      });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.18),_transparent_36%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(208_40%_95%)_100%)]">
      <div className="mx-auto flex max-w-[1700px]">
        <aside className="sticky top-0 hidden h-screen w-72 flex-col border-e border-border/90 bg-background/90 p-5 backdrop-blur-md md:flex">
          <div className="mb-8">
            <p className="text-xs font-semibold text-muted-foreground">داشبورد دانشجو</p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight">مدیریت تحصیلی</h1>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground/80 hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-border bg-muted/45 p-3">
            <div className="mb-3 flex items-center gap-3">
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="پروفایل" className="h-10 w-10 rounded-full border border-border object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {initials(user?.name ?? "D")}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{userLabel}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
              </div>
            </div>
            <Button className="w-full" variant="outline" onClick={handleLogout} disabled={loggingOut}>
              <LogOut className="me-2 h-4 w-4" />
              خروج
            </Button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/90 bg-background/92 px-4 py-3 backdrop-blur-md md:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-extrabold tracking-tight">داشبورد دانشجو</p>
                  <p className="text-xs text-muted-foreground">{dateLabel}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-center sm:block">
                  <p className="text-[11px] text-muted-foreground">ساعت</p>
                  <p className="text-sm font-semibold">{timeLabel}</p>
                </div>

                <div className="hidden items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 py-1.5 sm:flex">
                  {user?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="پروفایل" className="h-8 w-8 rounded-full border border-border object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                      {initials(user?.name ?? "D")}
                    </div>
                  )}
                  <p className="max-w-28 truncate text-xs font-medium">{userLabel}</p>
                </div>

                <Button className="md:hidden" size="icon" variant="outline" onClick={() => setMenuOpen((prev) => !prev)}>
                  {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {menuOpen && (
              <div className="mt-3 space-y-2 rounded-lg border border-border bg-background p-2 md:hidden">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  <LogOut className="h-4 w-4" />
                  خروج
                </button>
              </div>
            )}
          </header>

          <main className="flex-1 p-4 md:p-8">
            <NotificationCenter />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

