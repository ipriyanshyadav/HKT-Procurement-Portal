"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  useUoms,
  useCreateUom,
  useUpdateUom,
  useDeleteUom,
  type UomMaster,
} from "@procurement/hooks";
import { Badge, Button, PermissionGuard } from "@procurement/ui";
import { Scale, Plus, Search, Edit2, Trash2, ArrowLeft } from "lucide-react";

export default function UomManagementPage() {
  const { data: uoms = [], isLoading, error } = useUoms({ active_only: false });
  const createMutation = useCreateUom();
  const updateMutation = useUpdateUom();
  const deleteMutation = useDeleteUom();

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<UomMaster | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isoCode, setIsoCode] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredUoms = useMemo(() => {
    return uoms.filter(
      (u) =>
        u.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.iso_code && u.iso_code.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [uoms, searchTerm]);

  const openCreateModal = () => {
    setEditingItem(null);
    setCode("");
    setName("");
    setIsoCode("");
    setIsActive(true);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (item: UomMaster) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setIsoCode(item.iso_code || "");
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

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          payload: {
            name: name.trim(),
            iso_code: isoCode.trim() || null,
            is_active: isActive,
          },
        });
      } else {
        await createMutation.mutateAsync({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          iso_code: isoCode.trim().toUpperCase() || null,
        });
      }
      setShowModal(false);
    } catch (err: any) {
      setFormError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save Unit of Measure"
      );
    }
  };

  const handleDelete = async (item: UomMaster) => {
    if (!window.confirm(`Are you sure you want to deactivate / delete UOM "${item.code}"?`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(item.id);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || "Failed to delete UOM");
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
            <Scale className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Units of Measure (UOM)
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
            Manage standardized measurement units for catalog items, requisitions, RFQ line items, and purchase orders.
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
              Add UOM
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
            placeholder="Search by code, name, or ISO..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-md border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-gray-500 font-mono">
          Showing {filteredUoms.length} of {uoms.length} records
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mb-2"></div>
            <p>Loading units of measure...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">
            Failed to load units of measure. Please verify the backend connection.
          </div>
        ) : filteredUoms.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-sm font-medium">No units of measure found</p>
            <p className="text-xs text-gray-400 mt-1">Add your first unit of measure to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-neutral-800/60 border-b border-gray-200 dark:border-neutral-800 uppercase text-gray-500 dark:text-neutral-400 font-medium">
                <tr>
                  <th className="px-4 py-3">UOM Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">ISO Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {filteredUoms.map((item) => (
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
                    <td className="px-4 py-3 text-gray-500 dark:text-neutral-400 font-mono">
                      {item.iso_code || "—"}
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
                {editingItem ? "Edit Unit of Measure" : "Create New Unit of Measure"}
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
              <div>
                <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  UOM Code *
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingItem}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. KGS, BOX, EA"
                  className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono uppercase bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white disabled:opacity-60"
                />
                {editingItem && (
                  <p className="text-[10px] text-gray-400 mt-1">UOM Code cannot be changed after creation.</p>
                )}
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
                  placeholder="e.g. Kilograms, Box of 10, Each"
                  className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  ISO Code (Optional)
                </label>
                <input
                  type="text"
                  value={isoCode}
                  onChange={(e) => setIsoCode(e.target.value)}
                  placeholder="e.g. KGM, BX, C62"
                  className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono uppercase bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              {editingItem && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActiveToggle"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isActiveToggle" className="font-medium text-gray-700 dark:text-neutral-300">
                    Active (Available for item master & requisitions)
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
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save UOM"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
