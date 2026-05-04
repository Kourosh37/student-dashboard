import type { Metadata } from "next";
import type React from "react";

import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "داشبورد دانشجو",
  description: "داشبورد مدیریت ترم، کلاس، امتحان، برنامه ریزی و فایل های دانشجو",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
