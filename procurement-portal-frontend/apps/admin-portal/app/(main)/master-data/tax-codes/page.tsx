"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  useTaxCodes,
  useCreateTaxCode,
  useUpdateTaxCode,
  useDeleteTaxCode,
  type TaxCode,
} from "@procurement/hooks";
import { Badge, Button, PermissionGuard } from "@procurement/ui";
import { Percent, Plus, Search, Edit2, Trash2, ArrowLeft } from "lucide-react";

const TAX_TYPES = ["ALL", "GST", "TDS", "CESS", "CUSTOMS", "OTHER"] as const;

export default function TaxCodesManagementPage() {
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const { data: taxCodes = [], isLoading, error } = useTaxCodes({
    tax_type: selectedType === "ALL" ? undefined : selectedType,
    active_only: false,
  });

  const createMutation = useCreateTaxCode();
  const updateMutation = useUpdateTaxCode();
  const deleteMutation = useDeleteTaxCode();

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TaxCode | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [rate, setRate] = useState("18.00");
  const [taxType, setTaxType] = useState("GST");
  const [hsnChapter, setHsnChapter] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredTaxCodes = useMemo(() => {
    return taxCodes.filter(
      (t) =>
        t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.hsn_chapter && t.hsn_chapter.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [taxCodes, searchTerm]);

  const openCreateModal = () => {
    setEditingItem(null);
    setCode("");
    setName("");
    setRate("18.00");
    setTaxType(selectedType === "ALL" ? "GST" : selectedType);
    setHsnChapter("");
    setIsActive(true);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (item: TaxCode) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setRate(String(item.rate));
    setTaxType(item.tax_type);
    setHsnChapter(item.hsn_chapter || "");
    setIsActive(item.is_active);
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!code.trim() || !name.trim()) {
      setFormError("Code and Name are required.");
      return;
    }

    const rateNum = parseFloat(rate);
    if (isNaN(rateNum) || rateNum < 0) {
      setFormError("Tax rate must be a non-negative number.");
      return;
    }

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          payload: {
            name: name.trim(),
            rate: rateNum,
            tax_type: taxType,
            hsn_chapter: hsnChapter.trim() || null,
            is_active: isActive,
          },
        });
      } else {
        await createMutation.mutateAsync({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          rate: rateNum,
          tax_type: taxType,
          hsn_chapter: hsnChapter.trim() || null,
        });
      }
      setShowModal(false);
    } catch (err: any) {
      setFormError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save Tax Code"
      );
    }
  };

  const handleDelete = async (item: TaxCode) => {
    if (!window.confirm(`Are you sure you want to deactivate tax code "${item.code}"?`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(item.id);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || "Failed to delete Tax Code");
    }
  };

  const getTaxTypeBadge = (type: string) => {
    switch (type.toUpperCase()) {
      case "GST":
        return <Badge variant="approved">GST</Badge>;
      case "TDS":
        return <Badge variant="pending">TDS</Badge>;
      case "CESS":
        return <Badge variant="warning">CESS</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Navigation Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/master-data"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Master Data Hub
          </Link>
          <div className="flex items-center gap-2">
            <Percent className="w-6 h-6 text-rose-600" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Tax Codes & Rates
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
            Maintain statutory GST rates, withholding tax (TDS), CESS surcharges, and HSN/SAC chapter classifications.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PermissionGuard permission="master.create">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={openCreateModal}
            >
              Add Tax Code
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Tax Type Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-gray-200 dark:border-neutral-800">
        {TAX_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setSelectedType(type)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              selectedType === type
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
            }`}
          >
            {type === "ALL" ? "All Tax Types" : type}
          </button>
        ))}
      </div>

      {/* Search and Counts */}
      <div className="flex items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-3 rounded-lg border border-gray-200 dark:border-neutral-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code, name, or HSN chapter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-md border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-gray-500 font-mono">
          Showing {filteredTaxCodes.length} of {taxCodes.length} codes
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-rose-600 mb-2"></div>
            <p>Loading tax codes...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">
            Failed to load tax codes. Please verify backend connection.
          </div>
        ) : filteredTaxCodes.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-sm font-medium">No tax codes found</p>
            <p className="text-xs text-gray-400 mt-1">Add GST or TDS rates for order calculation.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-neutral-800/60 border-b border-gray-200 dark:border-neutral-800 uppercase text-gray-500 dark:text-neutral-400 font-medium">
                <tr>
                  <th className="px-4 py-3">Tax Code</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">HSN Chapter</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {filteredTaxCodes.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white font-mono">
                      {item.code}
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-neutral-200 font-medium">
                      {item.name}
                    </td>
                    <td className="px-4 py-3">
                      {getTaxTypeBadge(item.tax_type)}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-900 dark:text-white">
                      {Number(item.rate).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-neutral-400 font-mono">
                      {item.hsn_chapter || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={item.is_active ? "approved" : "draft"}>
                        {item.is_active ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <PermissionGuard permission="master.update">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Edit2 className="w-3.5 h-3.5" />}
                            onClick={() => openEditModal(item)}
                          >
                            Edit
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="master.delete">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() => handleDelete(item)}
                          >
                            Delete
                          </Button>
                        </PermissionGuard>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 border border-gray-200 dark:border-neutral-800">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 pb-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {editingItem ? "Edit Tax Code" : "Create New Tax Code"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-md">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Tax Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingItem}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. GST18, TDS194C"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono uppercase bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Tax Type *
                  </label>
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value)}
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                  >
                    <option value="GST">GST (Goods & Services)</option>
                    <option value="TDS">TDS (Tax Deducted at Source)</option>
                    <option value="CESS">CESS (Compensation/Surcharge)</option>
                    <option value="CUSTOMS">Customs Duty</option>
                    <option value="OTHER">Other / Regional</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  Tax Name / Description *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. GST Standard Rate 18%"
                  className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Rate (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="e.g. 18.00"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    HSN Chapter (Optional)
                  </label>
                  <input
                    type="text"
                    value={hsnChapter}
                    onChange={(e) => setHsnChapter(e.target.value)}
                    placeholder="e.g. 84, 85, 99"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono uppercase bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {editingItem && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActiveTax"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isActiveTax" className="font-medium text-gray-700 dark:text-neutral-300">
                    Active
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-neutral-800">
                <Button variant="secondary" size="sm" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Tax Code"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
