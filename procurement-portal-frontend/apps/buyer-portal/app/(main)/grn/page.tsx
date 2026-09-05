"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useGRNs } from "@procurement/hooks";
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Filter,
  ArrowRight,
} from "lucide-react";

export default function GRNListPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data: grns = [], isLoading } = useGRNs();

  // Filter GRNs locally
  const filteredGrns = grns.filter((g) => {
    const matchesStatus =
      statusFilter === "ALL" ||
      (g.status || "").toUpperCase() === statusFilter.toUpperCase();
    const matchesSearch =
      !searchTerm ||
      g.grn_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.challan_number && g.challan_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (g.po_id && g.po_id.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const totalCount = grns.length;
  const confirmedCount = grns.filter((g) => g.status === "CONFIRMED").length;
  const inspectedCount = grns.filter((g) => g.status === "INSPECTED").length;
  const draftCount = grns.filter((g) => g.status === "DRAFT").length;

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            CONFIRMED
          </span>
        );
      case "INSPECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <CheckCircle2 className="w-3 h-3" />
            QC INSPECTED
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" />
            DRAFT
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertTriangle className="w-3 h-3" />
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {status || "UNKNOWN"}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Truck className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            Goods Receipt Notes (GRN)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track warehouse inbound receipts, vendor delivery challans, and quality inspection statuses.
          </p>
        </div>
        <Link
          href="/grn/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Record New GRN
        </Link>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Goods Receipts</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Confirmed Receipts</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{confirmedCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">QC Passed / Inspected</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{inspectedCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Pending Confirmation</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{draftCount}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by GRN #, Challan #, or PO ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="INSPECTED">Inspected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="mt-2 text-sm">Loading Goods Receipt Notes...</p>
          </div>
        ) : filteredGrns.length === 0 ? (
          <div className="py-16 text-center">
            <Truck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-base font-medium text-slate-700 dark:text-slate-200">No goods receipts found</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              There are no GRNs matching your filter criteria. Click below to record a receipt.
            </p>
            <Link
              href="/grn/new"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
            >
              <Plus className="w-4 h-4" />
              Create First GRN
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  <th className="py-3 px-4">GRN Number</th>
                  <th className="py-3 px-4">PO Reference</th>
                  <th className="py-3 px-4">Challan Info</th>
                  <th className="py-3 px-4">Receipt Date</th>
                  <th className="py-3 px-4">Logistics / LR</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredGrns.map((grn) => (
                  <tr key={grn.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-indigo-700 dark:text-indigo-400">
                      {grn.grn_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/purchase-orders/${grn.po_id}`}
                        className="font-medium text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 group"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500" />
                        <span className="font-mono text-xs">{grn.po_id.slice(0, 13)}...</span>
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 dark:text-white font-medium">{grn.challan_number}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {grn.challan_date || "No challan date"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                      {grn.receipt_date}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 dark:text-white">{grn.transporter_name || "Self / Standard"}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {grn.lr_number ? `LR: ${grn.lr_number}` : "No LR"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(grn.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/purchase-orders/${grn.po_id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3 h-3" />
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
