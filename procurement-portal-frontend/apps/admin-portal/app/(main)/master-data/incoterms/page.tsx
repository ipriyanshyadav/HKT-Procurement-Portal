"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  useIncoterms,
  useCreateIncoterm,
  useUpdateIncoterm,
  useDeleteIncoterm,
  type Incoterm,
} from "@procurement/hooks";
import { Badge, Button, PermissionGuard } from "@procurement/ui";
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  ArrowLeft,
  ShieldCheck,
  Globe2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function IncotermsManagementPage() {
  const [activeOnly, setActiveOnly] = useState(false);
  const { data: incoterms = [], isLoading, error } = useIncoterms({ active_only: activeOnly });

  const createMutation = useCreateIncoterm();
  const updateMutation = useUpdateIncoterm();
  const deleteMutation = useDeleteIncoterm();

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Incoterm | null>(null);

  // Form State
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [editionYear, setEditionYear] = useState(2020);
  const [riskTransferPoint, setRiskTransferPoint] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredIncoterms = useMemo(() => {
    return incoterms.filter(
      (it) =>
        it.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        it.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (it.risk_transfer_point && it.risk_transfer_point.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [incoterms, searchTerm]);

  const openCreateModal = () => {
    setEditingItem(null);
    setCode("");
    setName("");
    setEditionYear(2020);
    setRiskTransferPoint("");
    setIsActive(true);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (item: Incoterm) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setEditionYear(item.edition_year || 2020);
    setRiskTransferPoint(item.risk_transfer_point || "");
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
    if (!riskTransferPoint.trim()) {
      setFormError("Risk transfer point description is required.");
      return;
    }

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          payload: {
            name: name.trim(),
            edition_year: Number(editionYear) || 2020,
            risk_transfer_point: riskTransferPoint.trim(),
            is_active: isActive,
          },
        });
      } else {
        await createMutation.mutateAsync({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          edition_year: Number(editionYear) || 2020,
          risk_transfer_point: riskTransferPoint.trim(),
        });
      }
      setShowModal(false);
    } catch (err: any) {
      setFormError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save Incoterm"
      );
    }
  };

  const handleDelete = async (item: Incoterm) => {
    if (!window.confirm(`Are you sure you want to deactivate / delete Incoterm "${item.code}"?`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(item.id);
    } catch (err: any) {
      alert(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to delete Incoterm"
      );
    }
  };

  const activeCount = useMemo(() => incoterms.filter((i) => i.is_active).length, [incoterms]);

  return (
    <div className="w-full space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-neutral-800 pb-4">
        <div>
          <Link
            href="/master-data"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Master Data Hub
          </Link>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Truck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Incoterms 2020 Standard
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Standardized commercial trade terms published by ICC defining freight, customs clearance, insurance, and risk division points.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PermissionGuard permission="master.create">
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={openCreateModal}
            >
              New Incoterm
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-xs">
          <div className="text-xs text-gray-500 dark:text-neutral-400">Total Configured Codes</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{incoterms.length}</div>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-xs">
          <div className="text-xs text-gray-500 dark:text-neutral-400">Active for RFQs & Bids</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{activeCount}</div>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-xs">
          <div className="text-xs text-gray-500 dark:text-neutral-400">International Reference Edition</div>
          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">ICC Incoterms® 2020</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by 3-letter code, term name, or risk point..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 dark:bg-neutral-800/80 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={() => setActiveOnly(!activeOnly)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
            activeOnly
              ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
              : "bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 border-gray-200 dark:border-neutral-700"
          }`}
        >
          {activeOnly ? "Active Only" : "All Statuses"}
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-neutral-400 animate-pulse">
            Loading Incoterms from database...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-500">
            Failed to load Incoterms. Please check gateway connectivity.
          </div>
        ) : filteredIncoterms.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-10 h-10 text-gray-300 dark:text-neutral-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">No Incoterms Found</h3>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
              {searchTerm ? "No codes match your search query." : "Initialize master data to load standard Incoterms 2020."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600 dark:text-neutral-300">
              <thead className="bg-gray-50/80 dark:bg-neutral-800/80 uppercase tracking-wider text-[11px] font-semibold text-gray-500 dark:text-neutral-400 border-b border-gray-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Full Term Name</th>
                  <th className="px-4 py-3">Edition</th>
                  <th className="px-4 py-3">Risk Transfer Point</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {filteredIncoterms.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                        {item.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-500">
                      {item.edition_year}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-600 dark:text-neutral-300 max-w-md">
                      {item.risk_transfer_point || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {item.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-400 font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <PermissionGuard permission="master.update">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                            title="Edit Incoterm"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </PermissionGuard>
                        <PermissionGuard permission="master.delete">
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                            title="Delete Incoterm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingItem ? `Edit Incoterm: ${editingItem.code}` : "Add New Incoterm"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-600 dark:text-rose-400">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-1">
                    Incoterm Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    disabled={!!editingItem}
                    placeholder="e.g. DDP, FOB, CIF"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full text-xs font-mono border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white uppercase disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-1">
                    Edition Year <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1900}
                    max={2100}
                    value={editionYear}
                    onChange={(e) => setEditionYear(Number(e.target.value))}
                    className="w-full text-xs border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-1">
                  Term Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Delivered Duty Paid"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-1">
                  Risk Transfer Point <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Where risk transfers from seller to buyer (e.g. When goods are placed at disposal of buyer at named destination)..."
                  value={riskTransferPoint}
                  onChange={(e) => setRiskTransferPoint(e.target.value)}
                  className="w-full text-xs border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              {editingItem && (
                <div className="pt-1">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 border-gray-300 focus:ring-emerald-500"
                    />
                    <span>Active for Procurement Transactions</span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-neutral-800">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={createMutation.isPending || updateMutation.isPending}
                >
                  {editingItem ? "Update Incoterm" : "Create Incoterm"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
