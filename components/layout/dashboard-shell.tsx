"use client";

import type React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarCheck2,
  CalendarClock,
  Files,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/layout/notification-center";
import { apiFetch, parseClientError } from "@/lib/client-api";
import { pushToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type MeResponse = {
  id: string;
  name: string;
  email: string;
};

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/semesters", label: "Semesters", icon: FolderKanban },
  { href: "/dashboard/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/exams", label: "Exams", icon: CalendarCheck2 },
  { href: "/dashboard/planner", label: "Planner", icon: CalendarCheck2 },
  { href: "/dashboard/files", label: "File Manager", icon: Files },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
];

type Props = {
  children: React.ReactNode;
};

export function DashboardShell({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        const me = await apiFetch<MeResponse>("/api/v1/auth/me", { cache: "no-store" });
        if (!active) return;
        setUser(me);
      } catch (err) {
        if (!active) return;
        const parsed = parseClientError(err);
        if (parsed.status === 401) {
          router.replace("/login");
          return;
        }
        router.replace("/login");
      } finally {
        if (active) {
          setLoadingUser(false);
        }
      }
    }

    loadMe();
    return () => {
      active = false;
    };
  }, [router]);

  const userLabel = useMemo(() => {
    if (loadingUser) return "Loading...";
    if (!user) return "Student";
    return user.name;
  }, [loadingUser, user]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiFetch<{ loggedOut: boolean }>("/api/v1/auth/logout", {
        method: "POST",
      });
      router.replace("/login");
      router.refresh();
    } catch (err) {
      const parsed = parseClientError(err);
      pushToast({
        tone: "error",
        title: "Logout failed",
        description: parsed.message,
      });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.17),_transparent_35%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(191_40%_97%)_100%)]">
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-72 flex-col border-e border-border/70 bg-background/80 p-5 backdrop-blur-md md:flex">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Student Dashboard</p>
            <h1 className="mt-1 text-xl font-bold">Academic Manager</h1>
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
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm">
              <UserRound className="h-4 w-4 text-primary" />
              <p className="truncate font-medium">{userLabel}</p>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
            <Button className="mt-3 w-full" variant="outline" onClick={handleLogout} disabled={loggingOut}>
              <LogOut className="me-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-md md:hidden">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Student Dashboard</p>
              <Button size="icon" variant="outline" onClick={() => setMenuOpen((prev) => !prev)}>
                {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
            {menuOpen && (
              <div className="mt-3 space-y-2 rounded-lg border border-border bg-background p-2">
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
                  Logout
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
