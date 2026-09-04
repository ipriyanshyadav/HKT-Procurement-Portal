"use client";

import React, { ReactNode } from "react";
import { useCurrentUser, useLogout } from "@procurement/hooks";
import { useAuthStore } from "@procurement/stores";
import { AppShell } from "@procurement/ui";
import { Building2, FileCheck, UserPlus, Gavel } from "lucide-react";

export default function SupplierMainLayout({ children }: { children: ReactNode }) {
  const { data: currentUser } = useCurrentUser();
  const storeUser = useAuthStore((state) => state.user);
  const user = currentUser || storeUser;
  const logoutMutation = useLogout();

  const navItems = [
    {
      label: "Tenders & Bids",
      href: "/rfqs",
      icon: <Gavel className="w-4 h-4" />,
      section: "Bidding",
    },
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
      portalName="HKT Procurement"
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
