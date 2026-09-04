"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  useCategoryTree,
  useCreateCategory,
  useDeleteCategory,
  type CategoryTreeNode,
} from "@procurement/hooks";
import { CategoryTreeSelect, PermissionGuard, Badge, Button } from "@procurement/ui";
import { ArrowRight, Trash2 } from "lucide-react";

export default function CategoriesPage() {
  const { data: categories = [], isLoading, error, refetch } = useCategoryTree();
  const createMutation = useCreateCategory();
  const deleteMutation = useDeleteCategory();

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [newUnspsc, setNewUnspsc] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    const traverse = (nodes: CategoryTreeNode[]) => {
      for (const node of nodes) {
        all[node.id] = true;
        if (node.children) traverse(node.children);
      }
    };
    traverse(categories);
    setExpandedIds(all);
  };

  const collapseAll = () => {
    setExpandedIds({});
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newCode.trim() || !newName.trim()) {
      setFormError("Code and Name are required.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        code: newCode.trim().toUpperCase(),
        name: newName.trim(),
        parent_id: newParentId || null,
        unspsc_code: newUnspsc.trim() || null,
      });
      setShowCreateModal(false);
      setNewCode("");
      setNewName("");
      setNewParentId(null);
      setNewUnspsc("");
      refetch();
    } catch (err: any) {
      setFormError(err?.response?.data?.error?.message || err?.message || "Failed to create category");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || "Failed to delete category");
    }
  };

  const renderCategoryNode = (node: CategoryTreeNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds[node.id];

    return (
      <div key={node.id} className="border-b border-gray-100 last:border-b-0">
        <div
          style={{ paddingLeft: `${depth * 24 + 16}px` }}
          className="flex items-center justify-between py-3 pr-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpand(node.id)}
                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 text-xs rounded border border-gray-200"
              >
                {isExpanded ? "▼" : "▶"}
              </button>
            ) : (
              <span className="w-5" />
            )}

            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 font-mono">
              L{node.level}
            </span>

            <div>
              <Link
                href={`/master-data/categories/${node.id}`}
                className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
              >
                {node.name}
              </Link>
              <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                <span>Code: {node.code}</span>
                {node.unspsc_code && <span>· UNSPSC: {node.unspsc_code}</span>}
                <span>· Path: {node.path}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={node.is_active ? "approved" : "draft"}>
              {node.is_active ? "ACTIVE" : "INACTIVE"}
            </Badge>

            <div className="flex items-center justify-end gap-2">
              <Link href={`/master-data/categories/${node.id}`}>
                <Button variant="secondary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                  View
                </Button>
              </Link>

              <PermissionGuard permission="master.delete">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => handleDelete(node.id, node.name)}
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  className="text-red-600 hover:text-red-700"
                >
                  Delete
                </Button>
              </PermissionGuard>
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => renderCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Category Hierarchy</h1>
          <p className="text-sm text-gray-500">
            5-level organisational category tree for sourcing, requisitioning, and spend management.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-sm"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-sm"
          >
            Collapse All
          </button>
          <PermissionGuard permission="master.create">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm"
            >
              + Add Category
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* Tree Content Card */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
            <p>Loading category hierarchy...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">
            Failed to load categories. Please ensure the backend is running.
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-base font-medium">No categories found</p>
            <p className="text-xs text-gray-400 mt-1">Get started by creating your root categories.</p>
            <PermissionGuard permission="master.create">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Add First Category
              </button>
            </PermissionGuard>
          </div>
        ) : (
          <div>
            {categories.map((node) => renderCategoryNode(node))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">Create New Category</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Parent Category (Optional - leave empty for Root L1)
                </label>
                <CategoryTreeSelect
                  categories={categories}
                  value={newParentId || ""}
                  onChange={(id) => setNewParentId(id || null)}
                  placeholder="Select Parent Category (or root)..."
                  maxLevel={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Category Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="e.g. IT-HARDWARE"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    UNSPSC Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={newUnspsc}
                    onChange={(e) => setNewUnspsc(e.target.value)}
                    placeholder="e.g. 43211500"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. IT Hardware & Equipment"
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? "Creating..." : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
