"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  usePaymentTerms,
  useCreatePaymentTerm,
  useUpdatePaymentTerm,
  useDeletePaymentTerm,
  type PaymentTerm,
} from "@procurement/hooks";
import { Badge, Button, PermissionGuard } from "@procurement/ui";
import { CreditCard, Plus, Search, Edit2, Trash2, ArrowLeft } from "lucide-react";

export default function PaymentTermsManagementPage() {
  const { data: paymentTerms = [], isLoading, error } = usePaymentTerms({ active_only: false });
  const createMutation = useCreatePaymentTerm();
  const updateMutation = useUpdatePaymentTerm();
  const deleteMutation = useDeletePaymentTerm();

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentTerm | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [netDays, setNetDays] = useState("30");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [discountDays, setDiscountDays] = useState("0");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredTerms = useMemo(() => {
    return paymentTerms.filter(
      (t) =>
        t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [paymentTerms, searchTerm]);

  const openCreateModal = () => {
    setEditingItem(null);
    setCode("");
    setName("");
    setNetDays("30");
    setDiscountPercent("0");
    setDiscountDays("0");
    setDescription("");
    setIsActive(true);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (item: PaymentTerm) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setNetDays(String(item.net_days));
    setDiscountPercent(String(item.discount_percentage));
    setDiscountDays(String(item.discount_days));
    setDescription(item.description || "");
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

    const netDaysNum = parseInt(netDays, 10);
    const discountPercentNum = parseFloat(discountPercent) || 0;
    const discountDaysNum = parseInt(discountDays, 10) || 0;

    if (isNaN(netDaysNum) || netDaysNum < 0) {
      setFormError("Net days must be a non-negative integer.");
      return;
    }

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          payload: {
            name: name.trim(),
            net_days: netDaysNum,
            discount_percentage: discountPercentNum,
            discount_days: discountDaysNum,
            description: description.trim() || null,
            is_active: isActive,
          },
        });
      } else {
        await createMutation.mutateAsync({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          net_days: netDaysNum,
          discount_percentage: discountPercentNum,
          discount_days: discountDaysNum,
          description: description.trim() || null,
        });
      }
      setShowModal(false);
    } catch (err: any) {
      setFormError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save Payment Term"
      );
    }
  };

  const handleDelete = async (item: PaymentTerm) => {
    if (!window.confirm(`Are you sure you want to deactivate payment term "${item.code}"?`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(item.id);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || "Failed to delete Payment Term");
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
            <CreditCard className="w-6 h-6 text-purple-600" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Payment Terms & Credit Rules
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
            Define credit intervals, net due dates, and early payment cash discount rules for Purchase Orders and Invoices.
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
              Add Payment Term
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-3 rounded-lg border border-gray-200 dark:border-neutral-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code, name, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-md border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-gray-500 font-mono">
          Showing {filteredTerms.length} of {paymentTerms.length} records
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mb-2"></div>
            <p>Loading payment terms...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">
            Failed to load payment terms. Please verify the backend connection.
          </div>
        ) : filteredTerms.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-sm font-medium">No payment terms found</p>
            <p className="text-xs text-gray-400 mt-1">Add your standard settlement terms (e.g. Net 30).</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-neutral-800/60 border-b border-gray-200 dark:border-neutral-800 uppercase text-gray-500 dark:text-neutral-400 font-medium">
                <tr>
                  <th className="px-4 py-3">Term Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Net Days</th>
                  <th className="px-4 py-3">Early Cash Discount</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {filteredTerms.map((item) => (
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
                    <td className="px-4 py-3 font-mono text-gray-700 dark:text-neutral-300">
                      {item.net_days} days
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600 dark:text-neutral-400">
                      {Number(item.discount_percentage) > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {item.discount_percentage}% in {item.discount_days}d
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-neutral-400 max-w-xs truncate">
                      {item.description || "—"}
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
                {editingItem ? "Edit Payment Term" : "Create New Payment Term"}
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
                    Term Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingItem}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. NET30, 2/10NET30"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono uppercase bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Net Days Due *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={netDays}
                    onChange={(e) => setNetDays(e.target.value)}
                    placeholder="e.g. 30"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Net 30 Days"
                  className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-neutral-800/60 rounded-md border border-gray-200 dark:border-neutral-700">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Discount % (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    placeholder="e.g. 2.0"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Discount Days (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={discountDays}
                    onChange={(e) => setDiscountDays(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Standard payment terms for suppliers..."
                  className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white resize-none"
                />
              </div>

              {editingItem && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActivePaymentTerm"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isActivePaymentTerm" className="font-medium text-gray-700 dark:text-neutral-300">
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
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Payment Term"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
