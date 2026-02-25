import type { Metadata } from "next";
import type React from "react";
import { JetBrains_Mono, Manrope } from "next/font/google";

import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Student Dashboard",
  description: "Student Dashboard for semesters, classes, exams, planning, and files.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} ${jetbrainsMono.variable} min-h-screen antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
