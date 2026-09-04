"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { usePurchaseOrders, POResponse } from "@procurement/hooks";
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
} from "lucide-react";

export default function PurchaseOrdersListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: purchaseOrders = [], isLoading, isError, refetch } = usePurchaseOrders({
    search: search || undefined,
    status: statusFilter || undefined,
    page,
    page_size: PAGE_SIZE,
  });

  const kpis = useMemo(() => {
    const total = purchaseOrders.length;
    const pendingApproval = purchaseOrders.filter((po) => po.status === "PENDING_APPROVAL").length;
    const sentToVendor = purchaseOrders.filter((po) => po.status === "SENT_TO_VENDOR").length;
    const acknowledged = purchaseOrders.filter((po) => po.status === "VENDOR_ACKNOWLEDGED").length;
    const received = purchaseOrders.filter(
      (po) => po.status === "PARTIALLY_RECEIVED" || po.status === "RECEIVED" || po.status === "CLOSED"
    ).length;
    return { total, pendingApproval, sentToVendor, acknowledged, received };
  }, [purchaseOrders]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "APPROVED":
      case "VENDOR_ACKNOWLEDGED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "SENT_TO_VENDOR":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "PENDING_APPROVAL":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "PARTIALLY_RECEIVED":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "RECEIVED":
      case "CLOSED":
        return "bg-green-100 text-green-800 border-green-300";
      case "VENDOR_REJECTED":
      case "CANCELLED":
      case "REJECTED":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "DRAFT":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const formatCurrency = (val: string | number | undefined | null, curr = "INR") => {
    if (val === undefined || val === null) return "—";
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? "—" : `${curr} ${num.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Package className="h-6 w-6 text-indigo-600" />
            Purchase Orders
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage purchase orders, release orders to suppliers, and track line deliveries & GRNs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/grn/new"
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition-colors"
          >
            <Truck className="h-4 w-4 text-slate-600" />
            Create GRN
          </Link>
          <Link
            href="/purchase-orders/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Purchase Order
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total POs</span>
            <FileText className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{kpis.total}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 text-xs font-semibold uppercase tracking-wider">
            <span>Pending Approval</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{kpis.pendingApproval}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-blue-600 text-xs font-semibold uppercase tracking-wider">
            <span>Sent to Vendor</span>
            <Send className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600">{kpis.sentToVendor}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold uppercase tracking-wider">
            <span>Acknowledged</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{kpis.acknowledged}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-indigo-600 text-xs font-semibold uppercase tracking-wider">
            <span>In Delivery / Recv</span>
            <Truck className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-600">{kpis.received}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by PO number, title, or vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-700"
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">
            <div className="animate-pulse space-y-3">
              <div className="h-6 bg-slate-100 rounded w-1/3 mx-auto"></div>
              <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div>
            </div>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-500">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-400" />
            <p className="font-semibold">Failed to load purchase orders</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-sm text-indigo-600 hover:underline font-medium"
            >
              Try again
            </button>
          </div>
        ) : purchaseOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-800">No purchase orders found</h3>
            <p className="text-sm mt-1 max-w-sm mx-auto text-slate-500">
              There are no purchase orders matching your search filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3">PO Number</th>
                  <th scope="col" className="px-5 py-3">Title</th>
                  <th scope="col" className="px-5 py-3">Total Value</th>
                  <th scope="col" className="px-5 py-3">Delivery Date</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="font-mono font-semibold text-indigo-600">
                        {po.po_number}
                      </span>
                      {po.amendment_count > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                          v{po.amendment_count + 1}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900 line-clamp-1">{po.title}</div>
                      <div className="text-xs text-slate-400 font-mono">ID: {po.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap font-mono font-medium text-slate-900">
                      {formatCurrency(po.total_value, po.currency)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-slate-600">
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
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        View Details
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
