"use client";

import React, { useState } from "react";
import {
  usePunchOutSession,
  usePunchOutCart,
  PunchOutCartItem,
} from "@procurement/hooks";
import {
  ExternalLink,
  X,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Building2,
  RefreshCw,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";

export interface PunchOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransferCart: (items: PunchOutCartItem[]) => void;
  preferredCurrency?: string;
}

interface SimulatedVendorProduct {
  id: string;
  vendor_part_number: string;
  name: string;
  description: string;
  category: string;
  unit_price: number;
  uom: string;
  image_placeholder: string;
}

const SIMULATED_VENDORS = [
  {
    id: "v-amzn",
    name: "Amazon Business Enterprise",
    logoText: "Amazon Business",
    rating: "4.9",
    category: "IT Equipment & Office Supplies",
    products: [
      {
        id: "amzn-p1",
        vendor_part_number: "AMZN-DELL-U2723QE",
        name: "Dell UltraSharp 27\" 4K USB-C Hub Monitor (U2723QE)",
        description: "IPS Black technology, 2000:1 contrast ratio, 90W power delivery RJ45 Ethernet",
        category: "IT Hardware",
        unit_price: 52900,
        uom: "Piece",
        image_placeholder: "🖥️",
      },
      {
        id: "amzn-p2",
        vendor_part_number: "AMZN-LOGI-MXMK",
        name: "Logitech MX Master 3S + MX Keys Combo",
        description: "Quiet click 8K DPI laser sensor, smart illumination rechargeable wireless combo",
        category: "Computer Peripherals",
        unit_price: 19995,
        uom: "Set",
        image_placeholder: "⌨️",
      },
      {
        id: "amzn-p3",
        vendor_part_number: "AMZN-ANKER-65W",
        name: "Anker Prime 65W GaN Multi-Device Fast Charger",
        description: "3-Port USB-C ultra-compact power adapter for laptops, tablets, and phones",
        category: "Accessories",
        unit_price: 4999,
        uom: "Piece",
        image_placeholder: "🔌",
      },
    ],
  },
  {
    id: "v-granger",
    name: "Grainger Industrial Supply",
    logoText: "Grainger MRO",
    rating: "4.8",
    category: "Safety PPE, Maintenance & Facilities",
    products: [
      {
        id: "gr-p1",
        vendor_part_number: "GR-3M-AURA-9332",
        name: "3M Aura 9332+ FFP3 Valved Particulate Respirators (Box of 20)",
        description: "High-performance filter material, 3-panel design with Cool Flow exhalation valve",
        category: "Health & Safety",
        unit_price: 3450,
        uom: "Box",
        image_placeholder: "😷",
      },
      {
        id: "gr-p2",
        vendor_part_number: "GR-FLUKE-117",
        name: "Fluke 117 True-RMS Electrician's Multimeter with VoltAlert",
        description: "Non-contact voltage detection, AutoV/LoZ function prevents false readings from ghost voltage",
        category: "Test & Measurement",
        unit_price: 24800,
        uom: "Piece",
        image_placeholder: "⚡",
      },
    ],
  },
];

export function PunchOutModal({
  isOpen,
  onClose,
  onTransferCart,
  preferredCurrency = "INR",
}: PunchOutModalProps) {
  const [selectedVendorIndex, setSelectedVendorIndex] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [transferring, setTransferring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const sessionMutation = usePunchOutSession();
  const cartMutation = usePunchOutCart();

  if (!isOpen) return null;

  const activeVendor = SIMULATED_VENDORS[selectedVendorIndex] || SIMULATED_VENDORS[0];

  const handleStartSession = async () => {
    try {
      setStatusMessage("Initiating cXML / OCI PunchOut setup request...");
      const res = await sessionMutation.mutateAsync({
        vendor_id: activeVendor.id,
        return_url: window.location.href,
      });
      setSessionId(res.session_id);
      setSessionActive(true);
      setStatusMessage(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to establish PunchOut handshake";
      setStatusMessage(`Error: ${msg}`);
    }
  };

  const handleQtyChange = (productId: string, qty: number) => {
    if (qty <= 0) {
      const next = { ...cartQuantities };
      delete next[productId];
      setCartQuantities(next);
    } else {
      setCartQuantities((prev) => ({ ...prev, [productId]: qty }));
    }
  };

  const cartItemsCount = Object.values(cartQuantities).reduce((a, b) => a + b, 0);
  const cartSubtotal = Object.entries(cartQuantities).reduce((acc, [pId, qty]) => {
    const prod = activeVendor.products.find((p) => p.id === pId);
    return acc + (prod ? prod.unit_price * qty : 0);
  }, 0);

  const handleCheckoutAndTransfer = async () => {
    if (cartItemsCount === 0) return;
    setTransferring(true);

    try {
      const itemsPayload: PunchOutCartItem[] = Object.entries(cartQuantities)
        .map(([pId, qty]) => {
          const prod = activeVendor.products.find((p) => p.id === pId);
          if (!prod) return null;
          return {
            item_code: prod.vendor_part_number,
            item_description: `${prod.name} (${prod.vendor_part_number})`,
            quantity: qty,
            unit_price: prod.unit_price,
            currency: preferredCurrency,
            uom: prod.uom,
            category_code: prod.category,
            vendor_part_number: prod.vendor_part_number,
          };
        })
        .filter(Boolean) as PunchOutCartItem[];

      // Transmit to backend PunchOut cart receiver endpoint
      await cartMutation.mutateAsync(itemsPayload);

      // Return items to parent PR form
      onTransferCart(itemsPayload);
      setCartQuantities({});
      setSessionActive(false);
      setSessionId(null);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to transfer cart back to PR";
      setStatusMessage(`Transfer failed: ${msg}`);
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
              <ExternalLink className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  PunchOut Catalog Gateway (cXML / OCI)
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Live Simulator
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Shop on contracted supplier ecommerce stores and transfer your basket directly into this PR
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

        {/* Vendor Selector & Session Handshake Bar */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Supplier Store:
            </span>
            <div className="flex items-center gap-2">
              {SIMULATED_VENDORS.map((v, idx) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setSelectedVendorIndex(idx);
                    setCartQuantities({});
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    selectedVendorIndex === idx
                      ? "bg-purple-600 border-purple-600 text-white shadow-xs"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-purple-300"
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {sessionActive ? (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>Session Active: <code className="font-mono">{sessionId}</code></span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartSession}
                disabled={sessionMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-950/60 dark:text-purple-300 text-xs font-semibold rounded-lg transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sessionMutation.isPending ? "animate-spin" : ""}`} />
                <span>{sessionMutation.isPending ? "Connecting..." : "Handshake OCI Session"}</span>
              </button>
            )}
          </div>
        </div>

        {statusMessage && (
          <div className="px-6 py-2 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800">
            {statusMessage}
          </div>
        )}

        {/* Embedded Vendor Web Store View */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/60 dark:bg-slate-900/60">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            {/* Vendor Portal Top Navigation Banner */}
            <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-amber-400">
                  🛍️
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{activeVendor.logoText}</div>
                  <div className="text-[11px] text-slate-400">
                    B2B Contract Account: HKT-ENT-CORP-9021 • Contract Pricing Applied
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[11px] text-slate-400">In-Store Cart</div>
                  <div className="text-xs font-bold text-emerald-400">
                    {cartItemsCount} item{cartItemsCount === 1 ? "" : "s"} (₹{cartSubtotal.toLocaleString("en-IN")})
                  </div>
                </div>
              </div>
            </div>

            {/* Vendor Catalog Items */}
            <div className="p-6 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Contracted Products for Your Organization
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeVendor.products.map((p) => {
                  const qty = cartQuantities[p.id] || 0;
                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-xl border transition-all flex gap-4 ${
                        qty > 0
                          ? "border-purple-500 ring-2 ring-purple-500/10 bg-purple-50/10 dark:bg-purple-950/20"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-2xl shrink-0">
                        {p.image_placeholder}
                      </div>

                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                              {p.vendor_part_number}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">{p.category}</span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                            {p.name}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {p.description}
                          </p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {preferredCurrency}{" "}
                            {p.unit_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            <span className="text-[11px] font-normal text-slate-400"> / {p.uom}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {qty === 0 ? (
                              <button
                                type="button"
                                onClick={() => handleQtyChange(p.id, 1)}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add to Cart</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 border border-slate-200 dark:border-slate-600">
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(p.id, qty - 1)}
                                  className="p-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 rounded hover:bg-white dark:hover:bg-slate-600"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-7 text-center text-xs font-bold text-slate-900 dark:text-white">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(p.id, qty + 1)}
                                  className="p-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 rounded hover:bg-white dark:hover:bg-slate-600"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bar with Return / Checkout to PR */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {cartItemsCount} item{cartItemsCount === 1 ? "" : "s"} in PunchOut basket
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Total Basket: {preferredCurrency}{" "}
                {cartSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
              disabled={cartItemsCount === 0 || transferring}
              onClick={handleCheckoutAndTransfer}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-md transition-all"
            >
              {transferring ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Transferring Basket...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Return Cart to Requisition ({cartItemsCount})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
