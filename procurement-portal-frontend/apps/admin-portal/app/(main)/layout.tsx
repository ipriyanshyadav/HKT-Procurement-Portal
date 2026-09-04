"use client";

import React, { ReactNode } from "react";
import { useCurrentUser, useLogout } from "@procurement/hooks";
import { AppShell } from "@procurement/ui";
import { LayoutDashboard, FolderTree, FileUp } from "lucide-react";

export default function AdminMainLayout({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();

  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="w-4 h-4" />,
      section: "Overview",
    },
    {
      label: "Categories",
      href: "/master-data/categories",
      icon: <FolderTree className="w-4 h-4" />,
      section: "Master Data",
    },
    {
      label: "CSV Bulk Import",
      href: "/master-data/import",
      icon: <FileUp className="w-4 h-4" />,
      section: "Master Data",
    },
  ];

  return (
    <AppShell
      portalName="ProcureFlow"
      portalBadge="Admin Portal"
      badgeColor="blue"
      homeHref="/dashboard"
      navItems={navItems}
      user={user}
      onLogout={() => logoutMutation.mutate()}
    >
      {children}
    </AppShell>
  );
}
