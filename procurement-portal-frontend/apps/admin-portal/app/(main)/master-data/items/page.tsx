"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  useCatalogItems,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
  useCategories,
  useUoms,
  useCurrencies,
  type ItemMaster,
} from "@procurement/hooks";
import { Badge, Button, PermissionGuard, VirtualTable, type VirtualTableColumn } from "@procurement/ui";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  ArrowLeft,
  Globe,
  Tag,
  Scale,
  Coins,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function ItemMasterManagementPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [activeOnly, setActiveOnly] = useState(false);

  const {
    data: items = [],
    isLoading,
    error,
  } = useCatalogItems({
    search: searchTerm.trim() || undefined,
    category_id: selectedCategory || undefined,
    active_only: activeOnly,
    page_size: 100,
  });

  const { data: categories = [] } = useCategories({ flat: true, active_only: false });
  const { data: uoms = [] } = useUoms({ active_only: false });
  const { data: currencies = [] } = useCurrencies({ active_only: false });

  const createMutation = useCreateCatalogItem();
  const updateMutation = useUpdateCatalogItem();
  const deleteMutation = useDeleteCatalogItem();

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemMaster | null>(null);

  // Form State
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [uomId, setUomId] = useState("");
  const [standardPrice, setStandardPrice] = useState<number | string>(0);
  const [currency, setCurrency] = useState("INR");
  const [hsnCode, setHsnCode] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isPunchout, setIsPunchout] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const uomMap = useMemo(() => {
    const map = new Map<string, string>();
    uoms.forEach((u) => map.set(u.id, u.code));
    return map;
  }, [uoms]);

  const openCreateModal = () => {
    setEditingItem(null);
    setCode("");
    setName("");
    setDescription("");
    setCategoryId(categories[0]?.id || "");
    setUomId(uoms[0]?.id || "");
    setStandardPrice(0);
    setCurrency("INR");
    setHsnCode("");
    setImageUrl("");
    setIsPunchout(false);
    setIsActive(true);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (item: ItemMaster) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setDescription(item.description || "");
    setCategoryId(item.category_id);
    setUomId(item.uom_id);
    setStandardPrice(Number(item.standard_price) || 0);
    setCurrency(item.currency || "INR");
    setHsnCode(item.hsn_code || "");
    setImageUrl(item.image_url || "");
    setIsPunchout(item.is_punchout);
    setIsActive(item.is_active);
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!code.trim() || !name.trim()) {
      setFormError("Item Code and Name are required.");
      return;
    }
    if (!categoryId) {
      setFormError("Category is required.");
      return;
    }
    if (!uomId) {
      setFormError("Unit of Measure is required.");
      return;
    }

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          payload: {
            name: name.trim(),
            description: description.trim() || null,
            category_id: categoryId,
            uom_id: uomId,
            standard_price: Number(standardPrice) || 0,
            currency: currency.trim().toUpperCase(),
            hsn_code: hsnCode.trim() || null,
            image_url: imageUrl.trim() || null,
            is_punchout: isPunchout,
            is_active: isActive,
          },
        });
      } else {
        await createMutation.mutateAsync({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim() || null,
          category_id: categoryId,
          uom_id: uomId,
          standard_price: Number(standardPrice) || 0,
          currency: currency.trim().toUpperCase(),
          hsn_code: hsnCode.trim() || null,
          image_url: imageUrl.trim() || null,
          is_punchout: isPunchout,
        });
      }
      setShowModal(false);
    } catch (err: any) {
      setFormError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save catalog item"
      );
    }
  };

  const handleDelete = async (item: ItemMaster) => {
    if (!window.confirm(`Are you sure you want to deactivate / delete catalog item "${item.code}"?`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(item.id);
    } catch (err: any) {
      alert(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to delete item"
      );
    }
  };

  const activeCount = useMemo(() => items.filter((i) => i.is_active).length, [items]);
  const punchoutCount = useMemo(() => items.filter((i) => i.is_punchout).length, [items]);

  const itemColumns: VirtualTableColumn<ItemMaster>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Code & Name",
        width: "28%",
        render: (item) => (
          <div>
            <div className="font-semibold text-gray-900 dark:text-white">{item.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-[10px] text-gray-400">{item.code}</span>
              {item.description && (
                <span className="text-[11px] text-gray-500 truncate max-w-xs">— {item.description}</span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "category_id",
        header: "Category",
        width: "14%",
        render: (item) => (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
            <Tag className="w-3 h-3" />
            {categoryMap.get(item.category_id) || "Uncategorized"}
          </span>
        ),
      },
      {
        key: "standard_price",
        header: "Standard Price",
        width: "14%",
        render: (item) => (
          <span className="font-semibold text-gray-900 dark:text-white">
            {item.currency} {Number(item.standard_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        ),
      },
      {
        key: "uom_id",
        header: "UOM",
        width: "8%",
        render: (item) => (
          <span className="font-mono text-[11px] px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-800 rounded text-gray-700 dark:text-neutral-300">
            {uomMap.get(item.uom_id) || "EA"}
          </span>
        ),
      },
      {
        key: "hsn_code",
        header: "HSN Code",
        width: "10%",
        render: (item) => (
          <span className="font-mono text-[11px] text-gray-500">{item.hsn_code || "—"}</span>
        ),
      },
      {
        key: "is_punchout",
        header: "Type",
        width: "10%",
        render: (item) =>
          item.is_punchout ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-medium text-[11px]">
              <Globe className="w-3 h-3" />
              PunchOut
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium text-[11px]">
              <Package className="w-3 h-3" />
              Standard
            </span>
          ),
      },
      {
        key: "is_active",
        header: "Status",
        width: "8%",
        render: (item) =>
          item.is_active ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-gray-400 font-medium">
              <XCircle className="w-3.5 h-3.5" />
              Inactive
            </span>
          ),
      },
      {
        key: "actions",
        header: "Actions",
        width: "8%",
        headerClassName: "text-right",
        className: "text-right",
        render: (item) => (
          <div className="flex items-center justify-end gap-1">
            <PermissionGuard permission="master.update">
              <button
                type="button"
                onClick={() => openEditModal(item)}
                className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                title="Edit Item"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </PermissionGuard>
            <PermissionGuard permission="master.delete">
              <button
                type="button"
                onClick={() => handleDelete(item)}
                className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                title="Delete Item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </PermissionGuard>
          </div>
        ),
      },
    ],
    [categoryMap, uomMap]
  );

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
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Package className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Item Master Catalog
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Enterprise procurement goods & services catalog, benchmark prices, UNSPSC classifications, and PunchOut integrations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PermissionGuard permission="master.create">
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={openCreateModal}
            >
              New Catalog Item
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-xs">
          <div className="text-xs text-gray-500 dark:text-neutral-400">Total Items</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{items.length}</div>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-xs">
          <div className="text-xs text-gray-500 dark:text-neutral-400">Active Items</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{activeCount}</div>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-xs">
          <div className="text-xs text-gray-500 dark:text-neutral-400">PunchOut Stores</div>
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">{punchoutCount}</div>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-xs">
          <div className="text-xs text-gray-500 dark:text-neutral-400">Categories Linked</div>
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">{categories.length}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code, item name, HSN code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 dark:bg-neutral-800/80 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs border border-gray-200 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setActiveOnly(!activeOnly)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              activeOnly
                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                : "bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 border-gray-200 dark:border-neutral-700"
            }`}
          >
            {activeOnly ? "Active Only" : "All Statuses"}
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-neutral-400 animate-pulse">
            Loading catalog items from database...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-500">
            Failed to load catalog items. Please check gateway connectivity.
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-gray-300 dark:text-neutral-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">No Catalog Items Found</h3>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
              {searchTerm ? "Try modifying your search or category filters." : "Create your first catalog item or seed catalog data."}
            </p>
          </div>
        ) : (
          <VirtualTable<ItemMaster>
            data={items}
            columns={itemColumns}
            estimateRowHeight={58}
            maxHeight="620px"
          />
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="relative w-full max-w-xl bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingItem ? `Edit Item: ${editingItem.code}` : "Add New Catalog Item"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-600 dark:text-rose-400">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-1">
                    Item Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingItem}
                    placeholder="e.g. IT-LAP-001"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full text-xs font-mono border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white uppercase disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-1">
                    Item Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Developer Laptop 16-inch"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Detailed specifications, brand, model, or capabilities..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full text-xs border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  >
                    <option value="" disabled>Select category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-1">
                    Unit of Measure (UOM) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={uomId}
                    onChange={(e) => setUomId(e.target.value)}
                    className="w-full text-xs border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  >
                    <option value="" disabled>Select UOM...</option>
                    {uoms.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} — {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-1">
                    Standard Price <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={standardPrice}
                    onChange={(e) => setStandardPrice(e.target.value)}
                    className="w-full text-xs font-semibold border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full text-xs border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  >
                    {currencies.length > 0 ? (
                      currencies.map((curr) => (
                        <option key={curr.id} value={curr.code}>
                          {curr.code} ({curr.symbol || curr.code})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-1">
                    HSN / SAC Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 84713010"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    className="w-full text-xs font-mono border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-1">
                  Product Image URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full text-xs border border-gray-300 dark:border-neutral-700 rounded-lg p-2.5 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPunchout}
                    onChange={(e) => setIsPunchout(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 border-gray-300 focus:ring-purple-500"
                  />
                  <span>PunchOut Catalog Gateway Item</span>
                </label>

                {editingItem && (
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 border-gray-300 focus:ring-emerald-500"
                    />
                    <span>Active for Requisitions</span>
                  </label>
                )}
              </div>

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
                  {editingItem ? "Update Item" : "Create Item"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
