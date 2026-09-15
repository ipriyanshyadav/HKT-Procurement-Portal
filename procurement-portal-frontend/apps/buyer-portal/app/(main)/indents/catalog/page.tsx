"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useActiveIndentCart,
  useAddCartItem,
  useCreateCart,
  useCatalogItems,
  useAppToast,
  type ItemMaster,
} from "@procurement/hooks";
import { Button, Input, Badge } from "@procurement/ui";
import { Loader2, Search, ShoppingCart, Plus, Package } from "lucide-react";

export default function IndentCatalogPage() {
  const router = useRouter();
  const { toast } = useAppToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const { data: activeCart, isLoading: cartLoading } = useActiveIndentCart();
  const createCart = useCreateCart();
  const { data: catalogItems = [], isLoading: searchLoading } = useCatalogItems({
    search: debouncedSearch || undefined,
    category_id: selectedCategory || undefined,
  });
  const addToCart = useAddCartItem(activeCart?.id ?? "");

  const handleAddToCart = useCallback(
    async (item: ItemMaster) => {
      if (!activeCart) {
        toast.error("Please create a cart first");
        return;
      }
      setAddingItem(item.id);
      try {
        await addToCart.mutateAsync({
          item_description: item.name,
          catalog_item_id: item.id,
          category_id: item.category_id,
          uom_id: item.uom_id,
          estimated_unit_price: Number(item.standard_price ?? 0),
          quantity: 1,
          is_from_catalog: true,
        });
        toast.success(`${item.name} added to cart`);
      } catch {
        toast.error("Failed to add item to cart");
      } finally {
        setAddingItem(null);
      }
    },
    [activeCart, addToCart, toast]
  );

  return (
    <div className="flex h-full gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-gray-500 mt-1">Search for items to add to your indent cart</p>
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            className="pl-10"
            placeholder="Search catalog items, codes, descriptions..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>

        {/* Results grid */}
        {searchLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {catalogItems.map((item: ItemMaster) => (
              <div
                key={item.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <Package className="h-8 w-8 text-blue-500 shrink-0" />
                  <Badge variant={item.is_active ? "default" : "secondary"}>
                    {item.is_active ? "In Stock" : "Unavailable"}
                  </Badge>
                </div>
                <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">{item.name}</h3>
                {item.code && (
                  <p className="text-xs text-gray-400 mb-2">Code: {item.code}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      ₹{Number(item.standard_price ?? 0).toLocaleString("en-IN")}
                    </p>
                    <p className="text-xs text-gray-400">{item.currency || "INR"}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAddToCart(item)}
                    disabled={!activeCart || addingItem === item.id}
                  >
                    {addingItem === item.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3 mr-1" />
                    )}
                    Add
                  </Button>
                </div>
              </div>
            ))}
            {catalogItems.length === 0 && !searchLoading && (
              <div className="col-span-4 text-center py-16 text-gray-400">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No items found matching your search.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart sidebar */}
      <div className="w-72 shrink-0">
        <div className="sticky top-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">My Cart</h2>
          </div>
          {cartLoading ? (
            <div className="text-sm text-gray-400">Loading cart...</div>
          ) : activeCart ? (
            <>
              <div className="text-sm text-gray-600 mb-1">
                {activeCart.item_count} item{activeCart.item_count !== 1 ? "s" : ""}
              </div>
              <div className="text-xl font-bold text-gray-900 mb-4">
                ₹{Number(activeCart.estimated_total).toLocaleString("en-IN")}
              </div>
              <Button className="w-full" onClick={() => router.push("/indents/cart")}>
                View Cart & Transfer
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                No active cart. Create one to start adding items.
              </p>
              <Button
                className="w-full"
                onClick={() =>
                  createCart.mutate(
                    { cart_name: "My Cart" },
                    { onSuccess: () => toast.success("Cart created!") }
                  )
                }
                disabled={createCart.isPending}
              >
                {createCart.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Create Cart
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
