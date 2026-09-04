"use client";

import React from "react";
import Link from "next/link";
import { useCategoryTree } from "@procurement/hooks";

export default function AdminDashboardPage() {
  const { data: categories, isLoading: isCategoriesLoading } = useCategoryTree();

  const countCategories = (nodes: any[]): number => {
    if (!nodes) return 0;
    return nodes.reduce((acc, node) => acc + 1 + countCategories(node.children || []), 0);
  };

  const totalCategories = categories ? countCategories(categories) : 4;

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
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time master data health, tenant configuration, and platform metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/master-data/import"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            <span>📥</span>
            <span>Bulk CSV Import</span>
          </Link>
          <Link
            href="/master-data/categories"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            <span>📁</span>
            <span>Manage Categories</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              System Health
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ● Healthy
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3">Operational</p>
          <p className="text-xs text-gray-500 mt-1">FastAPI v1 · PostgreSQL 16 · Redis</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Master Categories
            </span>
            <span className="text-lg">📁</span>
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-3">
            {isCategoriesLoading ? "..." : totalCategories}
          </p>
          <p className="text-xs text-gray-500 mt-1">Hierarchical UNSPSC commodities</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Active Tenant
            </span>
            <span className="text-lg">🏢</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3">Default Org</p>
          <p className="text-xs text-gray-500 mt-1 font-mono">00000000-0000...0001</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Security & RBAC
            </span>
            <span className="text-lg">🔒</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3">RS256 JWT</p>
          <p className="text-xs text-gray-500 mt-1">MFA & Multi-Tenant Isolated</p>
        </div>
      </div>

      {/* Master Data Registry Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Master Data Modules</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Core reference records governing spend approvals, accounting, and tax compliance.
            </p>
          </div>
          <span className="text-xs font-medium text-gray-500">SPEC_24 MDM</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Module Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Spec Ref
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Records
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {masterDataModules.map((item) => (
                <tr key={item.name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 font-mono">
                      {item.code}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">{item.count}</span>{" "}
                    <span className="text-gray-500 text-xs">{item.unit}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={item.href}
                      className="text-blue-600 hover:text-blue-900 font-semibold text-xs"
                    >
                      {item.actionLabel} →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
