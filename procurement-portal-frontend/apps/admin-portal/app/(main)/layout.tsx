"use client";

import React, { ReactNode } from "react";
import { useAuthInit, useCurrentUser, useLogout } from "@procurement/hooks";
import { useAuthStore } from "@procurement/stores";
import { AppShell } from "@procurement/ui";
import { LayoutDashboard, FolderTree, FileUp, Sliders, Users, GitFork } from "lucide-react";

export default function AdminMainLayout({ children }: { children: ReactNode }) {
  const { isInitializing } = useAuthInit();
  const { data: currentUser } = useCurrentUser();
  const storeUser = useAuthStore((state) => state.user);
  const user = currentUser || storeUser;
  const logoutMutation = useLogout();

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-neutral-500 font-medium">Authenticating session...</span>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="w-4 h-4" />,
      section: "Overview",
    },
    {
      label: "Users & Roles",
      href: "/users",
      icon: <Users className="w-4 h-4" />,
      section: "Access & Security",
    },
    {
      label: "Approval Rules",
      href: "/approval-rules",
      icon: <Sliders className="w-4 h-4" />,
      section: "Governance",
    },
    {
      label: "Workflow Templates",
      href: "/workflows",
      icon: <GitFork className="w-4 h-4" />,
      section: "Governance",
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
