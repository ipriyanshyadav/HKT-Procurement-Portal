"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useCreateRequisition,
  useSubmitRequisition,
  useBudgetCheck,
  useBusinessUnits,
  useCostCenters,
  useUoms,
  RequisitionLineItem,
  PunchOutCartItem,
} from "@procurement/hooks";
import {
  CategoryTreeSelect,
  PRLineItemTable,
  BudgetIndicator,
  PermissionGuard,
  ItemCatalogModal,
  PunchOutModal,
} from "@procurement/ui";

export default function NewRequisitionPage() {
  const router = useRouter();
  const createMutation = useCreateRequisition();
  const submitMutation = useSubmitRequisition();

  const { data: businessUnits = [] } = useBusinessUnits();
  const [businessUnitId, setBusinessUnitId] = useState("");
  const { data: costCenters = [] } = useCostCenters({
    business_unit_id: businessUnitId || undefined,
  });
  const [costCenterId, setCostCenterId] = useState("");
  const { data: uoms = [] } = useUoms();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [procurementType, setProcurementType] = useState("OPEX");
  const [currency, setCurrency] = useState("INR");
  const [isEmergency, setIsEmergency] = useState(false);
  const [isCapex, setIsCapex] = useState(false);
  const [requiredByDate, setRequiredByDate] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const [lines, setLines] = useState<RequisitionLineItem[]>([
    {
      line_number: 1,
      item_description: "",
      item_code: "",
      category_id: "",
      uom_id: "",
      quantity: 1,
      estimated_unit_price: 0,
      estimated_total: 0,
    },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [punchoutModalOpen, setPunchoutModalOpen] = useState(false);

  const handleCatalogItemsSelected = (
    selectedItems: Array<{
      code: string;
      name: string;
      description: string;
      category_id: string;
      uom_id: string;
      price: number;
      currency: string;
      quantity: number;
    }>
  ) => {
    setLines((prev) => {
      const filtered =
        prev.length === 1 && !prev[0].item_description && !prev[0].item_code
          ? []
          : prev;

      const newLines: RequisitionLineItem[] = selectedItems.map((item, idx) => ({
        line_number: filtered.length + idx + 1,
        item_code: item.code,
        item_description: item.name,
        category_id: item.category_id || categoryId || "",
        uom_id: item.uom_id || uoms[0]?.id || "",
        quantity: item.quantity,
        estimated_unit_price: item.price,
        estimated_total: item.price * item.quantity,
      }));

      return [...filtered, ...newLines];
    });
  };

  const handlePunchOutCartTransferred = (cartItems: PunchOutCartItem[]) => {
    setLines((prev) => {
      const filtered =
        prev.length === 1 && !prev[0].item_description && !prev[0].item_code
          ? []
          : prev;

      const newLines: RequisitionLineItem[] = cartItems.map((item, idx) => ({
        line_number: filtered.length + idx + 1,
        item_code: item.item_code,
        item_description: item.item_description,
        category_id: categoryId || "",
        uom_id: uoms[0]?.id || "",
        quantity: item.quantity,
        estimated_unit_price: item.unit_price,
        estimated_total: item.unit_price * item.quantity,
      }));

      return [...filtered, ...newLines];
    });
  };

  // Auto-select first Business Unit if not set
  React.useEffect(() => {
    if (!businessUnitId && businessUnits.length > 0) {
      setBusinessUnitId(businessUnits[0].id);
    }
  }, [businessUnits, businessUnitId]);

  // Auto-select first Cost Center when available or when BU changes
  React.useEffect(() => {
    if (costCenters.length > 0) {
      if (!costCenterId || !costCenters.some((c) => c.id === costCenterId)) {
        setCostCenterId(costCenters[0].id);
      }
    } else {
      setCostCenterId("");
    }
  }, [costCenters, costCenterId]);

  // Set default UOM for existing lines once loaded
  React.useEffect(() => {
    if (uoms.length > 0) {
      setLines((prev) =>
        prev.map((l) => (l.uom_id ? l : { ...l, uom_id: uoms[0].id }))
      );
    }
  }, [uoms]);

  const estimatedTotal = lines.reduce(
    (acc, curr) => acc + (curr.estimated_total || curr.quantity * curr.estimated_unit_price || 0),
    0
  );

  const { data: budgetCheck } = useBudgetCheck({
    cost_center_id: costCenterId || undefined,
    amount: estimatedTotal,
    business_unit_id: businessUnitId || undefined,
    category_id: categoryId || undefined,
  });

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        line_number: prev.length + 1,
        item_description: "",
        item_code: "",
        category_id: categoryId || "",
        uom_id: uoms[0]?.id || "",
        quantity: 1,
        estimated_unit_price: 0,
        estimated_total: 0,
      },
    ]);
  };

  const handleRemoveLine = (lineNumber: number) => {
    if (lines.length <= 1) return;
    setLines((prev) =>
      prev
        .filter((l) => l.line_number !== lineNumber)
        .map((l, idx) => ({ ...l, line_number: idx + 1 }))
    );
  };

  const handleSubmit = async (shouldSubmitImmediately = false) => {
    setError(null);
    if (!title.trim() || title.length < 3) {
      setError("Title must be at least 3 characters");
      return;
    }
    if (!businessUnitId) {
      setError("Please select a Business Unit");
      return;
    }
    if (!costCenterId) {
      setError("Please select a Cost Center");
      return;
    }
    if (!categoryId) {
      setError("Please select a primary category");
      return;
    }
    if (lines.some((l) => !l.item_description.trim())) {
      setError("All line items must have a description");
      return;
    }
    if (lines.some((l) => !l.uom_id)) {
      setError("All line items must have a Unit of Measure");
      return;
    }

    try {
      // Create draft PR
      const payload = {
        title,
        description: description || undefined,
        procurement_type: procurementType,
        business_unit_id: businessUnitId,
        cost_center_id: costCenterId,
        category_id: categoryId,
        currency,
        is_emergency: isEmergency,
        is_capex: isCapex,
        required_by_date: requiredByDate || undefined,
        lines: lines.map((l, idx) => ({
          ...l,
          line_number: idx + 1,
          category_id: l.category_id || categoryId,
        })),
      };

      const createdPr = await createMutation.mutateAsync(payload);

      if (shouldSubmitImmediately) {
        await submitMutation.mutateAsync(createdPr.id);
      }

      router.push(`/requisitions/${createdPr.id}`);
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          "Failed to create requisition"
      );
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/requisitions"
            className="text-xs text-blue-600 hover:underline mb-1 inline-block"
          >
            ← Back to Requisitions List
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Purchase Requisition</h1>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 font-bold">✕</button>
        </div>
      )}

      {/* Main Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form Fields */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white border-b pb-2">Requisition Header</h2>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Q3 Office Hardware Refresh"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Description / Purpose
              </label>
              <textarea
                rows={3}
                placeholder="Business justification and requirements..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Procurement Type
                </label>
                <select
                  value={procurementType}
                  onChange={(e) => setProcurementType(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="OPEX">OPEX (Operational)</option>
                  <option value="CAPEX">CAPEX (Capital)</option>
                  <option value="PROJECT">Project</option>
                  <option value="MRO">MRO</option>
                  <option value="SERVICES">Services</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Business Unit *
                </label>
                <select
                  value={businessUnitId}
                  onChange={(e) => {
                    setBusinessUnitId(e.target.value);
                    setCostCenterId("");
                  }}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select Business Unit...</option>
                  {businessUnits.map((bu) => (
                    <option key={bu.id} value={bu.id}>
                      {bu.name} ({bu.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Cost Center *
                </label>
                <select
                  value={costCenterId}
                  onChange={(e) => setCostCenterId(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select Cost Center...</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.name} ({cc.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Category *
              </label>
              <CategoryTreeSelect
                value={categoryId}
                onChange={(val) => setCategoryId(val)}
                placeholder="Select procurement category..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Required By Date
                </label>
                <input
                  type="date"
                  value={requiredByDate}
                  onChange={(e) => setRequiredByDate(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-6 pt-5">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEmergency}
                    onChange={(e) => setIsEmergency(e.target.checked)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span>Emergency PR</span>
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCapex}
                    onChange={(e) => setIsCapex(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Capex Budget</span>
                </label>
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Line Items ({lines.length})</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCatalogModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold rounded-lg transition-colors shadow-xs"
                >
                  <span>🔍 Browse Item Catalog</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPunchoutModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold rounded-lg transition-colors shadow-xs"
                >
                  <span>🌐 PunchOut Store</span>
                </button>
                <PermissionGuard permission="pr.create">
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold rounded-lg transition-colors"
                  >
                    <span>+ Add Item</span>
                  </button>
                </PermissionGuard>
              </div>
            </div>

            <PRLineItemTable
              lines={lines}
              uoms={uoms}
              editable={true}
              currency={currency}
              onLinesChange={(newLines) => setLines(newLines)}
              onRemoveLine={handleRemoveLine}
            />
          </div>
        </div>

        {/* Right 1 Col: Summary & Actions */}
        <div className="space-y-6">
          <BudgetIndicator
            estimatedTotal={estimatedTotal}
            availableBudget={budgetCheck ? Number(budgetCheck.available) : null}
            budgetStatus={budgetCheck ? budgetCheck.status : "NOT_CHECKED"}
            currency={currency}
          />

          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Submission Actions
            </h3>
            {budgetCheck?.status === "BLOCKED" && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                ⚠️ {budgetCheck.message || "Estimated amount exceeds available budget for this cost center."}
              </div>
            )}
            <p className="text-xs text-gray-500">
              Saving as draft allows editing anytime. Submitting routes the PR through automated approval rules.
            </p>

            <PermissionGuard permission="pr.create">
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={createMutation.isPending}
                  className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? "Saving Draft..." : "Save as Draft"}
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={createMutation.isPending || submitMutation.isPending}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit for Approval"}
                </button>
              </div>
            </PermissionGuard>
          </div>
        </div>
      </div>

      {/* Item Catalog Modal */}
      <ItemCatalogModal
        isOpen={catalogModalOpen}
        onClose={() => setCatalogModalOpen(false)}
        onSelectItems={handleCatalogItemsSelected}
        preferredCurrency={currency}
      />

      {/* PunchOut Simulator Modal */}
      <PunchOutModal
        isOpen={punchoutModalOpen}
        onClose={() => setPunchoutModalOpen(false)}
        onTransferCart={handlePunchOutCartTransferred}
        preferredCurrency={currency}
      />
    </div>
  );
}
