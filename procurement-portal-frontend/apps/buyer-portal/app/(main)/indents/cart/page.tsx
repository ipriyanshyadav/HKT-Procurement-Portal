"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useActiveIndentCart,
  useRemoveCartItem,
  useTransferCart,
  useCartSummary,
  useIndentBuyers,
  useAppToast,
  type CartItem,
  type BuyerSelectionItem,
} from "@procurement/hooks";
import { Button, Badge, Textarea } from "@procurement/ui";
import { ShoppingCart, Loader2, ArrowRight, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function IndentCartPage() {
  const router = useRouter();
  const { toast } = useAppToast();
  const { data: cart, isLoading } = useActiveIndentCart();
  const removeItem = useRemoveCartItem(cart?.id ?? "");
  const transferCart = useTransferCart(cart?.id ?? "");
  const { data: summary } = useCartSummary(cart?.id);
  const { data: buyers = [] } = useIndentBuyers();

  const [selectedBuyerId, setSelectedBuyerId] = useState<string>("");
  const [transferNote, setTransferNote] = useState("");
  const [transferring, setTransferring] = useState(false);

  const handleTransfer = async () => {
    if (!cart) return;
    if (summary?.has_blocking_errors) {
      toast.error("Please fix all blocking errors before transferring");
      return;
    }
    setTransferring(true);
    try {
      await transferCart.mutateAsync({
        assigned_buyer_id: selectedBuyerId || undefined,
        transfer_note: transferNote || undefined,
      });
      toast.success("Cart transferred to buyer successfully!");
      router.push("/indents");
    } catch {
      toast.error("Transfer failed. Please check required fields.");
    } finally {
      setTransferring(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!cart) {
    return (
      <div className="text-center py-16">
        <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">No Active Cart</h2>
        <p className="text-gray-500 mt-1">Go to the catalog to search and add items.</p>
        <Button className="mt-4" onClick={() => router.push("/indents/catalog")}>
          Browse Catalog
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Indent Cart</h1>
        <Badge variant={cart.status === "ACTIVE" ? "default" : "secondary"}>{cart.status}</Badge>
      </div>

      {/* Validation summary */}
      {summary && (
        <div className="mb-6 space-y-2">
          {summary.errors.map((err: string) => (
            <div key={err} className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-2 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" /> {err}
            </div>
          ))}
          {summary.warnings.map((w: { line_number: number; message: string }, i: number) => (
            <div key={i} className="flex items-center gap-2 bg-amber-50 text-amber-700 rounded-lg px-4 py-2 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" /> Line {w.line_number}: {w.message}
            </div>
          ))}
          {!summary.has_blocking_errors && summary.errors.length === 0 && (
            <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-lg px-4 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4" /> Cart is ready to transfer
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart items table */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cart.items.map((item: CartItem) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.item_description}</p>
                    {item.item_code && <p className="text-xs text-gray-400">Code: {item.item_code}</p>}
                    {item.is_from_catalog && (
                      <Badge variant="outline" className="mt-1 text-xs">Catalog</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">₹{Number(item.estimated_unit_price).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-medium">₹{Number(item.estimated_total).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem.mutate(item.id)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cart.items.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Cart is empty</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push("/indents/catalog")}>
                Browse Catalog
              </Button>
            </div>
          )}
        </div>

        {/* Transfer panel */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 h-fit space-y-4">
          <h2 className="font-semibold text-gray-900">Transfer to Buyer</h2>

          <div className="text-2xl font-bold text-gray-900">
            ₹{Number(cart.estimated_total).toLocaleString("en-IN")}
          </div>
          <p className="text-xs text-gray-400">{cart.item_count} item{cart.item_count !== 1 ? "s" : ""} in cart</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign Buyer (optional)</label>
            <select
              aria-label="Assign Buyer"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              value={selectedBuyerId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedBuyerId(e.target.value)}
            >
              <option value="">Auto-assign</option>
              {buyers.map((b: BuyerSelectionItem) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.workload} open)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Note</label>
            <Textarea
              placeholder="Add notes for the buyer..."
              value={transferNote}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTransferNote(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleTransfer}
            disabled={transferring || cart.items.length === 0 || summary?.has_blocking_errors}
          >
            {transferring ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Transfer to Buyer
          </Button>
        </div>
      </div>
    </div>
  );
}
