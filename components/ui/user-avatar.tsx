"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type UserAvatarProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
};

function normalizeAvatarSrc(src?: string | null) {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("asset:")) {
    return "/api/v1/profile/avatar";
  }
  return trimmed;
}

function AvatarFallbackSvg() {
  return (
    <svg viewBox="0 0 96 96" className="h-full w-full" role="img" aria-label="تصویر پیش فرض پروفایل">
      <defs>
        <linearGradient id="avatar-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#155e75" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" fill="url(#avatar-bg)" />
      <circle cx="48" cy="35" r="17" fill="rgba(255,255,255,0.9)" />
      <path d="M16 90c2-17 15-28 32-28s30 11 32 28" fill="rgba(255,255,255,0.9)" />
      <circle cx="72" cy="20" r="7" fill="rgba(255,255,255,0.35)" />
      <circle cx="24" cy="16" r="5" fill="rgba(255,255,255,0.22)" />
    </svg>
  );
}

export function UserAvatar({ src, alt = "پروفایل کاربر", className, imageClassName }: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const normalizedSrc = useMemo(() => normalizeAvatarSrc(src), [src]);

  const displaySrc = useMemo(() => {
    if (!normalizedSrc) return null;
    if (normalizedSrc.startsWith("/api/v1/profile/avatar") && !normalizedSrc.includes("v=")) {
      const separator = normalizedSrc.includes("?") ? "&" : "?";
      return `${normalizedSrc}${separator}v=${Date.now()}`;
    }
    return normalizedSrc;
  }, [normalizedSrc]);

  useEffect(() => {
    setHasError(false);
  }, [displaySrc]);

  if (displaySrc && !hasError) {
    return (
      <div className={cn("overflow-hidden rounded-full border border-border bg-muted", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displaySrc}
          alt={alt}
          className={cn("h-full w-full object-cover", imageClassName)}
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-full border border-border bg-muted", className)}>
      <AvatarFallbackSvg />
    </div>
  );
}