"use client";

import React, { ReactNode } from "react";
import { useAuthInit, useCurrentUser, useLogout } from "@procurement/hooks";
import { useAuthStore } from "@procurement/stores";
import { AppShell } from "@procurement/ui";
import {
  LayoutDashboard,
  FolderTree,
  FileUp,
  Sliders,
  Users,
  GitFork,
  Database,
  Scale,
  Coins,
  CreditCard,
  Percent,
  MapPin,
  Calendar,
  Cpu,
  BarChart3,
  ShieldCheck,
  Shield,
  Activity,
  LifeBuoy,
  Layers,
  Factory,
  Package,
  Truck,
  BellRing,
  Terminal,
  HardDrive,
} from "lucide-react";

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
      label: "Org Analytics",
      href: "/analytics",
      icon: <BarChart3 className="w-4 h-4" />,
      section: "Overview",
    },
    {
      label: "Operating Structure",
      href: "/organization/structure",
      icon: <Layers className="w-4 h-4" />,
      section: "Enterprise Structure",
    },
    {
      label: "Facilities & Logistics",
      href: "/organization/facilities",
      icon: <Factory className="w-4 h-4" />,
      section: "Enterprise Structure",
    },
    {
      label: "Users & Sessions",
      href: "/users",
      icon: <Users className="w-4 h-4" />,
      section: "Access & Security",
    },
    {
      label: "Roles & RBAC",
      href: "/roles",
      icon: <Shield className="w-4 h-4" />,
      section: "Access & Security",
    },
    {
      label: "Audit Trail",
      href: "/audit-trail",
      icon: <ShieldCheck className="w-4 h-4" />,
      section: "Access & Security",
    },
    {
      label: "Security & Compliance",
      href: "/compliance",
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
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
      label: "Notification Templates",
      href: "/notifications/templates",
      icon: <BellRing className="w-4 h-4" />,
      section: "Governance",
    },
    {
      label: "Master Data Hub",
      href: "/master-data",
      icon: <Database className="w-4 h-4" />,
      section: "Master Data",
    },
    {
      label: "Categories",
      href: "/master-data/categories",
      icon: <FolderTree className="w-4 h-4" />,
      section: "Master Data",
    },
    {
      label: "Item Catalog",
      href: "/master-data/items",
      icon: <Package className="w-4 h-4" />,
      section: "Master Data",
    },
    {
      label: "Units of Measure",
      href: "/master-data/uom",
      icon: <Scale className="w-4 h-4" />,
      section: "Master Data",
    },
    {
      label: "Currencies & FX",
      href: "/master-data/currencies",
      icon: <Coins className="w-4 h-4" />,
      section: "Master Data",
    },
    {
      label: "Payment Terms",
      href: "/master-data/payment-terms",
      icon: <CreditCard className="w-4 h-4" />,
      section: "Master Data",
    },
    {
      label: "Tax Codes",
      href: "/master-data/tax-codes",
      icon: <Percent className="w-4 h-4" />,
      section: "Master Data",
    },
    {
      label: "Incoterms",
      href: "/master-data/incoterms",
      icon: <Truck className="w-4 h-4" />,
      section: "Master Data",
    },
    {
      label: "Delivery Locations",
      href: "/master-data/locations",
      icon: <MapPin className="w-4 h-4" />,
      section: "Master Data",
    },
    {
      label: "Holiday Calendar",
      href: "/master-data/holidays",
      icon: <Calendar className="w-4 h-4" />,
      section: "Master Data",
    },
    {
      label: "CSV Bulk Import",
      href: "/master-data/import",
      icon: <FileUp className="w-4 h-4" />,
      section: "Master Data",
    },
    {
      label: "ERP Integrations",
      href: "/integrations",
      icon: <Cpu className="w-4 h-4" />,
      section: "System Operations",
    },
    {
      label: "Developer & API Keys",
      href: "/developer",
      icon: <Terminal className="w-4 h-4" />,
      section: "System Operations",
    },
    {
      label: "System Health",
      href: "/system/health",
      icon: <Activity className="w-4 h-4" />,
      section: "System Operations",
    },
    {
      label: "DR Orchestrator",
      href: "/system/recovery",
      icon: <HardDrive className="w-4 h-4" />,
      section: "System Operations",
    },
    {
      label: "Helpdesk & SLAs",
      href: "/tickets",
      icon: <LifeBuoy className="w-4 h-4" />,
      section: "Tickets & SLAs",
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
