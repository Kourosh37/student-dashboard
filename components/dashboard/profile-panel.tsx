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
      const parsed = toPanelError(err, "Failed to load profile");
      if (parsed.status === 401) {
        router.replace("/login");
        return;
      }
      pushToast({ tone: "error", title: "Load failed", description: parsed.message });
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
      pushToast({ tone: "success", title: "Profile updated" });
    } catch (err) {
      const parsed = toPanelError(err, "Failed to update profile");
      setFormError(parsed);
      pushToast({ tone: "error", title: "Update failed", description: parsed.message });
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar() {
    if (!avatarFile) {
      setFormError({
        message: "Select an image file to upload.",
        code: "FILE_REQUIRED",
        details: [],
        fieldErrors: { file: ["Select an image file to upload."] },
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
      pushToast({ tone: "success", title: "Profile photo updated" });
    } catch (err) {
      const parsed = toPanelError(err, "Failed to upload profile photo");
      setFormError(parsed);
      pushToast({ tone: "error", title: "Upload failed", description: parsed.message });
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
      pushToast({ tone: "success", title: "Profile photo removed" });
    } catch (err) {
      const parsed = toPanelError(err, "Failed to remove profile photo");
      setFormError(parsed);
      pushToast({ tone: "error", title: "Remove failed", description: parsed.message });
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
        <h2 className="text-2xl font-bold">Profile</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Profile</CardTitle>
          <CardDescription>Maintain your student identity and academic information.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-lg border border-border/70 p-4">
            <div className="flex flex-wrap items-center gap-4">
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt="Profile avatar"
                  className="h-20 w-20 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground">
                  No photo
                </div>
              )}
              <div className="flex-1 space-y-2">
                <Label>Profile Photo</Label>
                <Input
                  key={`avatar-input-${avatarInputVersion}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">Accepted: JPG, PNG, WEBP, GIF, AVIF. Max size: 5MB.</p>
                {avatarFileError && <p className="text-xs text-destructive">{avatarFileError}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={uploadAvatar} disabled={avatarBusy || !avatarFile}>
                    {avatarBusy ? (
                      <LoaderCircle className="me-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="me-2 h-4 w-4" />
                    )}
                    Upload Photo
                  </Button>
                  <Button type="button" variant="outline" onClick={removeAvatar} disabled={avatarBusy || !profile?.avatarUrl}>
                    <Trash2 className="me-2 h-4 w-4" />
                    Remove Photo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={saveProfile}>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                aria-invalid={Boolean(nameError)}
                required
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            <div className="space-y-2">
              <Label>Student ID</Label>
              <Input value={form.studentId} onChange={(event) => setForm((prev) => ({ ...prev, studentId: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>University</Label>
              <Input
                value={form.university}
                onChange={(event) => setForm((prev) => ({ ...prev, university: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Major</Label>
              <Input value={form.major} onChange={(event) => setForm((prev) => ({ ...prev, major: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Current Term</Label>
              <Input
                value={form.currentTerm}
                onChange={(event) => setForm((prev) => ({ ...prev, currentTerm: event.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Bio</Label>
              <Textarea value={form.bio} onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))} />
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                Save Profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {profile && (
        <Card>
          <CardHeader>
            <CardTitle>Account Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Email: </span>
              {profile.email}
            </p>
            <p>
              <span className="text-muted-foreground">Joined: </span>
              {new Date(profile.createdAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
