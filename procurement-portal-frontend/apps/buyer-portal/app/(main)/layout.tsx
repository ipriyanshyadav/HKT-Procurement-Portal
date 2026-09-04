"use client";

import React, { ReactNode } from "react";
import { useAuthInit, useCurrentUser, useLogout } from "@procurement/hooks";
import { useAuthStore } from "@procurement/stores";
import { AppShell } from "@procurement/ui";
import { ShoppingCart, CheckSquare, FileQuestion, Users, FileText } from "lucide-react";

export default function BuyerMainLayout({ children }: { children: ReactNode }) {
  const { isInitializing } = useAuthInit();
  const { data: currentUser } = useCurrentUser();
  const storeUser = useAuthStore((state) => state.user);
  const user = currentUser || storeUser;
  const logoutMutation = useLogout();

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-neutral-500 font-medium">Authenticating session...</span>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      label: "Purchase Requisitions",
      href: "/requisitions",
      icon: <ShoppingCart className="w-4 h-4" />,
      section: "Purchasing",
    },
    {
      label: "RFQs & Tenders",
      href: "/rfqs",
      icon: <FileText className="w-4 h-4" />,
      section: "Sourcing",
    },
    {
      label: "Approvals & Tasks",
      href: "/tasks",
      icon: <CheckSquare className="w-4 h-4" />,
      section: "Workflow",
    },
    {
      label: "Unmapped PRs",
      href: "/unmapped-prs",
      icon: <FileQuestion className="w-4 h-4" />,
      section: "Purchasing",
    },
    {
      label: "Vendors",
      href: "/vendors",
      icon: <Users className="w-4 h-4" />,
      section: "Sourcing",
    },
  ];

  return (
    <AppShell
      portalName="HKT Procurement"
      portalBadge="Buyer Portal"
      badgeColor="orange"
      homeHref="/requisitions"
      navItems={navItems}
      user={user}
      onLogout={() => logoutMutation.mutate()}
    >
      {children}
    </AppShell>
  );
}
