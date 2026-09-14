"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useBusinessUnits,
  useCostCenters,
  useDeliveryLocations,
  useUoms,
  useCategories,
  useUserCart,
  useAvailableBuyers,
  useTransferIndent,
  useTransferCartAsIndent,
  useAppToast,
  type IndentLineItem,
} from "@procurement/hooks";
import {
  PageHeader,
  Button,
  PermissionGuard,
  Badge,
} from "@procurement/ui";
import {
  ShoppingCart,
  UserCheck,
  Package,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Store,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";

export default function NewIndentPage() {
  const router = useRouter();
  const { toast } = useAppToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Cart & Catalog data
  const { data: cart, isLoading: isCartLoading } = useUserCart();
  const [sourceMode, setSourceMode] = useState<"cart" | "manual">("cart");

  // Master data
  const { data: businessUnits = [] } = useBusinessUnits();
  const [businessUnitId, setBusinessUnitId] = useState("");
  const { data: costCenters = [] } = useCostCenters({
    business_unit_id: businessUnitId || undefined,
  });
  const [costCenterId, setCostCenterId] = useState("");
  const { data: deliveryLocations = [] } = useDeliveryLocations();
  const [deliveryLocationId, setDeliveryLocationId] = useState("");
  const { data: categories = [] } = useCategories({ flat: true, active_only: true });
  const [categoryId, setCategoryId] = useState("");
  const { data: uoms = [] } = useUoms();

  // Basic Details
  const [title, setTitle] = useState("");
  const [procurementType, setProcurementType] = useState<"CAPEX" | "OPEX" | "PROJECT" | "MRO" | "SERVICES">("OPEX");
  const [requiredByDate, setRequiredByDate] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [indentNotes, setIndentNotes] = useState("");

  // Buyer Assignment
  const [autoAssignBuyer, setAutoAssignBuyer] = useState(true);
  const [assignedBuyerId, setAssignedBuyerId] = useState<string | null>(null);
  const { data: buyers = [], isLoading: isBuyersLoading } = useAvailableBuyers({
    category_id: categoryId || undefined,
    business_unit_id: businessUnitId || undefined,
  });

  // Manual lines
  const [manualLines, setManualLines] = useState<IndentLineItem[]>([
    {
      line_number: 1,
      item_description: "",
      item_code: "",
      category_id: "",
      uom_id: "",
      quantity: 1,
      estimated_unit_price: 0,
      specifications: "",
    },
  ]);

  // Mutations
  const transferIndentMutation = useTransferIndent();
  const transferCartMutation = useTransferCartAsIndent();
  const [error, setError] = useState<string | null>(null);

  // Set defaults once master data loads
  useEffect(() => {
    if (businessUnits.length > 0 && !businessUnitId) {
      setBusinessUnitId(businessUnits[0].id);
    }
  }, [businessUnits, businessUnitId]);

  useEffect(() => {
    if (costCenters.length > 0 && !costCenterId) {
      setCostCenterId(costCenters[0].id);
    }
  }, [costCenters, costCenterId]);

  useEffect(() => {
    if (deliveryLocations.length > 0 && !deliveryLocationId) {
      setDeliveryLocationId(deliveryLocations[0].id);
    }
  }, [deliveryLocations, deliveryLocationId]);

  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // Set default title if cart has items
  useEffect(() => {
    if (cart?.items && cart.items.length > 0 && !title) {
      setTitle(`Demand Indent: ${cart.items[0].item_name} ${cart.items.length > 1 ? `+ ${cart.items.length - 1} items` : ""}`);
    }
  }, [cart, title]);

  const cartItems = cart?.items ?? [];
  const cartSubtotal = cart?.subtotal ?? 0;

  const handleAddManualLine = () => {
    setManualLines((prev) => [
      ...prev,
      {
        line_number: prev.length + 1,
        item_description: "",
        item_code: "",
        category_id: categoryId || "",
        uom_id: uoms[0]?.id || "",
        quantity: 1,
        estimated_unit_price: 0,
        specifications: "",
      },
    ]);
  };

  const handleRemoveManualLine = (idx: number) => {
    setManualLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleManualLineChange = (idx: number, field: keyof IndentLineItem, val: any) => {
    setManualLines((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  const calculateTotalValue = () => {
    if (sourceMode === "cart" && cartItems.length > 0) {
      return cartSubtotal;
    }
    return manualLines.reduce(
      (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.estimated_unit_price) || 0),
      0
    );
  };

  const handleFinalSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Please provide a title for this indent.");
      return;
    }
    if (!businessUnitId) {
      setError("Please select a Business Unit.");
      return;
    }
    if (!costCenterId) {
      setError("Please select a Cost Center.");
      return;
    }

    try {
      if (sourceMode === "cart" && cartItems.length > 0) {
        const res = await transferCartMutation.mutateAsync({
          title,
          indent_notes: indentNotes || undefined,
          assigned_buyer_id: autoAssignBuyer ? null : assignedBuyerId,
          business_unit_id: businessUnitId,
          cost_center_id: costCenterId,
          delivery_location_id: deliveryLocationId || undefined,
          required_by_date: requiredByDate || undefined,
          procurement_type: procurementType,
          is_emergency: isEmergency,
        });
        toast.success(
          "Indent Transferred",
          `Indent ${res.pr_number} has been transferred to the buyer.`
        );
        router.push(`/indents/${res.pr_id}`);
      } else {
        const validLines = manualLines.map((l, i) => ({
          ...l,
          line_number: i + 1,
          category_id: l.category_id || categoryId,
          uom_id: l.uom_id || (uoms[0]?.id ?? ""),
          quantity: Number(l.quantity) || 1,
          estimated_unit_price: Number(l.estimated_unit_price) || 0,
        }));

        if (validLines.some((l) => !l.item_description.trim())) {
          setError("All line items must have an item description.");
          return;
        }

        const res = await transferIndentMutation.mutateAsync({
          title,
          description: indentNotes || undefined,
          business_unit_id: businessUnitId,
          cost_center_id: costCenterId,
          delivery_location_id: deliveryLocationId || undefined,
          category_id: categoryId,
          procurement_type: procurementType,
          required_by_date: requiredByDate || undefined,
          is_emergency: isEmergency,
          indent_notes: indentNotes || undefined,
          assigned_buyer_id: autoAssignBuyer ? null : assignedBuyerId,
          lines: validLines,
        });
        toast.success(
          "Demand Indent Transferred",
          `Demand indent ${res.pr_number} successfully handed off to the procurement team.`
        );
        router.push(`/indents/${res.pr_id}`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to submit indent. Please verify all fields.");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Raise Demand Indent"
        subtitle="Specify requirements and transfer purchase demand to a procurement buyer"
        actions={
          <Link href="/indents">
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </Link>
        }
      />

      {/* Stepper */}
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-4">
        {[
          { num: 1, label: "Items & Cart" },
          { num: 2, label: "Department & Allocation" },
          { num: 3, label: "Buyer Assignment & Hand-off" },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s.num
                  ? "bg-amber-500 text-white"
                  : step > s.num
                  ? "bg-emerald-500 text-white"
                  : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
              }`}
            >
              {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
            </div>
            <span
              className={`text-sm font-medium ${
                step === s.num
                  ? "text-neutral-900 dark:text-white"
                  : "text-neutral-500"
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</div>
        </div>
      )}

      {/* STEP 1: Items & Source */}
      {step === 1 && (
        <div className="flex flex-col gap-6 bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-500" />
              Select Requisition Items
            </h2>
            <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setSourceMode("cart")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  sourceMode === "cart"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs"
                    : "text-neutral-500"
                }`}
              >
                Shopping Cart ({cartItems.length})
              </button>
              <button
                type="button"
                onClick={() => setSourceMode("manual")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  sourceMode === "manual"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs"
                    : "text-neutral-500"
                }`}
              >
                Custom Line Items
              </button>
            </div>
          </div>

          {sourceMode === "cart" ? (
            <div className="flex flex-col gap-4">
              {cartItems.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-lg flex flex-col items-center gap-3">
                  <ShoppingCart className="w-10 h-10 text-neutral-300" />
                  <p className="text-sm text-neutral-500">Your shopping cart is currently empty.</p>
                  <div className="flex gap-2 mt-2">
                    <Link href="/marketplace">
                      <Button variant="primary" size="sm" className="flex items-center gap-2">
                        <Store className="w-4 h-4" />
                        Browse Catalog
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => setSourceMode("manual")}>
                      Enter Custom Items Instead
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
                    <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800 text-sm">
                      <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium text-neutral-500">Item</th>
                          <th className="px-4 py-2.5 text-right font-medium text-neutral-500">Quantity</th>
                          <th className="px-4 py-2.5 text-right font-medium text-neutral-500">Unit Price</th>
                          <th className="px-4 py-2.5 text-right font-medium text-neutral-500">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {cartItems.map((ci) => (
                          <tr key={ci.id}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-neutral-800 dark:text-neutral-200">{ci.item_name}</div>
                              <div className="text-xs text-neutral-400 font-mono">{ci.item_code}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">{ci.quantity}</td>
                            <td className="px-4 py-3 text-right font-mono">₹{ci.unit_price}</td>
                            <td className="px-4 py-3 text-right font-mono font-medium text-neutral-900 dark:text-white">
                              ₹{ci.total_price}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                    <span className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5 font-medium">
                      <Sparkles className="w-4 h-4" />
                      {cartItems.length} catalog items will be bundled into this demand indent.
                    </span>
                    <span className="text-sm font-bold text-amber-900 dark:text-amber-200 font-mono">
                      Subtotal: ₹{cartSubtotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-500 font-medium">Define your required products or services:</span>
                <Button variant="ghost" size="sm" onClick={handleAddManualLine} className="flex items-center gap-1 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                {manualLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-lg flex flex-col md:flex-row gap-3 items-start md:items-center bg-neutral-50/50 dark:bg-neutral-800/30"
                  >
                    <div className="flex-1 w-full">
                      <label className="text-xs text-neutral-500 block mb-1">Item Description *</label>
                      <input
                        type="text"
                        value={line.item_description}
                        onChange={(e) => handleManualLineChange(idx, "item_description", e.target.value)}
                        placeholder="e.g. Ergonomic Office Chair or Cloud Compute Node"
                        className="w-full text-sm px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-xs text-neutral-500 block mb-1">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => handleManualLineChange(idx, "quantity", Number(e.target.value))}
                        className="w-full text-sm px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-right font-mono"
                      />
                    </div>
                    <div className="w-32">
                      <label className="text-xs text-neutral-500 block mb-1">Est. Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={line.estimated_unit_price}
                        onChange={(e) => handleManualLineChange(idx, "estimated_unit_price", Number(e.target.value))}
                        className="w-full text-sm px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-right font-mono"
                      />
                    </div>
                    <div className="w-28 text-right font-mono text-sm font-semibold pt-5">
                      ₹{((Number(line.quantity) || 0) * (Number(line.estimated_unit_price) || 0)).toLocaleString("en-IN")}
                    </div>
                    {manualLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveManualLine(idx)}
                        className="mt-5 text-neutral-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Button
              variant="primary"
              onClick={() => {
                if (sourceMode === "cart" && cartItems.length === 0) {
                  setError("Cart is empty. Please add items or switch to custom lines.");
                  return;
                }
                setError(null);
                setStep(2);
              }}
              className="flex items-center gap-2"
            >
              Continue to Allocation <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Department & Allocation */}
      {step === 2 && (
        <div className="flex flex-col gap-6 bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Requisition Allocation & Schedule
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-full">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 block mb-1">
                Indent Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q3 Engineering Lab Hardware Replenishment"
                className="w-full text-sm px-3.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 block mb-1">
                Business Unit *
              </label>
              <select
                value={businessUnitId}
                onChange={(e) => setBusinessUnitId(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
              >
                {businessUnits.map((bu) => (
                  <option key={bu.id} value={bu.id}>
                    {bu.code} — {bu.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 block mb-1">
                Cost Center *
              </label>
              <select
                value={costCenterId}
                onChange={(e) => setCostCenterId(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
              >
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.code} — {cc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 block mb-1">
                Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 block mb-1">
                Delivery Location
              </label>
              <select
                value={deliveryLocationId}
                onChange={(e) => setDeliveryLocationId(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
              >
                {deliveryLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} — {loc.name} ({loc.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 block mb-1">
                Required By Date
              </label>
              <input
                type="date"
                value={requiredByDate}
                onChange={(e) => setRequiredByDate(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 block mb-1">
                Procurement Type
              </label>
              <select
                value={procurementType}
                onChange={(e) => setProcurementType(e.target.value as any)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
              >
                <option value="OPEX">OPEX (Operating Expenditure)</option>
                <option value="CAPEX">CAPEX (Capital Expenditure)</option>
                <option value="PROJECT">Project Specific</option>
                <option value="MRO">MRO (Maintenance & Repairs)</option>
                <option value="SERVICES">Services</option>
              </select>
            </div>

            <div className="col-span-full">
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-400"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">
                  Emergency Priority (Expedited Buyer Review)
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Button variant="ghost" onClick={() => setStep(1)} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Items
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!title.trim()) {
                  setError("Title is required.");
                  return;
                }
                setError(null);
                setStep(3);
              }}
              className="flex items-center gap-2"
            >
              Continue to Buyer Selection <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Buyer Assignment & Hand-off */}
      {step === 3 && (
        <div className="flex flex-col gap-6 bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-amber-500" />
            Buyer Assignment & Notes
          </h2>

          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white block">
                    Buyer Routing Mode
                  </span>
                  <span className="text-xs text-neutral-500">
                    As an Indentor, you transfer this purchase demand to a buyer for sourcing & checkout.
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAutoAssignBuyer(true);
                      setAssignedBuyerId(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      autoAssignBuyer
                        ? "bg-amber-500 text-white border-amber-500"
                        : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700"
                    }`}
                  >
                    Auto-Assign (Recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAutoAssignBuyer(false);
                      if (buyers.length > 0 && !assignedBuyerId) {
                        setAssignedBuyerId(buyers[0].id);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      !autoAssignBuyer
                        ? "bg-amber-500 text-white border-amber-500"
                        : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700"
                    }`}
                  >
                    Select Specific Buyer
                  </button>
                </div>
              </div>

              {!autoAssignBuyer && (
                <div className="mt-2 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                  <label className="text-xs font-medium text-neutral-500 block mb-2">
                    Available Buyers for this Category & BU:
                  </label>
                  {isBuyersLoading ? (
                    <div className="text-xs text-neutral-400">Loading buyers...</div>
                  ) : buyers.length === 0 ? (
                    <div className="text-xs text-amber-600">
                      No designated buyers found in this scope. System will auto-route to the procurement queue.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {buyers.map((buyer) => (
                        <div
                          key={buyer.id}
                          onClick={() => setAssignedBuyerId(buyer.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                            assignedBuyerId === buyer.id
                              ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-500"
                              : "border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100/50"
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                              {buyer.name || buyer.full_name || `${buyer.first_name || ""} ${buyer.last_name || ""}`.trim() || buyer.email}
                            </div>
                            <div className="text-xs text-neutral-500 font-mono">{buyer.email}</div>
                          </div>
                          {assignedBuyerId === buyer.id && (
                            <Badge variant="approved">Selected</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 block mb-1">
                Hand-off Notes to Buyer
              </label>
              <textarea
                rows={3}
                value={indentNotes}
                onChange={(e) => setIndentNotes(e.target.value)}
                placeholder="Include any specific brand preferences, timing constraints, technical specifications or project context for the buyer..."
                className="w-full text-sm px-3.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
              />
            </div>

            {/* Demand Summary Card */}
            <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 flex flex-col gap-2">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Demand Summary</span>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">Total Estimated Value:</span>
                <span className="font-bold text-neutral-900 dark:text-white font-mono">
                  ₹{calculateTotalValue().toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Target Hand-off:</span>
                <span>{autoAssignBuyer ? "Procurement Auto-Assignment Engine" : "Designated Buyer"}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Button variant="ghost" onClick={() => setStep(2)} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Allocation
            </Button>
            <PermissionGuard permission="indent.transfer">
              <Button
                variant="primary"
                onClick={handleFinalSubmit}
                loading={transferIndentMutation.isPending || transferCartMutation.isPending}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Transfer Indent
              </Button>
            </PermissionGuard>
          </div>
        </div>
      )}
    </div>
  );
}
