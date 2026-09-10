"use client";

import React, { useState } from "react";
import {
  Search,
  ShoppingCart,
  ExternalLink,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Tag,
  Clock,
  Building2,
  X,
  FileText,
  Percent,
} from "lucide-react";
import {
  useAddToCart,
  useCartCheckout,
  useCatalogSearch,
  useLaunchPunchout,
  usePunchoutConfigs,
  useRemoveFromCart,
  useUpdateCartQuantity,
  useUserCart,
} from "@procurement/hooks";
import type { CatalogItem, PunchoutConfig } from "@procurement/types";

export function CatalogMarketplace() {
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [contractOnly, setContractOnly] = useState(false);
  const [page, setPage] = useState(1);

  // Cart Drawer & Checkout Modal States
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutTitle, setCheckoutTitle] = useState("Enterprise IT & Supplies Order");
  const [checkoutNotes, setCheckoutNotes] = useState("Automated requisition generated from catalog cart.");
  const [checkoutSuccess, setCheckoutSuccess] = useState<{ pr_number: string; total_value: number; pr_id: string } | null>(null);

  // PunchOut Modal State
  const [selectedPunchout, setSelectedPunchout] = useState<PunchoutConfig | null>(null);
  const [punchoutLaunching, setPunchoutLaunching] = useState(false);
  const [punchoutLaunchSuccess, setPunchoutLaunchSuccess] = useState<string | null>(null);

  // Item quantity selection buffer
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});

  // Queries
  const { data: searchData, isLoading: loadingCatalog } = useCatalogSearch({
    query: searchQuery || undefined,
    brand: selectedBrand || undefined,
    contract_only: contractOnly || undefined,
    page,
    page_size: 12,
  });

  const { data: userCart, isLoading: loadingCart } = useUserCart();
  const { data: punchoutConfigs = [] } = usePunchoutConfigs();

  // Mutations
  const addToCartMutation = useAddToCart();
  const updateQtyMutation = useUpdateCartQuantity();
  const removeItemMutation = useRemoveFromCart();
  const checkoutMutation = useCartCheckout();
  const launchPunchoutMutation = useLaunchPunchout();

  const handleQtyChange = (itemId: string, delta: number) => {
    setItemQuantities((prev) => {
      const current = prev[itemId] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [itemId]: next };
    });
  };

  const handleAddToCart = async (item: CatalogItem) => {
    const qty = itemQuantities[item.id] || 1;
    await addToCartMutation.mutateAsync({
      item_id: item.id,
      item_code: item.code,
      item_name: item.name,
      quantity: qty,
      unit_price: item.standard_price,
      currency: item.currency,
    });
  };

  const handleCheckout = async () => {
    try {
      const res = await checkoutMutation.mutateAsync({
        title: checkoutTitle,
        notes: checkoutNotes,
      });
      setCheckoutSuccess({
        pr_number: res.pr_number,
        total_value: res.total_value,
        pr_id: res.pr_id,
      });
      setCheckoutModalOpen(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleLaunchPunchout = async () => {
    if (!selectedPunchout) return;
    setPunchoutLaunching(true);
    try {
      const res = await launchPunchoutMutation.mutateAsync({
        config_id: selectedPunchout.id,
        return_url: window.location.origin + "/marketplace",
      });
      setPunchoutLaunchSuccess(
        `PunchOut session initialized (${res.protocol} 1.2). Handoff token: ${res.session_token.slice(0, 12)}... Simulated redirect prepared.`
      );
    } finally {
      setPunchoutLaunching(false);
    }
  };

  const cartItemsCount = userCart?.total_items || 0;
  const cartSubtotal = userCart?.subtotal || 0;

  return (
    <div className="min-h-screen bg-[#0E0E10] text-[#E4E4E7] p-6 lg:p-8">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#27272A]">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Catalog & PunchOut Marketplace
              </h1>
              <p className="text-sm text-[#A1A1AA]">
                Hosted parametric catalog, pre-negotiated tier pricing, and cXML/OCI PunchOut marketplaces
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#1C1C1F] hover:bg-[#252529] border border-[#2E2E32] text-white font-medium transition-all shadow-sm"
          >
            <ShoppingCart className="w-4 h-4 text-blue-400" />
            <span>Cart</span>
            {cartItemsCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-600 text-white">
                {cartItemsCount}
              </span>
            )}
            <span className="text-xs text-[#A1A1AA] border-l border-[#3F3F46] pl-2">
              ₹{cartSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </button>
        </div>
      </div>

      {/* Checkout Success Banner */}
      {checkoutSuccess && (
        <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">
                Purchase Requisition Created: {checkoutSuccess.pr_number}
              </p>
              <p className="text-xs text-emerald-400/80">
                Total Value: ₹{checkoutSuccess.total_value.toLocaleString("en-IN")} • Status: DRAFT • Ready for routing
              </p>
            </div>
          </div>
          <button
            onClick={() => setCheckoutSuccess(null)}
            className="text-xs text-emerald-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* External PunchOut Marketplaces Strip */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#A1A1AA] flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-purple-400" />
            External PunchOut Marketplaces (cXML 1.2 & OCI 4.0)
          </h2>
          <span className="text-xs text-[#71717A]">Auto-cart extraction into Requisition Lines</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {punchoutConfigs.map((po) => (
            <div
              key={po.id}
              className="p-4 rounded-xl bg-[#141416] border border-[#27272A] hover:border-purple-500/40 transition-all flex items-center justify-between group"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors">
                    {po.supplier_name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono border border-purple-500/20">
                    {po.protocol}
                  </span>
                </div>
                <p className="text-xs text-[#71717A] truncate max-w-[200px]">
                  ID: {po.sender_identity}
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedPunchout(po);
                  setPunchoutLaunchSuccess(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F1F23] hover:bg-purple-600/20 hover:text-purple-300 border border-[#333338] text-xs font-medium transition-all"
              >
                <span>Launch</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Filters */}
        <div className="space-y-6">
          {/* Search Box */}
          <div className="p-4 rounded-xl bg-[#141416] border border-[#27272A] space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
              Search Filters
            </h3>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#71717A]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search items, SKU, specs..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-sm text-white placeholder-[#71717A] focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Contract Only Toggle */}
            <label className="flex items-center gap-2 pt-2 cursor-pointer text-xs text-[#A1A1AA] hover:text-white">
              <input
                type="checkbox"
                checked={contractOnly}
                onChange={(e) => setContractOnly(e.target.checked)}
                className="rounded bg-[#1F1F23] border-[#333338] text-blue-500 focus:ring-0"
              />
              <span>Contract Tier Pricing Only</span>
            </label>
          </div>

          {/* Brands Facet */}
          {searchData?.facets?.brands && searchData.facets.brands.length > 0 && (
            <div className="p-4 rounded-xl bg-[#141416] border border-[#27272A] space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-400" />
                Brands
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                <button
                  onClick={() => setSelectedBrand("")}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                    !selectedBrand ? "bg-blue-600/20 text-blue-400 font-medium" : "text-[#A1A1AA] hover:bg-[#1F1F23]"
                  }`}
                >
                  <span>All Brands</span>
                </button>
                {searchData.facets.brands.map((b) => (
                  <button
                    key={b.value}
                    onClick={() => setSelectedBrand(b.value)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                      selectedBrand === b.value
                        ? "bg-blue-600/20 text-blue-400 font-medium"
                        : "text-[#A1A1AA] hover:bg-[#1F1F23]"
                    }`}
                  >
                    <span>{b.value}</span>
                    <span className="text-[10px] text-[#71717A] px-1.5 py-0.5 rounded bg-[#1F1F23]">
                      {b.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Catalog Items Grid */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A1A1AA]">
              Showing {searchData?.items?.length || 0} of {searchData?.total || 0} items
            </span>
          </div>

          {loadingCatalog ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div key={idx} className="h-64 rounded-xl bg-[#141416] border border-[#27272A] animate-pulse" />
              ))}
            </div>
          ) : searchData?.items && searchData.items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchData.items.map((item) => {
                const qty = itemQuantities[item.id] || 1;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between p-4 rounded-xl bg-[#141416] border border-[#27272A] hover:border-[#3E3E44] transition-all group"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1F1F23] text-[#A1A1AA]">
                          {item.code}
                        </span>
                        {item.is_contract_item && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            Contract Tier
                          </span>
                        )}
                      </div>

                      {/* Title & Brand */}
                      <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                        {item.name}
                      </h3>
                      <p className="text-xs text-[#71717A] mb-2">{item.brand || item.manufacturer || "Enterprise Standard"}</p>

                      {/* Description */}
                      {item.description && (
                        <p className="text-xs text-[#A1A1AA] line-clamp-2 mb-3 leading-relaxed">
                          {item.description}
                        </p>
                      )}

                      {/* Lead Time & MOQ */}
                      <div className="flex items-center gap-3 text-[11px] text-[#71717A] mb-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          {item.lead_time_days || 3}d delivery
                        </span>
                        <span>•</span>
                        <span>MOQ: {item.min_order_qty || 1} {item.uom_code || "EA"}</span>
                      </div>

                      {/* Tier Pricing Mini Table */}
                      {item.tiers && item.tiers.length > 0 && (
                        <div className="p-2 rounded-lg bg-[#1B1B1E] border border-[#2D2D32] mb-3 space-y-1">
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                            <Percent className="w-3 h-3" />
                            Volume Discounts:
                          </div>
                          {item.tiers.map((t) => (
                            <div key={t.id} className="flex items-center justify-between text-[11px] text-[#A1A1AA]">
                              <span>≥ {t.min_quantity} units</span>
                              <span className="font-semibold text-white">
                                ₹{t.unit_price.toLocaleString("en-IN")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Price & Add to Cart Controls */}
                    <div className="pt-3 border-t border-[#27272A] space-y-3">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-base font-bold text-white">
                            ₹{item.standard_price.toLocaleString("en-IN")}
                          </span>
                          <span className="text-[11px] text-[#71717A] ml-1">/ {item.uom_code || "EA"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Stepper */}
                        <div className="flex items-center bg-[#1F1F23] rounded-lg border border-[#333338] px-1">
                          <button
                            onClick={() => handleQtyChange(item.id, -1)}
                            className="p-1.5 text-[#A1A1AA] hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-semibold px-2 text-white">{qty}</span>
                          <button
                            onClick={() => handleQtyChange(item.id, 1)}
                            className="p-1.5 text-[#A1A1AA] hover:text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Add Button */}
                        <button
                          onClick={() => handleAddToCart(item)}
                          disabled={addToCartMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center rounded-xl bg-[#141416] border border-[#27272A]">
              <Package className="w-10 h-10 text-[#71717A] mx-auto mb-3" />
              <p className="text-sm font-medium text-white">No catalog items match your search</p>
              <p className="text-xs text-[#71717A] mt-1">Try broadening your keywords or removing filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart Drawer Modal */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-[#141416] border-l border-[#27272A] flex flex-col justify-between h-full shadow-2xl p-6 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#27272A]">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-bold text-white">Shopping Cart</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold">
                    {cartItemsCount} items
                  </span>
                </div>
                <button
                  onClick={() => setCartOpen(false)}
                  className="p-1.5 rounded-lg text-[#71717A] hover:text-white hover:bg-[#1F1F23]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items List */}
              <div className="mt-4 space-y-3">
                {userCart?.items && userCart.items.length > 0 ? (
                  userCart.items.map((ci) => (
                    <div
                      key={ci.id}
                      className="p-3.5 rounded-xl bg-[#1A1A1D] border border-[#2D2D32] space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-mono text-[#71717A]">{ci.item_code}</p>
                          <p className="text-sm font-semibold text-white">{ci.item_name}</p>
                        </div>
                        <button
                          onClick={() => removeItemMutation.mutate(ci.id)}
                          className="p-1 text-[#71717A] hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#27272A]">
                        <div className="flex items-center gap-1.5 bg-[#141416] rounded-lg border border-[#333338] px-2 py-1">
                          <button
                            onClick={() =>
                              updateQtyMutation.mutate({
                                itemId: ci.id,
                                quantity: Math.max(1, ci.quantity - 1),
                              })
                            }
                            className="text-[#71717A] hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-semibold px-2 text-white">{ci.quantity}</span>
                          <button
                            onClick={() =>
                              updateQtyMutation.mutate({
                                itemId: ci.id,
                                quantity: ci.quantity + 1,
                              })
                            }
                            className="text-[#71717A] hover:text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-[#71717A] block">
                            ₹{ci.unit_price.toLocaleString("en-IN")} ea
                          </span>
                          <span className="text-sm font-bold text-white">
                            ₹{ci.total_price.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-xs text-[#71717A]">
                    Your shopping cart is currently empty.
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Checkout Footer */}
            {userCart?.items && userCart.items.length > 0 && (
              <div className="pt-4 border-t border-[#27272A] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#A1A1AA]">Estimated Subtotal</span>
                  <span className="text-lg font-bold text-white">
                    ₹{cartSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setCartOpen(false);
                    setCheckoutModalOpen(true);
                  }}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  <FileText className="w-4 h-4" />
                  <span>1-Click Convert to Requisition (PR)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout to PR Confirmation Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#141416] border border-[#2E2E32] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Convert Cart to Purchase Requisition</h3>
              </div>
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="text-[#71717A] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#A1A1AA] mb-1">
                  Requisition Title *
                </label>
                <input
                  type="text"
                  value={checkoutTitle}
                  onChange={(e) => setCheckoutTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A1A1AA] mb-1">
                  Notes / Justification
                </label>
                <textarea
                  rows={3}
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1F1F23] border border-[#333338] text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-[#1C1C1F] border border-[#2E2E32] flex items-center justify-between text-xs">
                <span className="text-[#A1A1AA]">Lines to Generate: {cartItemsCount}</span>
                <span className="font-bold text-white">
                  Total: ₹{cartSubtotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#27272A]">
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#A1A1AA] hover:bg-[#1F1F23]"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckout}
                disabled={checkoutMutation.isPending}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
              >
                {checkoutMutation.isPending ? "Generating Draft PR..." : "Confirm & Create PR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PunchOut Launch Handoff Modal */}
      {selectedPunchout && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141416] border border-[#2E2E32] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">{selectedPunchout.supplier_name}</h3>
              </div>
              <button
                onClick={() => setSelectedPunchout(null)}
                className="text-[#71717A] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#1C1C1F] border border-[#2E2E32] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Integration Protocol:</span>
                  <span className="font-mono text-purple-400 font-semibold">{selectedPunchout.protocol} 1.2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Endpoint URL:</span>
                  <span className="font-mono text-white truncate max-w-[200px]">{selectedPunchout.inbound_url}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Buyer Network ID:</span>
                  <span className="font-mono text-white">{selectedPunchout.sender_identity}</span>
                </div>
              </div>

              {punchoutLaunchSuccess ? (
                <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-400" />
                    PunchOut Session Active
                  </p>
                  <p className="text-[11px] text-purple-400/80">{punchoutLaunchSuccess}</p>
                </div>
              ) : (
                <p className="text-[#A1A1AA] leading-relaxed">
                  Launching will establish an authenticated session with the vendor's catalog. Items selected will be automatically returned to your shopping cart.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#27272A]">
              <button
                onClick={() => setSelectedPunchout(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#A1A1AA] hover:bg-[#1F1F23]"
              >
                Close
              </button>
              {!punchoutLaunchSuccess && (
                <button
                  onClick={handleLaunchPunchout}
                  disabled={punchoutLaunching}
                  className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{punchoutLaunching ? "Authenticating..." : "Open Marketplace"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
