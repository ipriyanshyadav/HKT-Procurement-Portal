"use client";

import React, { ReactNode } from "react";
import { useCurrentUser, useLogout } from "@procurement/hooks";
import { useAuthStore } from "@procurement/stores";
import { AppShell } from "@procurement/ui";
import { LayoutDashboard, FolderTree, FileUp } from "lucide-react";

export default function AdminMainLayout({ children }: { children: ReactNode }) {
  const { data: currentUser } = useCurrentUser();
  const storeUser = useAuthStore((state) => state.user);
  const user = currentUser || storeUser;
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
      portalName="HKT Procurement"
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
