"use client";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useAsn,
  useDispatchAsn,
} from "@procurement/hooks";
import {
  ArrowLeft,
  Printer,
  Truck,
  CheckCircle2,
  Barcode,
  Package,
  Calendar,
  Building2,
  MapPin,
  Clock,
  ShieldCheck,
  Send,
} from "lucide-react";

export default function AsnDetailPage() {
  const params = useParams();
  const asnId = String(params?.id || "");

  const { data: asn, isLoading, isError, refetch } = useAsn(asnId);
  const dispatchMutation = useDispatchAsn();

  const handlePrint = () => {
    window.print();
  };

  const handleDispatch = async () => {
    if (!asn) return;
    await dispatchMutation.mutateAsync({
      id: asn.id,
      payload: {},
    });
    refetch();
  };

  // Generate a realistic SVG Code-128 barcode simulation based on barcode_data string
  const barcodeBars = useMemo(() => {
    if (!asn?.barcode_data) return [];
    const str = asn.barcode_data;
    const bars: { width: number; fill: boolean }[] = [];
    // Deterministic pseudo-pattern based on character codes
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      bars.push({ width: (code % 3) + 1, fill: true });
      bars.push({ width: ((code >> 2) % 2) + 1, fill: false });
      bars.push({ width: ((code >> 4) % 3) + 1, fill: true });
      bars.push({ width: 1, fill: false });
    }
    return bars;
  }, [asn?.barcode_data]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-neutral-400">
        Loading Advance Shipping Notice details...
      </div>
    );
  }

  if (isError || !asn) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-red-500">
        Advance Shipping Notice not found or failed to load.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Action Bar - Hidden in Print */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/asns"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Shipping Notices
        </Link>
        <div className="flex items-center gap-3">
          {asn.status === "DRAFT" && (
            <button
              onClick={handleDispatch}
              disabled={dispatchMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors"
            >
              <Send className="w-4 h-4" />
              {dispatchMutation.isPending ? "Dispatching..." : "Mark Dispatched"}
            </button>
          )}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" /> Print Packing Slip
          </button>
        </div>
      </div>

      {/* Printable Slip Container */}
      <div className="p-8 bg-white dark:bg-[#1C1C1F] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm print:shadow-none print:border-0 print:p-0 space-y-6 text-neutral-900 dark:text-white print:text-black">
        {/* Header with Barcode */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-neutral-200 dark:border-neutral-800 print:border-neutral-300 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Advance Shipping Notice
              </span>
              <span className="text-xs text-neutral-500 font-medium">
                {asn.status === "RECEIVED" ? "✓ RECEIVED INTO DOCK" : "IN TRANSIT"}
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight mt-2 font-mono">{asn.asn_number}</h1>
            <p className="text-xs text-neutral-500 mt-1">
              Generated on {new Date(asn.created_at).toLocaleDateString()}
            </p>
          </div>

          {/* Scannable Code-128 SVG Simulation */}
          <div className="bg-white p-3 rounded-lg border border-neutral-200 shadow-sm flex flex-col items-center">
            <svg height="54" className="w-64 max-w-full">
              <g fill="#000000">
                {(() => {
                  let currentX = 10;
                  return barcodeBars.map((bar, idx) => {
                    const rect = bar.fill ? (
                      <rect key={idx} x={currentX} y="0" width={bar.width * 1.5} height="40" />
                    ) : null;
                    currentX += bar.width * 1.5;
                    return rect;
                  });
                })()}
              </g>
            </svg>
            <span className="text-[10px] font-mono tracking-widest text-neutral-700 mt-1">
              *{asn.asn_number}*
            </span>
          </div>
        </div>

        {/* Logistics & Manifest Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 print:bg-neutral-50 print:border-neutral-300">
          <div>
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-1">
              Purchase Order
            </span>
            <span className="text-sm font-semibold font-mono text-emerald-600 dark:text-emerald-400">
              {asn.po_number || "Direct PO"}
            </span>
          </div>

          <div>
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-1">
              Carrier & Tracking
            </span>
            <span className="text-sm font-semibold block">{asn.carrier_name}</span>
            <span className="text-xs font-mono text-neutral-500 block">AWB: {asn.tracking_number}</span>
            {asn.vehicle_number && (
              <span className="text-xs text-neutral-400 block">Veh: {asn.vehicle_number}</span>
            )}
          </div>

          <div>
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-1">
              Packaging Manifest
            </span>
            <span className="text-sm font-semibold block">
              {asn.package_count} × {asn.packaging_type}
            </span>
            {asn.gross_weight_kg && (
              <span className="text-xs text-neutral-500 block">Gross Wt: {asn.gross_weight_kg} kg</span>
            )}
            <span className="text-xs text-neutral-500 block">
              Exp. Delivery: {asn.expected_delivery_date}
            </span>
          </div>
        </div>

        {/* Driver & Delivery Notes */}
        {(asn.driver_name || asn.notes) && (
          <div className="text-xs p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 space-y-1">
            {asn.driver_name && (
              <div>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">Driver: </span>
                {asn.driver_name} {asn.driver_phone ? `(${asn.driver_phone})` : ""}
              </div>
            )}
            {asn.notes && (
              <div>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">Instructions: </span>
                {asn.notes}
              </div>
            )}
          </div>
        )}

        {/* Shipped Items Manifest */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
            Package Line Item Contents
          </h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800 print:border-neutral-300">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100 dark:bg-neutral-800 print:bg-neutral-200 uppercase font-semibold text-neutral-600 dark:text-neutral-300">
                <tr>
                  <th className="px-4 py-2.5">Item Description</th>
                  <th className="px-4 py-2.5">Lot / Batch #</th>
                  <th className="px-4 py-2.5">Serial #s</th>
                  <th className="px-4 py-2.5 text-right">Shipped Qty</th>
                  <th className="px-4 py-2.5 text-right">Received Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {asn.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-neutral-900 dark:text-white print:text-black">
                        {line.item_description}
                      </div>
                      {line.item_code && (
                        <div className="font-mono text-[10px] text-neutral-500">
                          SKU: {line.item_code}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-600 dark:text-neutral-300">
                      {line.lot_number || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-600 dark:text-neutral-300">
                      {line.serial_numbers && line.serial_numbers.length > 0
                        ? line.serial_numbers.join(", ")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-neutral-900 dark:text-white print:text-black">
                      {line.shipped_quantity} {line.uom}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {line.received_quantity} {line.uom}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Barcode Payload Raw Verification String */}
        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-500">
          <div className="font-mono">
            RAW BARCODE DATA: <span className="font-bold">{asn.barcode_data}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 sm:mt-0 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" /> Ready for Fast-Track GRN Intake
          </div>
        </div>
      </div>
    </div>
  );
}
