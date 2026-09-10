"use client";

import React, { ReactNode } from "react";
import { useAuthInit, useCurrentUser, useLogout, useMyWorkflowTasks } from "@procurement/hooks";
import { useAuthStore } from "@procurement/stores";
import { AppShell, CompanySwitcher, NotificationBell } from "@procurement/ui";
import type { SidebarItemData } from "@procurement/ui";
import { ShoppingCart, CheckSquare, FileQuestion, Users, FileText, FileCheck, Receipt, CreditCard, Truck, AlertCircle, BarChart2, PieChart, Award, LifeBuoy, UserCheck, ShieldAlert, Barcode, Globe, ShieldCheck, Sparkles, Gavel, Scale, Store, ShoppingBag } from "lucide-react";

export default function BuyerMainLayout({ children }: { children: ReactNode }) {
  const { isInitializing } = useAuthInit();
  const { data: currentUser } = useCurrentUser();
  const storeUser = useAuthStore((state) => state.user);
  const user = currentUser || storeUser;
  const logoutMutation = useLogout();
  const { data: myTasksData } = useMyWorkflowTasks();
  const pendingTasksCount = myTasksData?.tasks?.filter((t) => t.status === "PENDING")?.length ?? 0;

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

  const navItems: SidebarItemData[] = [
    {
      label: "Purchase Requisitions",
      href: "/requisitions",
      icon: <ShoppingCart className="w-4 h-4" />,
      section: "Purchasing",
    },
    {
      label: "Marketplace & Catalogs",
      href: "/marketplace",
      icon: <Store className="w-4 h-4 text-emerald-500" />,
      section: "Purchasing",
    },
    {
      label: "Purchase Orders",
      href: "/purchase-orders",
      icon: <ShoppingBag className="w-4 h-4" />,
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
      label: "Unmapped PRs",
      href: "/unmapped-prs",
      icon: <FileQuestion className="w-4 h-4" />,
      section: "Purchasing",
    },
    {
      label: "AI Sourcing Copilot",
      href: "/rfqs/copilot",
      icon: <Sparkles className="w-4 h-4 text-purple-400" />,
      section: "Sourcing & Suppliers",
    },
    {
      label: "RFQs & Tenders",
      href: "/rfqs",
      icon: <FileText className="w-4 h-4" />,
      section: "Sourcing & Suppliers",
    },
    {
      label: "Live Auctions",
      href: "/auctions",
      icon: <Gavel className="w-4 h-4 text-amber-400" />,
      section: "Sourcing & Suppliers",
    },
    {
      label: "Contracts",
      href: "/contracts",
      icon: <FileCheck className="w-4 h-4" />,
      section: "Sourcing & Suppliers",
    },
    {
      label: "Vendor Directory",
      href: "/vendors",
      icon: <Users className="w-4 h-4" />,
      section: "Sourcing & Suppliers",
    },
    {
      label: "Vendor Risk & ESG",
      href: "/vendors/risk",
      icon: <ShieldAlert className="w-4 h-4" />,
      section: "Sourcing & Suppliers",
    },
    {
      label: "Invoices",
      href: "/invoices",
      icon: <Receipt className="w-4 h-4" />,
      section: "Accounts Payable",
    },
    {
      label: "3-Way / 4-Way Match",
      href: "/invoices/reconciliation",
      icon: <Scale className="w-4 h-4 text-indigo-400" />,
      section: "Accounts Payable",
    },
    {
      label: "E-Invoicing & E-Way Bills",
      href: "/invoices/einvoice",
      icon: <FileText className="w-4 h-4 text-emerald-400" />,
      section: "Accounts Payable",
    },
    {
      label: "Dispute Inbox",
      href: "/invoices/disputes",
      icon: <AlertCircle className="w-4 h-4" />,
      section: "Accounts Payable",
    },
    {
      label: "Payments",
      href: "/payments",
      icon: <CreditCard className="w-4 h-4" />,
      section: "Accounts Payable",
    },
    {
      label: "Approvals & Tasks",
      href: "/tasks",
      icon: <CheckSquare className="w-4 h-4" />,
      section: "Workflow",
      badge: pendingTasksCount > 0 ? pendingTasksCount : undefined,
      badgeColor: "orange",
    },
    {
      label: "Delegation Matrix",
      href: "/tasks/delegation",
      icon: <UserCheck className="w-4 h-4 text-indigo-500" />,
      section: "Workflow",
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
      label: "Tickets & Inquiries",
      href: "/tickets",
      icon: <LifeBuoy className="w-4 h-4" />,
      section: "Support",
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
