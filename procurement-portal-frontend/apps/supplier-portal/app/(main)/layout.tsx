"use client";

import React, { ReactNode } from "react";
import { useCurrentUser, useLogout } from "@procurement/hooks";
import { AppShell } from "@procurement/ui";
import { Building2, FileCheck, UserPlus } from "lucide-react";

export default function SupplierMainLayout({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();

  const navItems = [
    {
      label: "My Profile",
      href: "/profile",
      icon: <Building2 className="w-4 h-4" />,
      section: "Account",
    },
    {
      label: "Documents & Compliance",
      href: "/documents",
      icon: <FileCheck className="w-4 h-4" />,
      section: "Compliance",
    },
    {
      label: "Registration Info",
      href: "/register",
      icon: <UserPlus className="w-4 h-4" />,
      section: "Onboarding",
    },
  ];

  return (
    <AppShell
      portalName="ProcureFlow"
      portalBadge="Supplier Portal"
      badgeColor="green"
      homeHref="/profile"
      navItems={navItems}
      user={user}
      onLogout={() => logoutMutation.mutate()}
    >
      {children}
    </AppShell>
  );
}
