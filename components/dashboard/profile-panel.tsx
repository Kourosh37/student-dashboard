"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiFetch, apiFetchForm } from "@/lib/client-api";
import { fieldError, toPanelError, type PanelError } from "@/lib/panel-error";
import { pushToast } from "@/lib/toast";
import type { UserProfile } from "@/types/dashboard";

export function ProfilePanel() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [formError, setFormError] = useState<PanelError | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarInputVersion, setAvatarInputVersion] = useState(0);
  const [form, setForm] = useState({
    name: "",
    studentId: "",
    university: "",
    major: "",
    currentTerm: "",
    bio: "",
  });

  const hydrateProfile = useCallback((data: UserProfile) => {
    setProfile(data);
    setForm({
      name: data.name ?? "",
      studentId: data.studentId ?? "",
      university: data.university ?? "",
      major: data.major ?? "",
      currentTerm: data.currentTerm ?? "",
      bio: data.bio ?? "",
    });
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<UserProfile>("/api/v1/profile");
      hydrateProfile(data);
    } catch (err) {
      const parsed = toPanelError(err, "Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ Ù¾Ø±ÙˆÙØ§ÛŒÙ„ Ø§Ù†Ø¬Ø§Ù… Ù†Ø´Ø¯");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({ tone: "error", title: "Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯", description: parsed.message });
    } finally {
      setLoading(false);
    }
  }, [hydrateProfile, router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const updated = await apiFetch<UserProfile>("/api/v1/profile", {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          studentId: form.studentId || null,
          university: form.university || null,
          major: form.major || null,
          currentTerm: form.currentTerm || null,
          bio: form.bio || null,
        }),
      });
      hydrateProfile(updated);
      pushToast({ tone: "success", title: "Ù¾Ø±ÙˆÙØ§ÛŒÙ„ Ø¨Ø±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø´Ø¯" });
    } catch (err) {
      const parsed = toPanelError(err, "Ø¨Ø±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ù¾Ø±ÙˆÙØ§ÛŒÙ„ Ø§Ù†Ø¬Ø§Ù… Ù†Ø´Ø¯");
      setFormError(parsed);
      pushToast({ tone: "error", title: "Ø¨Ø±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯", description: parsed.message });
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar() {
    if (!avatarFile) {
      setFormError({
        message: "ÛŒÚ© ÙØ§ÛŒÙ„ ØªØµÙˆÛŒØ± Ø¨Ø±Ø§ÛŒ Ø¢Ù¾Ù„ÙˆØ¯ Ø§Ù†ØªØ®Ø§Ø¨ Ú©Ù†ÛŒØ¯.",
        code: "FILE_REQUIRED",
        details: [],
        fieldErrors: { file: ["ÛŒÚ© ÙØ§ÛŒÙ„ ØªØµÙˆÛŒØ± Ø¨Ø±Ø§ÛŒ Ø¢Ù¾Ù„ÙˆØ¯ Ø§Ù†ØªØ®Ø§Ø¨ Ú©Ù†ÛŒØ¯."] },
        status: 400,
      });
      return;
    }

    setAvatarBusy(true);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.set("file", avatarFile);
      const updated = await apiFetchForm<UserProfile>("/api/v1/profile/avatar", formData, { method: "POST" });
      hydrateProfile(updated);
      setAvatarFile(null);
      setAvatarInputVersion((value) => value + 1);
      pushToast({ tone: "success", title: "Ø¹Ú©Ø³ Ù¾Ø±ÙˆÙØ§ÛŒÙ„ Ø¨Ø±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø´Ø¯" });
    } catch (err) {
      const parsed = toPanelError(err, "Ø¢Ù¾Ù„ÙˆØ¯ Ø¹Ú©Ø³ Ù¾Ø±ÙˆÙØ§ÛŒÙ„ Ø§Ù†Ø¬Ø§Ù… Ù†Ø´Ø¯");
      setFormError(parsed);
      pushToast({ tone: "error", title: "Ø¢Ù¾Ù„ÙˆØ¯ Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯", description: parsed.message });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setFormError(null);

    try {
      const updated = await apiFetch<UserProfile>("/api/v1/profile/avatar", { method: "DELETE" });
      hydrateProfile(updated);
      setAvatarFile(null);
      setAvatarInputVersion((value) => value + 1);
      pushToast({ tone: "success", title: "Ø¹Ú©Ø³ Ù¾Ø±ÙˆÙØ§ÛŒÙ„ Ø­Ø°Ù Ø´Ø¯" });
    } catch (err) {
      const parsed = toPanelError(err, "Ø­Ø°Ù Ø¹Ú©Ø³ Ù¾Ø±ÙˆÙØ§ÛŒÙ„ Ø§Ù†Ø¬Ø§Ù… Ù†Ø´Ø¯");
      setFormError(parsed);
      pushToast({ tone: "error", title: "Ø­Ø°Ù Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯", description: parsed.message });
    } finally {
      setAvatarBusy(false);
    }
  }

  const nameError = fieldError(formError?.fieldErrors ?? {}, "name");
  const avatarFileError = fieldError(formError?.fieldErrors ?? {}, "file");

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Ù¾Ø±ÙˆÙØ§ÛŒÙ„</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ù¾Ø±ÙˆÙØ§ÛŒÙ„ Ø¯Ø§Ù†Ø´Ø¬Ùˆ</CardTitle>
          <CardDescription>Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ù‡ÙˆÛŒØªÛŒ Ùˆ ØªØ­ØµÛŒÙ„ÛŒ Ø®ÙˆØ¯ Ø±Ø§ Ù…Ø¯ÛŒØ±ÛŒØª Ú©Ù†ÛŒØ¯.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-lg border border-border/70 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <UserAvatar src={profile?.avatarUrl ?? null} alt="ØªØµÙˆÛŒØ± Ù¾Ø±ÙˆÙØ§ÛŒÙ„" className="h-20 w-20" />
              <div className="flex-1 space-y-2">
                <Label>Ø¹Ú©Ø³ Ù¾Ø±ÙˆÙØ§ÛŒÙ„</Label>
                <Input
                  key={`avatar-input-${avatarInputVersion}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">ÙØ±Ù…Øª Ù‡Ø§ÛŒ Ù…Ø¬Ø§Ø²: JPGØŒ PNGØŒ WEBPØŒ GIFØŒ AVIF. Ø­Ø¯Ø§Ú©Ø«Ø± Ø­Ø¬Ù…: 5MB</p>
                {avatarFileError && <p className="text-xs text-destructive">{avatarFileError}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={uploadAvatar} disabled={avatarBusy || !avatarFile}>
                    {avatarBusy ? (
                      <LoaderCircle className="me-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="me-2 h-4 w-4" />
                    )}
                    Ø¢Ù¾Ù„ÙˆØ¯ Ø¹Ú©Ø³
                  </Button>
                  <Button type="button" variant="outline" onClick={removeAvatar} disabled={avatarBusy || !profile?.avatarUrl}>
                    <Trash2 className="me-2 h-4 w-4" />
                    Ø­Ø°Ù Ø¹Ú©Ø³
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={saveProfile}>
            <div className="space-y-2">
              <Label>Ù†Ø§Ù…</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                aria-invalid={Boolean(nameError)}
                required
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            <div className="space-y-2">
              <Label>Ø´Ù…Ø§Ø±Ù‡ Ø¯Ø§Ù†Ø´Ø¬ÙˆÛŒÛŒ</Label>
              <Input value={form.studentId} onChange={(event) => setForm((prev) => ({ ...prev, studentId: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Ø¯Ø§Ù†Ø´Ú¯Ø§Ù‡</Label>
              <Input
                value={form.university}
                onChange={(event) => setForm((prev) => ({ ...prev, university: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Ø±Ø´ØªÙ‡</Label>
              <Input value={form.major} onChange={(event) => setForm((prev) => ({ ...prev, major: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>ØªØ±Ù… ÙØ¹Ù„ÛŒ</Label>
              <Input
                value={form.currentTerm}
                onChange={(event) => setForm((prev) => ({ ...prev, currentTerm: event.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Ø¯Ø±Ø¨Ø§Ø±Ù‡ Ù…Ù†</Label>
              <Textarea value={form.bio} onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))} />
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                Ø°Ø®ÛŒØ±Ù‡ Ù¾Ø±ÙˆÙØ§ÛŒÙ„
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {profile && (
        <Card>
          <CardHeader>
            <CardTitle>Ø®Ù„Ø§ØµÙ‡ Ø­Ø³Ø§Ø¨</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Ø§ÛŒÙ…ÛŒÙ„: </span>
              {profile.email}
            </p>
            <p>
              <span className="text-muted-foreground">ØªØ§Ø±ÛŒØ® Ø¹Ø¶ÙˆÛŒØª: </span>
              {new Date(profile.createdAt).toLocaleDateString("fa-IR")}
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

