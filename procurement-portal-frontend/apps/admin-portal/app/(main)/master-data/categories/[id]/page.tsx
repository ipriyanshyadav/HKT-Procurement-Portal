"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCategoryTree,
  useUpdateCategory,
  useDeleteCategory,
  type CategoryTreeNode,
} from "@procurement/hooks";

function findNodeAndAncestors(
  nodes: CategoryTreeNode[],
  targetId: string,
  ancestors: CategoryTreeNode[] = [],
): { node: CategoryTreeNode | null; path: CategoryTreeNode[] } {
  for (const node of nodes) {
    if (node.id === targetId) {
      return { node, path: [...ancestors, node] };
    }
    if (node.children && node.children.length > 0) {
      const res = findNodeAndAncestors(node.children, targetId, [...ancestors, node]);
      if (res.node) return res;
    }
  }
  return { node: null, path: [] };
}

export default function CategoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const categoryId = params.id as string;

  const { data: tree = [], isLoading, error, refetch } = useCategoryTree();
  const updateMutation = useUpdateCategory(categoryId);
  const deleteMutation = useDeleteCategory();

  const { node: category, path: breadcrumbPath } = useMemo(() => {
    return findNodeAndAncestors(tree, categoryId);
  }, [tree, categoryId]);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [unspsc, setUnspsc] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  React.useEffect(() => {
    if (category) {
      setName(category.name);
      setUnspsc(category.unspsc_code || "");
      setIsActive(category.is_active);
    }
  }, [category]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await updateMutation.mutateAsync({
        name: name.trim(),
        unspsc_code: unspsc.trim() || null,
        is_active: isActive,
      });
      setIsEditing(false);
      refetch();
    } catch (err: any) {
      setFormError(err?.response?.data?.error?.message || err?.message || "Failed to update category");
    }
  };

  const handleDelete = async () => {
    if (!category) return;
    if (!window.confirm(`Are you sure you want to delete "${category.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(category.id);
      router.push("/master-data/categories");
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || "Failed to delete category");
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-gray-500">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
        <p>Loading category details...</p>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="p-8 bg-white border border-gray-200 rounded-lg text-center space-y-4">
        <p className="text-red-600">Category not found or failed to load.</p>
        <Link
          href="/master-data/categories"
          className="inline-block px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md"
        >
          Back to Categories
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <Link
          href="/master-data/categories"
          className="text-xs text-blue-600 hover:underline mb-2 inline-flex items-center gap-1 font-medium"
        >
          ← Back to Categories List
        </Link>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-gray-500 font-medium mt-1">
          <Link href="/master-data/categories" className="hover:text-blue-600">
            Categories
          </Link>
        {breadcrumbPath.map((item, index) => (
          <React.Fragment key={item.id}>
            <span>/</span>
            {index === breadcrumbPath.length - 1 ? (
              <span className="text-gray-900 font-semibold">{item.name}</span>
            ) : (
              <Link href={`/master-data/categories/${item.id}`} className="hover:text-blue-600">
                {item.name}
              </Link>
            )}
          </React.Fragment>
        ))}
        </nav>
      </div>

      {/* Detail Card */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-sm font-semibold bg-blue-100 text-blue-800 font-mono">
              Level {category.level}
            </span>
            <h1 className="text-xl font-bold text-gray-900">{category.name}</h1>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                category.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
              }`}
            >
              {category.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Edit Details
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50"
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
            {formError}
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleUpdate} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Category Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                UNSPSC Code
              </label>
              <input
                type="text"
                value={unspsc}
                onChange={(e) => setUnspsc(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">
                Is Active
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-xs text-gray-400 font-medium">Category Code</p>
              <p className="mt-1 font-mono font-semibold text-gray-900">{category.code}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">UNSPSC Code</p>
              <p className="mt-1 font-mono text-gray-700">{category.unspsc_code || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Hierarchy Path</p>
              <p className="mt-1 font-mono text-xs text-gray-700">{category.path}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Direct Sub-Categories</p>
              <p className="mt-1 font-semibold text-gray-900">{category.children?.length || 0}</p>
            </div>
          </div>
        )}
      </div>

      {/* Sub-categories Section */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 className="text-base font-semibold text-gray-900">
            Sub-Categories ({category.children?.length || 0})
          </h2>
        </div>

        {!category.children || category.children.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">
            This category has no sub-categories (it is a leaf node).
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {category.children.map((sub) => (
              <div key={sub.id} className="py-3 flex items-center justify-between">
                <div>
                  <Link
                    href={`/master-data/categories/${sub.id}`}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600"
                  >
                    {sub.name}
                  </Link>
                  <p className="text-xs text-gray-400 font-mono">
                    Code: {sub.code} · Level: L{sub.level}
                  </p>
                </div>
                <Link
                  href={`/master-data/categories/${sub.id}`}
                  className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  View Details →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
