"use client";

import React, { ReactNode } from "react";
import { useAuthInit, useCurrentUser, useLogout } from "@procurement/hooks";
import { useAuthStore } from "@procurement/stores";
import { AppShell, NotificationBell } from "@procurement/ui";
import { Building2, FileCheck, UserPlus, Gavel, Package, Receipt, CreditCard, AlertCircle, LifeBuoy, FileText, Truck } from "lucide-react";

export default function SupplierMainLayout({ children }: { children: ReactNode }) {
  const { isInitializing } = useAuthInit();
  const { data: currentUser } = useCurrentUser();
  const storeUser = useAuthStore((state) => state.user);
  const user = currentUser || storeUser;
  const logoutMutation = useLogout();

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-neutral-500 font-medium">Authenticating session...</span>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      label: "Tenders & Bids",
      href: "/rfqs",
      icon: <Gavel className="w-4 h-4" />,
      section: "Bidding & Opportunities",
    },
    {
      label: "Live Auctions",
      href: "/auctions",
      icon: <Gavel className="w-4 h-4 text-amber-400" />,
      section: "Bidding & Opportunities",
    },
    {
      label: "Contracts & Agreements",
      href: "/contracts",
      icon: <FileText className="w-4 h-4" />,
      section: "Orders & Fulfillment",
    },
    {
      label: "Purchase Orders",
      href: "/purchase-orders",
      icon: <Package className="w-4 h-4" />,
      section: "Orders & Fulfillment",
    },
    {
      label: "Advance Shipping (ASN)",
      href: "/asns",
      icon: <Truck className="w-4 h-4" />,
      section: "Orders & Fulfillment",
    },
    {
      label: "Invoices",
      href: "/invoices",
      icon: <Receipt className="w-4 h-4" />,
      section: "Finance & Invoicing",
    },
    {
      label: "E-Invoicing & E-Way Bills",
      href: "/asns/einvoice",
      icon: <FileText className="w-4 h-4 text-emerald-400" />,
      section: "Finance & Invoicing",
    },
    {
      label: "Dispute Inbox",
      href: "/invoices/disputes",
      icon: <AlertCircle className="w-4 h-4" />,
      section: "Finance & Invoicing",
    },
    {
      label: "Payments",
      href: "/payments",
      icon: <CreditCard className="w-4 h-4" />,
      section: "Finance & Invoicing",
    },
    {
      label: "Vendor Profile",
      href: "/profile",
      icon: <Building2 className="w-4 h-4" />,
      section: "Company & Compliance",
    },
    {
      label: "Documents & Compliance",
      href: "/documents",
      icon: <FileCheck className="w-4 h-4" />,
      section: "Company & Compliance",
    },
    {
      label: "Registration Info",
      href: "/register",
      icon: <UserPlus className="w-4 h-4" />,
      section: "Company & Compliance",
    },
    {
      label: "Queries & Support",
      href: "/tickets",
      icon: <LifeBuoy className="w-4 h-4" />,
      section: "Support",
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
      actions={<NotificationBell />}
    >
      {children}
    </AppShell>
  );
}
