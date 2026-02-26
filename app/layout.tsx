import type { Metadata } from "next";
import type React from "react";
import { JetBrains_Mono, Vazirmatn } from "next/font/google";

import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

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
      <body className={`${vazirmatn.variable} ${jetbrainsMono.variable} min-h-screen antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
