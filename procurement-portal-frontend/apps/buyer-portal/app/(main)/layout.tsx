"use client";

import React, { ReactNode } from "react";
import { useAuthInit, useCurrentUser, useLogout } from "@procurement/hooks";
import { useAuthStore } from "@procurement/stores";
import { AppShell, CompanySwitcher, NotificationBell } from "@procurement/ui";
import { ShoppingCart, CheckSquare, FileQuestion, Users, FileText, FileCheck, Package, Receipt, CreditCard, Truck, AlertCircle, BarChart2, PieChart, Award, LifeBuoy, Kanban, UserCheck, Ticket, ShieldAlert, Barcode, Globe, ShieldCheck, Sparkles } from "lucide-react";

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
      label: "Marketplace & Catalogs",
      href: "/marketplace",
      icon: <Package className="w-4 h-4" />,
      section: "Purchasing",
    },
    {
      label: "Purchase Orders",
      href: "/purchase-orders",
      icon: <Package className="w-4 h-4" />,
      section: "Purchasing",
    },
    {
      label: "Goods Receipts (GRN)",
      href: "/grn",
      icon: <Truck className="w-4 h-4" />,
      section: "Purchasing",
    },
    {
      label: "Barcode Dock Intake",
      href: "/grn/scan",
      icon: <Barcode className="w-4 h-4" />,
      section: "Purchasing",
    },
    {
      label: "Invoices",
      href: "/invoices",
      icon: <Receipt className="w-4 h-4" />,
      section: "Purchasing",
    },
    {
      label: "E-Invoicing & E-Way Bills",
      href: "/invoices/einvoice",
      icon: <FileText className="w-4 h-4 text-emerald-400" />,
      section: "Purchasing",
    },
    {
      label: "Dispute Inbox",
      href: "/invoices/disputes",
      icon: <AlertCircle className="w-4 h-4" />,
      section: "Purchasing",
    },
    {
      label: "Payments",
      href: "/payments",
      icon: <CreditCard className="w-4 h-4" />,
      section: "Purchasing",
    },
    {
      label: "AI Sourcing Copilot",
      href: "/rfqs/copilot",
      icon: <Sparkles className="w-4 h-4 text-purple-400" />,
      section: "Sourcing",
    },
    {
      label: "RFQs & Tenders",
      href: "/rfqs",
      icon: <FileText className="w-4 h-4" />,
      section: "Sourcing",
    },
    {
      label: "Contracts",
      href: "/contracts",
      icon: <FileCheck className="w-4 h-4" />,
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
    {
      label: "Vendor Risk & ESG",
      href: "/vendors/risk",
      icon: <ShieldAlert className="w-4 h-4" />,
      section: "Sourcing",
    },
    {
      label: "KPI Dashboard",
      href: "/analytics",
      icon: <BarChart2 className="w-4 h-4" />,
      section: "Analytics",
    },
    {
      label: "Spend Breakdown",
      href: "/analytics/spend",
      icon: <PieChart className="w-4 h-4" />,
      section: "Analytics",
    },
    {
      label: "Vendor Scorecards",
      href: "/analytics/vendors",
      icon: <Award className="w-4 h-4" />,
      section: "Analytics",
    },
    {
      label: "Group Spend Rollup",
      href: "/analytics/rollup",
      icon: <Globe className="w-4 h-4" />,
      section: "Analytics",
    },
    {
      label: "Security & Compliance",
      href: "/compliance",
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      section: "Analytics",
    },
    {
      label: "All Tickets",
      href: "/tickets",
      icon: <LifeBuoy className="w-4 h-4" />,
      section: "Support & Tickets",
    },
    {
      label: "Kanban Board",
      href: "/tickets/board",
      icon: <Kanban className="w-4 h-4" />,
      section: "Support & Tickets",
    },
    {
      label: "Assigned to Me",
      href: "/tickets/assigned",
      icon: <UserCheck className="w-4 h-4" />,
      section: "Support & Tickets",
    },
    {
      label: "Raised by Me",
      href: "/tickets/my",
      icon: <Ticket className="w-4 h-4" />,
      section: "Support & Tickets",
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
      actions={
        <div className="flex items-center gap-2">
          <CompanySwitcher />
          <NotificationBell />
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
