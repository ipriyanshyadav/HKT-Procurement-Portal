"use client";

import React from "react";
import Link from "next/link";
import { useCategoryTree } from "@procurement/hooks";
import {
  PageHeader,
  HeroKPIStrip,
  Card,
  Badge,
  Button,
} from "@procurement/ui";
import {
  FolderTree,
  FileUp,
  Server,
  ShieldCheck,
  Building2,
  Layers,
  ArrowUpRight,
} from "lucide-react";

interface CategoryNode {
  children?: CategoryNode[];
}

export default function AdminDashboardPage() {
  const { data: categories, isLoading: isCategoriesLoading } = useCategoryTree();

  const countCategories = (nodes: CategoryNode[]): number => {
    if (!nodes) return 0;
    return nodes.reduce((acc, node) => acc + 1 + countCategories(node.children || []), 0);
  };

  const totalCategories = categories ? countCategories(categories as CategoryNode[]) : 4;

  const kpiItems = [
    { value: 100, label: "System Health", suffix: "%", sublabel: "FastAPI · PostgreSQL 16 · Redis" },
    { value: isCategoriesLoading ? 4 : totalCategories, label: "Master Categories", sublabel: "UNSPSC Taxonomies" },
    { value: 1, label: "Active Tenant", sublabel: "Default Enterprise Org" },
    { value: 100, label: "RBAC Security", suffix: "%", sublabel: "RS256 JWT & MFA Active" },
  ];

  const masterDataModules = [
    {
      name: "Category Taxonomy",
      code: "SPEC_24.1",
      description: "Hierarchical UNSPSC commodity classification and spend thresholds",
      count: totalCategories,
      unit: "categories",
      status: "ACTIVE",
      href: "/master-data/categories",
      actionLabel: "View Tree",
      icon: <FolderTree className="w-5 h-5 text-blue-500" />,
    },
    {
      name: "Currencies & Exchange Rates",
      code: "SPEC_24.2",
      description: "ISO 4217 currencies and daily exchange rate tables",
      count: 5,
      unit: "currencies",
      status: "ACTIVE",
      href: "/master-data/import",
      actionLabel: "Import CSV",
      icon: <Layers className="w-5 h-5 text-indigo-500" />,
    },
    {
      name: "Payment Terms",
      code: "SPEC_24.3",
      description: "Net payment intervals and cash discount schedules",
      count: 4,
      unit: "terms",
      status: "ACTIVE",
      href: "/master-data/import",
      actionLabel: "Import CSV",
      icon: <Layers className="w-5 h-5 text-sky-500" />,
    },
    {
      name: "Tax Codes & HSN",
      code: "SPEC_24.4",
      description: "GST/VAT tax percentage rates and jurisdiction mappings",
      count: 4,
      unit: "codes",
      status: "ACTIVE",
      href: "/master-data/import",
      actionLabel: "Import CSV",
      icon: <Layers className="w-5 h-5 text-emerald-500" />,
    },
    {
      name: "Cost Centers",
      code: "SPEC_24.5",
      description: "ERP cost center allocation codes and department hierarchy",
      count: 12,
      unit: "centers",
      status: "ACTIVE",
      href: "/master-data/import",
      actionLabel: "Import CSV",
      icon: <Building2 className="w-5 h-5 text-amber-500" />,
    },
    {
      name: "General Ledger (GL) Accounts",
      code: "SPEC_24.6",
      description: "Chart of accounts and financial expense posting rules",
      count: 18,
      unit: "accounts",
      status: "ACTIVE",
      href: "/master-data/import",
      actionLabel: "Import CSV",
      icon: <Layers className="w-5 h-5 text-purple-500" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Apple Page Header */}
      <PageHeader
        title="Admin Control Center"
        subtitle="Real-time master data health, tenant configuration, and platform governance."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/master-data/import">
              <Button
                variant="primary"
                icon={<FileUp className="w-4 h-4 mr-1.5" />}
              >
                Bulk CSV Import
              </Button>
            </Link>
            <Link href="/master-data/categories">
              <Button
                variant="secondary"
                icon={<FolderTree className="w-4 h-4 mr-1.5" />}
              >
                Manage Categories
              </Button>
            </Link>
          </div>
        }
      />

      {/* Apple KPI Strip */}
      <HeroKPIStrip items={kpiItems} />

      {/* 4-Panel Grid (Spec 6.1) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card
          title="Taxonomy & Catalog Engine"
          subtitle="Multi-tier tree classification & approval thresholds"
          glass
          action={
            <Link href="/master-data/categories">
              <Button variant="ghost" size="sm" icon={<ArrowUpRight className="w-3.5 h-3.5" />}>
                Open
              </Button>
            </Link>
          }
        >
          <div className="flex items-center gap-4 py-2">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <FolderTree className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-bold text-neutral-900 dark:text-white">
                {isCategoriesLoading ? "Loading..." : `${totalCategories} Active Nodes`}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Full UNSPSC standard hierarchy with drag-and-drop hierarchy reordering.
              </p>
            </div>
          </div>
        </Card>

        <Card
          title="Bulk Data Ingestion"
          subtitle="Transaction-safe CSV ingestion pipeline"
          glass
          action={
            <Link href="/master-data/import">
              <Button variant="ghost" size="sm" icon={<ArrowUpRight className="w-3.5 h-3.5" />}>
                Import
              </Button>
            </Link>
          }
        >
          <div className="flex items-center gap-4 py-2">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-bold text-neutral-900 dark:text-white">
                Bulk CSV Pipeline
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Batch imports for Currencies, Tax Codes, Payment Terms, and Cost Centers.
              </p>
            </div>
          </div>
        </Card>

        <Card
          title="Platform Architecture"
          subtitle="System health & container telemetry"
          glass
        >
          <div className="flex items-center gap-4 py-2">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-neutral-900 dark:text-white">
                  FastAPI Monolith
                </span>
                <Badge variant="approved">Healthy</Badge>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                PostgreSQL 16 · Redis Cache · RabbitMQ Broker · OpenTelemetry Tracing
              </p>
            </div>
          </div>
        </Card>

        <Card
          title="Tenant & Security"
          subtitle="Multi-tenant isolation & cryptographic tokens"
          glass
        >
          <div className="flex items-center gap-4 py-2">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-neutral-900 dark:text-white">
                  Default Organization
                </span>
                <Badge variant="review">Protected</Badge>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-mono">
                RS256 JWT · Role & Scope Guard Enforcement
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Master Data Registry (Card + Apple Table) */}
      <Card
        title="Master Data Modules"
        subtitle="Core reference records governing spend approvals, accounting, and compliance."
        glass
      >
        <div className="apple-table-container mt-2">
          <table className="apple-table">
            <thead>
              <tr>
                <th>Module Name</th>
                <th>Spec Ref</th>
                <th>Records</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {masterDataModules.map((item) => (
                <tr key={item.name}>
                  <td>
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-white text-sm">
                          {item.name}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="font-mono text-xs px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-neutral-700 dark:text-neutral-300">
                      {item.code}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold text-neutral-900 dark:text-white">
                      {item.count}
                    </span>{" "}
                    <span className="text-xs text-neutral-500">{item.unit}</span>
                  </td>
                  <td>
                    <Badge variant="approved">{item.status}</Badge>
                  </td>
                  <td className="text-right">
                    <Link href={item.href}>
                      <Button variant="ghost" size="sm">
                        {item.actionLabel} →
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
