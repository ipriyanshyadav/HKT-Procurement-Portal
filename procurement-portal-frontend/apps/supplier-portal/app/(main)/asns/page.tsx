"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  useAsns,
  AsnResponse,
} from "@procurement/hooks";
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Package,
  ArrowRight,
  ExternalLink,
  Barcode,
  Boxes,
} from "lucide-react";

export default function SupplierAsnsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: asns = [], isLoading, isError, refetch } = useAsns({
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const kpis = useMemo(() => {
    const total = asns.length;
    const inTransit = asns.filter((a) => a.status === "SHIPPED").length;
    const received = asns.filter((a) => a.status === "RECEIVED").length;
    const totalPackages = asns.reduce((acc, a) => acc + (a.package_count || 1), 0);
    return { total, inTransit, received, totalPackages };
  }, [asns]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RECEIVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Received into Warehouse
          </span>
        );
      case "SHIPPED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Truck className="w-3 h-3" /> In Transit
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-500" /> Advance Shipping Notices (ASN)
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Generate barcode packing slips and notify buyer warehouses of outbound shipments.
          </p>
        </div>
        <Link
          href="/asns/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Shipment Notice
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-[#1C1C1F] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Total Shipments
            </span>
            <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-2">{kpis.total}</p>
        </div>

        <div className="p-5 bg-white dark:bg-[#1C1C1F] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              In Transit
            </span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{kpis.inTransit}</p>
        </div>

        <div className="p-5 bg-white dark:bg-[#1C1C1F] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Received into Dock
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{kpis.received}</p>
        </div>

        <div className="p-5 bg-white dark:bg-[#1C1C1F] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Total Packages
            </span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">{kpis.totalPackages}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white dark:bg-[#1C1C1F] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search ASN #, tracking, carrier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Statuses</option>
            <option value="SHIPPED">In Transit (Shipped)</option>
            <option value="RECEIVED">Received into Warehouse</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
      </div>

      {/* ASN Table */}
      <div className="bg-white dark:bg-[#1C1C1F] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-neutral-400">Loading Advance Shipping Notices...</div>
        ) : isError ? (
          <div className="p-12 text-center text-red-500">
            Failed to load Advance Shipping Notices. Please retry.
          </div>
        ) : asns.length === 0 ? (
          <div className="p-12 text-center">
            <Barcode className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <p className="text-base font-medium text-neutral-900 dark:text-white">No Shipment Notices Found</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Create your first Advance Shipping Notice to generate a scannable warehouse intake slip.
            </p>
            <Link
              href="/asns/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Shipment Notice
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-300">
              <thead className="bg-neutral-50 dark:bg-neutral-900 text-xs uppercase font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-6 py-3.5">ASN Number</th>
                  <th className="px-6 py-3.5">Carrier & Tracking</th>
                  <th className="px-6 py-3.5">Packaging</th>
                  <th className="px-6 py-3.5">Shipment Date</th>
                  <th className="px-6 py-3.5">Expected Delivery</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {asns.map((asn) => (
                  <tr
                    key={asn.id}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Barcode className="w-4 h-4 text-emerald-500" />
                        {asn.asn_number}
                      </div>
                      {asn.po_number && (
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                          PO: {asn.po_number}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-neutral-900 dark:text-white">{asn.carrier_name}</div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                        {asn.tracking_number}
                      </div>
                      {asn.vehicle_number && (
                        <div className="text-xs text-neutral-400 mt-0.5">Veh: {asn.vehicle_number}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-neutral-900 dark:text-white">
                        {asn.package_count} × {asn.packaging_type}
                      </div>
                      {asn.gross_weight_kg && (
                        <div className="text-xs text-neutral-500 mt-0.5">{asn.gross_weight_kg} kg gross</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-neutral-900 dark:text-white">
                      {asn.shipment_date}
                    </td>
                    <td className="px-6 py-4 text-neutral-900 dark:text-white">
                      {asn.expected_delivery_date}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(asn.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/asns/${asn.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors"
                      >
                        Packing Slip <ArrowRight className="w-3.5 h-3.5" />
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
