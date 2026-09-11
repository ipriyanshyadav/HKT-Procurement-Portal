"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { usePurchaseOrders, POResponse } from "@procurement/hooks";
import { PermissionGuard, TableSkeleton, EmptyState, PageHeader, SearchInput, Button } from "@procurement/ui";
import {
  FileText,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  CheckCircle2,
  Package,
  Send,
  Truck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function PurchaseOrdersListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data = [], isLoading, isError, refetch } = usePurchaseOrders({
    search: search || undefined,
    status: statusFilter || undefined,
    page,
    page_size: PAGE_SIZE,
  });

  const purchaseOrders = useMemo(() => Array.isArray(data) ? data : (data as any).purchase_orders || [], [data]);
  // Assuming meta might be returned if paginated
  const meta = (data as any).meta;
  const totalPages = meta?.total_pages ?? 1;

  const kpis = useMemo(() => {
    const total = purchaseOrders.length;
    const pendingApproval = purchaseOrders.filter((po: any) => po.status === "PENDING_APPROVAL").length;
    const sentToVendor = purchaseOrders.filter((po: any) => po.status === "SENT_TO_VENDOR").length;
    const acknowledged = purchaseOrders.filter((po: any) => po.status === "VENDOR_ACKNOWLEDGED").length;
    const received = purchaseOrders.filter(
      (po: any) => po.status === "PARTIALLY_RECEIVED" || po.status === "RECEIVED" || po.status === "CLOSED"
    ).length;
    return { total, pendingApproval, sentToVendor, acknowledged, received };
  }, [purchaseOrders]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "APPROVED":
      case "VENDOR_ACKNOWLEDGED":
        return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "SENT_TO_VENDOR":
        return "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "PENDING_APPROVAL":
        return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "PARTIALLY_RECEIVED":
        return "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
      case "RECEIVED":
      case "CLOSED":
        return "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-800";
      case "VENDOR_REJECTED":
      case "CANCELLED":
      case "REJECTED":
        return "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "DRAFT":
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  const formatCurrency = (val: string | number | undefined | null, curr = "INR") => {
    if (val === undefined || val === null) return "—";
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? "—" : `${curr} ${num.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage purchase orders, release orders to suppliers, and track line deliveries & GRNs."
        actions={
          <div className="flex items-center gap-3">
            <PermissionGuard permission="grn.create">
              <Link href="/grn/new">
                <Button variant="secondary" size="sm" leftIcon={<Truck className="w-4 h-4" />}>
                  Create GRN
                </Button>
              </Link>
            </PermissionGuard>
            <PermissionGuard permission="po.create">
              <Link href="/purchase-orders/new">
                <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                  New Purchase Order
                </Button>
              </Link>
            </PermissionGuard>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total POs</span>
            <FileText className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{kpis.total}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <span>Pending Approval</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{kpis.pendingApproval}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider">
            <span>Sent to Vendor</span>
            <Send className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">{kpis.sentToVendor}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <span>Acknowledged</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{kpis.acknowledged}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <span>In Delivery / Recv</span>
            <Truck className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">{kpis.received}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex-1 w-full">
          <SearchInput
            placeholder="Search by PO number, title, or vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="SENT_TO_VENDOR">Sent to Vendor</option>
            <option value="VENDOR_ACKNOWLEDGED">Vendor Acknowledged</option>
            <option value="VENDOR_REJECTED">Vendor Rejected</option>
            <option value="PARTIALLY_RECEIVED">Partially Received</option>
            <option value="RECEIVED">Fully Received</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={8} columns={7} />
        ) : isError ? (
          <EmptyState
            icon={<AlertTriangle className="h-8 w-8 text-red-400" />}
            title="Failed to load purchase orders"
            action={
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : purchaseOrders.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-10 w-10 text-slate-300 dark:text-slate-600" />}
            title="No purchase orders found"
            description="There are no purchase orders matching your search filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3">PO Number</th>
                  <th scope="col" className="px-5 py-3">Title</th>
                  <th scope="col" className="px-5 py-3">Total Value</th>
                  <th scope="col" className="px-5 py-3">Delivery Date</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {purchaseOrders.map((po: any) => (
                  <tr key={po.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {po.po_number}
                      </span>
                      {po.amendment_count > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                          v{po.amendment_count + 1}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900 dark:text-white line-clamp-1">{po.title}</div>
                      <div className="text-xs text-slate-400 font-mono">ID: {po.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap font-mono font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(po.total_value, po.currency)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {po.expected_delivery_date
                        ? new Date(po.expected_delivery_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                          po.status
                        )}`}
                      >
                        {po.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <Link href={`/purchase-orders/${po.id}`}>
                        <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                          View Details
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination UI for PO if needed */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
