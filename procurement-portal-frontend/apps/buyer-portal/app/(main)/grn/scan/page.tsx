"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  useScanLookupAsn,
  useFastGrnIntake,
  AsnResponse,
} from "@procurement/hooks";
import {
  Barcode,
  ArrowLeft,
  Truck,
  CheckCircle2,
  AlertCircle,
  Package,
  Boxes,
  Zap,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  Search,
} from "lucide-react";

export default function WarehouseBarcodeScanPage() {
  const [scanInput, setScanInput] = useState("");
  const [activeAsn, setActiveAsn] = useState<AsnResponse | null>(null);
  const [challanNumberOverride, setChallanNumberOverride] = useState("");
  const [dockNotes, setDockNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    grnNumber: string;
    asnNumber: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const scanMutation = useScanLookupAsn();
  const fastGrnMutation = useFastGrnIntake();

  useEffect(() => {
    // Focus barcode input on mount
    inputRef.current?.focus();
  }, []);

  const handleScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = scanInput.trim();
    if (!code) return;

    setErrorMessage(null);
    setSuccessResult(null);

    try {
      const data = await scanMutation.mutateAsync(code);
      setActiveAsn(data);
      setChallanNumberOverride(data.asn_number);
      setDockNotes("");
    } catch (err: any) {
      setActiveAsn(null);
      setErrorMessage(
        err?.response?.data?.message ||
          `No Advance Shipping Notice found for barcode or tracking code "${code}".`
      );
    }
  };

  const handleFastIntake = async () => {
    if (!activeAsn) return;
    setErrorMessage(null);

    try {
      const res = await fastGrnMutation.mutateAsync({
        id: activeAsn.id,
        payload: {
          challan_number: challanNumberOverride.trim() || activeAsn.asn_number,
          notes: dockNotes.trim() || undefined,
        },
      });

      setSuccessResult({
        grnNumber: res.grn.grn_number,
        asnNumber: activeAsn.asn_number,
      });
      setActiveAsn(res.asn);
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message || "Failed to process warehouse fast-track intake."
      );
    }
  };

  const handleReset = () => {
    setScanInput("");
    setActiveAsn(null);
    setSuccessResult(null);
    setErrorMessage(null);
    setChallanNumberOverride("");
    setDockNotes("");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/grn"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Goods Receipts
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
            <Barcode className="w-7 h-7 text-emerald-500" /> Warehouse Barcode Fast-Track Intake
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Scan Code-128 shipping labels or enter tracking numbers to instantly verify contents and generate confirmed GRNs.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors self-start sm:self-auto"
        >
          <RotateCcw className="w-4 h-4" /> Reset Scanner
        </button>
      </div>

      {/* Scanner Barcode Input Strip */}
      <div className="p-6 bg-white dark:bg-[#1C1C1F] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
        <form onSubmit={handleScanSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Barcode className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Scan Code-128 Barcode, or enter ASN / Tracking # (e.g. ASN-2026-00001)..."
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-base font-mono bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={scanMutation.isPending || !scanInput.trim()}
            className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            {scanMutation.isPending ? "Searching..." : "Lookup Package"}
          </button>
        </form>

        <p className="text-xs text-neutral-400">
          Tip: Handheld USB or Bluetooth barcode scanners configured with automatic Enter will trigger lookup instantly.
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success Banner */}
      {successResult && (
        <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-neutral-900 dark:text-white space-y-3">
          <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-7 h-7 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-bold">Fast-Track Intake Completed Successfully!</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-0.5">
                Goods Receipt Note <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{successResult.grnNumber}</span> has been confirmed. PO balances and 3-way match eligibility have been updated.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/grn"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg hover:bg-emerald-200 transition-colors"
            >
              View All GRNs <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={handleReset}
              className="px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Scan Next Package
            </button>
          </div>
        </div>
      )}

      {/* Scanned Package Details Card */}
      {activeAsn && (
        <div className="p-6 bg-white dark:bg-[#1C1C1F] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
          {/* Header & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xl text-neutral-900 dark:text-white">
                  {activeAsn.asn_number}
                </span>
                {activeAsn.status === "RECEIVED" ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Received into Warehouse
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 flex items-center gap-1">
                    <Truck className="w-3 h-3" /> Ready for Dock Intake
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Carrier: <span className="font-medium text-neutral-700 dark:text-neutral-300">{activeAsn.carrier_name}</span> | AWB: <span className="font-mono">{activeAsn.tracking_number}</span>
                {activeAsn.vehicle_number ? ` | Veh: ${activeAsn.vehicle_number}` : ""}
              </p>
            </div>

            {/* 1-Click Intake Action */}
            {activeAsn.status !== "RECEIVED" ? (
              <button
                onClick={handleFastIntake}
                disabled={fastGrnMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
              >
                <Zap className="w-4 h-4" />
                {fastGrnMutation.isPending ? "Generating Confirmed GRN..." : "1-Click Dock Intake (Generate GRN)"}
              </button>
            ) : (
              <div className="text-xs font-medium text-neutral-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Intake Already Complete
              </div>
            )}
          </div>

          {/* Logistics Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 text-xs">
            <div>
              <span className="text-neutral-400 block mb-0.5 uppercase tracking-wider">Purchase Order</span>
              <span className="font-semibold text-neutral-900 dark:text-white font-mono">
                {activeAsn.po_number || activeAsn.po_id}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block mb-0.5 uppercase tracking-wider">Packaging</span>
              <span className="font-semibold text-neutral-900 dark:text-white">
                {activeAsn.package_count} × {activeAsn.packaging_type}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block mb-0.5 uppercase tracking-wider">Gross Weight</span>
              <span className="font-semibold text-neutral-900 dark:text-white">
                {activeAsn.gross_weight_kg ? `${activeAsn.gross_weight_kg} kg` : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block mb-0.5 uppercase tracking-wider">Shipment Date</span>
              <span className="font-semibold text-neutral-900 dark:text-white">
                {activeAsn.shipment_date}
              </span>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-3">
              Shipment Contents ({activeAsn.lines.length} Line Items)
            </h3>
            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 dark:bg-neutral-800 uppercase font-semibold text-neutral-600 dark:text-neutral-300">
                  <tr>
                    <th className="px-4 py-2.5">Item Description</th>
                    <th className="px-4 py-2.5">Lot / Batch</th>
                    <th className="px-4 py-2.5">Serial Numbers</th>
                    <th className="px-4 py-2.5 text-right">Shipped Qty</th>
                    <th className="px-4 py-2.5 text-right">Received Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                  {activeAsn.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                      <td className="px-4 py-3 font-medium text-neutral-900 dark:text-white">
                        {line.item_description}
                        {line.item_code && (
                          <span className="ml-1.5 text-neutral-400 font-mono">[{line.item_code}]</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-neutral-500">
                        {line.lot_number || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-neutral-500">
                        {line.serial_numbers && line.serial_numbers.length > 0
                          ? line.serial_numbers.join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-neutral-900 dark:text-white">
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

          {/* Optional Dock Intake Challan / Notes Overrides */}
          {activeAsn.status !== "RECEIVED" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Challan / LR Number Override (optional)
                </label>
                <input
                  type="text"
                  value={challanNumberOverride}
                  onChange={(e) => setChallanNumberOverride(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Receiving Dock Notes (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scanned at Dock Bay 4, outer seal intact"
                  value={dockNotes}
                  onChange={(e) => setDockNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
