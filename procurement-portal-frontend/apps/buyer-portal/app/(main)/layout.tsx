"use client";

import React, { ReactNode } from "react";
import { useCurrentUser, useLogout } from "@procurement/hooks";
import { useAuthStore } from "@procurement/stores";
import { AppShell } from "@procurement/ui";
import { ShoppingCart, CheckSquare, FileQuestion, Users } from "lucide-react";

export default function BuyerMainLayout({ children }: { children: ReactNode }) {
  const { data: currentUser } = useCurrentUser();
  const storeUser = useAuthStore((state) => state.user);
  const user = currentUser || storeUser;
  const logoutMutation = useLogout();

  const navItems = [
    {
      label: "Purchase Requisitions",
      href: "/requisitions",
      icon: <ShoppingCart className="w-4 h-4" />,
      section: "Purchasing",
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
