"use client";

import React, { useState, useMemo } from "react";
import {
  useCatalogItems,
  useCategories,
  useUoms,
  ItemMaster,
} from "@procurement/hooks";
import {
  Search,
  X,
  Plus,
  Minus,
  Check,
  Package,
  ShoppingCart,
  ExternalLink,
  Tag,
  Hash,
} from "lucide-react";

export interface SelectedCatalogItem {
  item: ItemMaster;
  quantity: number;
}

export interface ItemCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItems: (
    items: Array<{
      code: string;
      name: string;
      description: string;
      category_id: string;
      uom_id: string;
      price: number;
      currency: string;
      quantity: number;
    }>
  ) => void;
  preferredCurrency?: string;
}

export function ItemCatalogModal({
  isOpen,
  onClose,
  onSelectItems,
  preferredCurrency = "INR",
}: ItemCatalogModalProps) {
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedCart, setSelectedCart] = useState<Record<string, number>>({});

  const { data: categories = [] } = useCategories();
  const { data: uoms = [] } = useUoms();
  const { data: catalogItems = [], isLoading } = useCatalogItems({
    search: search.trim() || undefined,
    category_id: selectedCategoryId || undefined,
    active_only: true,
  });

  const uomMap = useMemo(() => {
    const map = new Map<string, string>();
    uoms.forEach((u) => map.set(u.id, u.name || u.code));
    return map;
  }, [uoms]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  if (!isOpen) return null;

  const handleQuantityChange = (itemId: string, qty: number) => {
    if (qty <= 0) {
      const next = { ...selectedCart };
      delete next[itemId];
      setSelectedCart(next);
    } else {
      setSelectedCart((prev) => ({ ...prev, [itemId]: qty }));
    }
  };

  const selectedCount = Object.keys(selectedCart).length;
  const selectedTotal = Object.entries(selectedCart).reduce((sum, [id, qty]) => {
    const item = catalogItems.find((i) => i.id === id);
    return sum + (item ? Number(item.standard_price) * qty : 0);
  }, 0);

  const handleApplySelection = () => {
    const linesToAdd = Object.entries(selectedCart)
      .map(([id, qty]) => {
        const item = catalogItems.find((i) => i.id === id);
        if (!item) return null;
        return {
          code: item.code,
          name: item.name,
          description: item.description || item.name,
          category_id: item.category_id,
          uom_id: item.uom_id,
          price: Number(item.standard_price),
          currency: item.currency || preferredCurrency,
          quantity: qty,
        };
      })
      .filter(Boolean) as Array<{
      code: string;
      name: string;
      description: string;
      category_id: string;
      uom_id: string;
      price: number;
      currency: string;
      quantity: number;
    }>;

    onSelectItems(linesToAdd);
    setSelectedCart({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Item Master Catalog
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Browse pre-approved catalog goods and standardized company master items
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, item name, HSN, or description..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="sm:w-64">
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Grid / Catalog list */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="py-20 text-center text-slate-400">
              <Package className="w-8 h-8 mx-auto animate-pulse text-indigo-400 mb-2" />
              Loading catalog items...
            </div>
          ) : catalogItems.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Package className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              No catalog items match your search filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalogItems.map((item) => {
                const qty = selectedCart[item.id] || 0;
                const categoryName = categoryMap.get(item.category_id) || "General";
                const uomName = uomMap.get(item.uom_id) || "Unit";

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border transition-all p-4 flex flex-col justify-between ${
                      qty > 0
                        ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10 dark:bg-indigo-950/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/60"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {item.code}
                        </span>
                        {item.is_punchout ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                            <ExternalLink className="w-2.5 h-2.5" />
                            PunchOut
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Stocked
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                        {item.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 min-h-[2rem]">
                        {item.description || "Standard pre-approved enterprise procurement master item."}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Tag className="w-3 h-3 text-slate-400" />
                          {categoryName}
                        </span>
                        {item.hsn_code && (
                          <span className="inline-flex items-center gap-1">
                            <Hash className="w-3 h-3 text-slate-400" />
                            HSN: {item.hsn_code}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] text-slate-400 uppercase tracking-wider">Unit Price</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.currency}{" "}
                          {Number(item.standard_price).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                          <span className="text-xs font-normal text-slate-400"> / {uomName}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, 1)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-lg transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Select</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, qty - 1)}
                              className="p-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded hover:bg-white dark:hover:bg-slate-700 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-slate-900 dark:text-white">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, qty + 1)}
                              className="p-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded hover:bg-white dark:hover:bg-slate-700 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Cart Summary & Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Total: {preferredCurrency}{" "}
                {selectedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={handleApplySelection}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Add to Requisition ({selectedCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
