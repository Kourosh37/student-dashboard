import type React from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";

type Props = {
  children: React.ReactNode;
};

export default function DashboardLayout({ children }: Props) {
  return <DashboardShell>{children}</DashboardShell>;
}
