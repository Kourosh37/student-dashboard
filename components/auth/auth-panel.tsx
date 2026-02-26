"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, parseClientError } from "@/lib/client-api";
import { pushToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";
type FormErrorState = {
  message: string;
  code?: string;
  details: string[];
  fieldErrors: Record<string, string[]>;
};

const tabClass =
  "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors data-[active=true]:bg-primary data-[active=true]:text-primary-foreground";

function fieldError(fieldErrors: Record<string, string[]>, name: string) {
  return fieldErrors[name]?.[0] ?? "";
}

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState<FormErrorState | null>(null);
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const emailError = useMemo(
    () => fieldError(error?.fieldErrors ?? {}, "email"),
    [error?.fieldErrors],
  );
  const passwordError = useMemo(
    () => fieldError(error?.fieldErrors ?? {}, "password"),
    [error?.fieldErrors],
  );
  const nameError = useMemo(() => fieldError(error?.fieldErrors ?? {}, "name"), [error?.fieldErrors]);

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiFetch<{ id: string; name: string; email: string }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      const parsed = parseClientError(err);
      setError({
        message: parsed.message,
        code: parsed.code,
        details: parsed.issues.map((issue) => issue.message).filter(Boolean) as string[],
        fieldErrors: parsed.fieldErrors,
      });
      pushToast({ tone: "error", title: "ورود ناموفق بود", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiFetch<{ id: string; name: string; email: string }>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(registerForm),
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      const parsed = parseClientError(err);
      setError({
        message: parsed.message,
        code: parsed.code,
        details: parsed.issues.map((issue) => issue.message).filter(Boolean) as string[],
        fieldErrors: parsed.fieldErrors,
      });
      pushToast({ tone: "error", title: "ثبت نام ناموفق بود", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-primary/10 bg-background/85 backdrop-blur">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <CardTitle>داشبورد دانشجو</CardTitle>
        <CardDescription>برای ادامه وارد شوید</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex rounded-lg bg-muted p-1">
          <button
            type="button"
            className={cn(tabClass)}
            data-active={mode === "login"}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            ورود
          </button>
          <button
            type="button"
            className={cn(tabClass)}
            data-active={mode === "register"}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            ثبت نام
          </button>
        </div>

        {mode === "login" ? (
          <form className="space-y-4" onSubmit={submitLogin}>
            <div className="space-y-2">
              <Label htmlFor="login-email">ایمیل</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                aria-invalid={Boolean(emailError)}
                required
              />
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">رمز عبور</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                aria-invalid={Boolean(passwordError)}
                required
              />
              {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading && <LoaderCircle className="me-2 h-4 w-4 animate-spin" />}
              ورود
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={submitRegister}>
            <div className="space-y-2">
              <Label htmlFor="register-name">نام کامل</Label>
              <Input
                id="register-name"
                type="text"
                autoComplete="name"
                value={registerForm.name}
                onChange={(event) =>
                  setRegisterForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                aria-invalid={Boolean(nameError)}
                required
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-email">ایمیل</Label>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                value={registerForm.email}
                onChange={(event) =>
                  setRegisterForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                aria-invalid={Boolean(emailError)}
                required
              />
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">رمز عبور</Label>
              <Input
                id="register-password"
                type="password"
                autoComplete="new-password"
                value={registerForm.password}
                onChange={(event) =>
                  setRegisterForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                aria-invalid={Boolean(passwordError)}
                required
              />
              <p className="text-xs text-muted-foreground">
                حداقل 8 کاراکتر شامل حرف بزرگ، حرف کوچک و عدد
              </p>
              {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading && <LoaderCircle className="me-2 h-4 w-4 animate-spin" />}
              ایجاد حساب
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
