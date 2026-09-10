"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  usePurchaseOrders,
  useCreateAsn,
  POResponse,
} from "@procurement/hooks";
import {
  Truck,
  ArrowLeft,
  Package,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Barcode,
  Layers,
  FileText,
} from "lucide-react";

export default function CreateAsnPage() {
  const router = useRouter();
  const createAsnMutation = useCreateAsn();

  // PO Selection
  const { data: purchaseOrders = [], isLoading: poLoading } = usePurchaseOrders();
  const eligiblePOs = useMemo(() => {
    return purchaseOrders.filter((po) =>
      ["RELEASED", "SENT_TO_VENDOR", "ACKNOWLEDGED", "VENDOR_ACKNOWLEDGED", "PARTIALLY_RECEIVED"].includes(
        po.status
      )
    );
  }, [purchaseOrders]);

  const [selectedPoId, setSelectedPoId] = useState<string>("");
  const selectedPO = useMemo(() => {
    return eligiblePOs.find((p) => p.id === selectedPoId) || null;
  }, [eligiblePOs, selectedPoId]);

  // Logistics & Carrier fields
  const [carrierName, setCarrierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [packagingType, setPackagingType] = useState("BOX");
  const [packageCount, setPackageCount] = useState(1);
  const [grossWeightKg, setGrossWeightKg] = useState<string>("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");

  // Line item quantities & lot tracking
  const [lineInputs, setLineInputs] = useState<
    Record<
      string,
      {
        shippedQuantity: number;
        lotNumber: string;
        serialNumbers: string;
        expiryDate: string;
      }
    >
  >({});

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePoChange = (poId: string) => {
    setSelectedPoId(poId);
    const po = eligiblePOs.find((p) => p.id === poId);
    if (po && po.lines) {
      const initialLines: Record<string, any> = {};
      po.lines.forEach((line) => {
        const openQty = parseFloat(String(line.open_quantity ?? line.ordered_quantity ?? 0));
        initialLines[line.id] = {
          shippedQuantity: openQty,
          lotNumber: "",
          serialNumbers: "",
          expiryDate: "",
        };
      });
      setLineInputs(initialLines);
    }
  };

  const handleLineChange = (lineId: string, field: string, value: any) => {
    setLineInputs((prev) => ({
      ...prev,
      [lineId]: {
        ...(prev[lineId] || { shippedQuantity: 0, lotNumber: "", serialNumbers: "", expiryDate: "" }),
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedPO) {
      setErrorMessage("Please select a Purchase Order");
      return;
    }

    if (!carrierName.trim() || !trackingNumber.trim()) {
      setErrorMessage("Carrier name and tracking number are required");
      return;
    }

    if (!expectedDeliveryDate) {
      setErrorMessage("Expected delivery date is required");
      return;
    }

    const linesPayload = (selectedPO.lines || [])
      .map((line) => {
        const input = lineInputs[line.id];
        const qty = input ? parseFloat(String(input.shippedQuantity)) : 0;
        if (qty <= 0) return null;

        const serials = input?.serialNumbers
          ? input.serialNumbers
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

        return {
          po_line_id: line.id,
          shipped_quantity: qty,
          lot_number: input?.lotNumber || undefined,
          serial_numbers: serials,
          expiry_date: input?.expiryDate || undefined,
        };
      })
      .filter(Boolean) as any[];

    if (linesPayload.length === 0) {
      setErrorMessage("At least one line item must have a shipped quantity greater than zero");
      return;
    }

    try {
      const created = await createAsnMutation.mutateAsync({
        po_id: selectedPO.id,
        expected_delivery_date: expectedDeliveryDate,
        carrier_name: carrierName,
        tracking_number: trackingNumber,
        vehicle_number: vehicleNumber || undefined,
        driver_name: driverName || undefined,
        driver_phone: driverPhone || undefined,
        packaging_type: packagingType,
        package_count: Number(packageCount) || 1,
        gross_weight_kg: grossWeightKg ? parseFloat(grossWeightKg) : undefined,
        notes: notes || undefined,
        lines: linesPayload,
      });

      router.push(`/asns/${created.id}`);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || "Failed to create ASN");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/asns"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Shipping Notices
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
          <Truck className="w-7 h-7 text-emerald-500" /> Create Advance Shipping Notice (ASN)
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Prepare outbound manifest and generate a scannable warehouse packing slip.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Purchase Order Selection */}
        <div className="p-6 bg-white dark:bg-[#1C1C1F] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white">
            <FileText className="w-5 h-5 text-emerald-500" /> 1. Select Purchase Order
          </div>

          {poLoading ? (
            <div className="text-sm text-neutral-400">Loading purchase orders...</div>
          ) : eligiblePOs.length === 0 ? (
            <div className="text-sm text-neutral-500">
              No acknowledged or released purchase orders available for shipment.
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                Purchase Order
              </label>
              <select
                value={selectedPoId}
                onChange={(e) => handlePoChange(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Choose a Purchase Order --</option>
                {eligiblePOs.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.po_number} — {po.title || "Order"} ({po.status})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Step 2: Logistics & Dispatch Details */}
        <div className="p-6 bg-white dark:bg-[#1C1C1F] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white">
            <Truck className="w-5 h-5 text-emerald-500" /> 2. Carrier & Dispatch Details
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                Carrier / Logistics Provider *
              </label>
              <input
                type="text"
                placeholder="e.g. DHL Express, BlueDart, FedEx"
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                Tracking / Waybill Number *
              </label>
              <input
                type="text"
                placeholder="e.g. AWB-987654321"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                Vehicle Registration #
              </label>
              <input
                type="text"
                placeholder="e.g. MH-12-AB-1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                Expected Delivery Date *
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                Driver Name
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                Driver Phone
              </label>
              <input
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                Packaging Type
              </label>
              <select
                value={packagingType}
                onChange={(e) => setPackagingType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="BOX">Corrugated Boxes</option>
                <option value="PALLET">Wooden Pallets</option>
                <option value="CRATE">Industrial Crates</option>
                <option value="CARTON">Master Cartons</option>
                <option value="CONTAINER">Shipping Container</option>
                <option value="DRUM">Barrels / Drums</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                  Package Count
                </label>
                <input
                  type="number"
                  min="1"
                  value={packageCount}
                  onChange={(e) => setPackageCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                  Gross Wt (KG)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 24.5"
                  value={grossWeightKg}
                  onChange={(e) => setGrossWeightKg(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
              Handling / Dock Instructions
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Temperature-sensitive, fragile sensors, dock bay 4 delivery"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Step 3: Shipped Quantities and Batch Traceability */}
        {selectedPO && (
          <div className="p-6 bg-white dark:bg-[#1C1C1F] rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white">
              <Package className="w-5 h-5 text-emerald-500" /> 3. Line Items & Shipped Quantities
            </div>

            <div className="space-y-4">
              {(selectedPO.lines || []).map((line) => {
                const openQty = parseFloat(String(line.open_quantity ?? line.ordered_quantity ?? 0));
                const input = lineInputs[line.id] || {
                  shippedQuantity: openQty,
                  lotNumber: "",
                  serialNumbers: "",
                  expiryDate: "",
                };

                return (
                  <div
                    key={line.id}
                    className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div>
                        <span className="font-semibold text-sm text-neutral-900 dark:text-white">
                          Line {line.line_number}: {line.item_description}
                        </span>
                        {line.item_code && (
                          <span className="ml-2 text-xs font-mono text-neutral-400">
                            [{line.item_code}]
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        Remaining Open: <span className="font-bold text-emerald-500">{openQty}</span> / Ordered: {line.ordered_quantity}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">
                          Shipped Qty *
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={openQty}
                          value={input.shippedQuantity}
                          onChange={(e) =>
                            handleLineChange(line.id, "shippedQuantity", parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">
                          Lot / Batch #
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. LOT-2026-X1"
                          value={input.lotNumber}
                          onChange={(e) => handleLineChange(line.id, "lotNumber", e.target.value)}
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">
                          Serial Numbers (csv)
                        </label>
                        <input
                          type="text"
                          placeholder="SN001, SN002..."
                          value={input.serialNumbers}
                          onChange={(e) => handleLineChange(line.id, "serialNumbers", e.target.value)}
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">
                          Expiry Date
                        </label>
                        <input
                          type="date"
                          value={input.expiryDate}
                          onChange={(e) => handleLineChange(line.id, "expiryDate", e.target.value)}
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/asns"
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createAsnMutation.isPending || !selectedPO}
            className="inline-flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
          >
            <Barcode className="w-4 h-4" />
            {createAsnMutation.isPending ? "Generating ASN & Packing Slip..." : "Create ASN & Generate Slip"}
          </button>
        </div>
      </form>
    </div>
  );
}
