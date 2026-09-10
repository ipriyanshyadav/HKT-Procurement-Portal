import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  CartCheckoutPayload,
  CartCheckoutResult,
  CartItemAddPayload,
  CatalogSearchResponse,
  PunchoutConfig,
  PunchoutLaunchResult,
  UserCart,
} from "@procurement/types";

export interface CatalogSearchParams {
  query?: string;
  category_id?: string;
  brand?: string;
  min_price?: number;
  max_price?: number;
  contract_only?: boolean;
  page?: number;
  page_size?: number;
}

export function useCatalogSearch(params?: CatalogSearchParams) {
  return useQuery({
    queryKey: ["catalog-search", params],
    queryFn: async () => {
      const res = await apiClient.get("/catalog/search", { params });
      return (res.data.data ?? res.data) as CatalogSearchResponse;
    },
  });
}

export function useUserCart() {
  return useQuery({
    queryKey: ["user-cart"],
    queryFn: async () => {
      const res = await apiClient.get("/catalog/cart");
      return (res.data.data ?? res.data) as UserCart;
    },
  });
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CartItemAddPayload) => {
      const res = await apiClient.post("/catalog/cart/items", payload);
      return (res.data.data ?? res.data) as UserCart;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-cart"] });
    },
  });
}

export function useUpdateCartQuantity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const res = await apiClient.put(`/catalog/cart/items/${itemId}`, { quantity });
      return (res.data.data ?? res.data) as UserCart;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-cart"] });
    },
  });
}

export function useRemoveFromCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiClient.delete(`/catalog/cart/items/${itemId}`);
      return (res.data.data ?? res.data) as UserCart;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-cart"] });
    },
  });
}

export function useCartCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CartCheckoutPayload) => {
      const res = await apiClient.post("/catalog/cart/checkout", payload);
      return (res.data.data ?? res.data) as CartCheckoutResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-cart"] });
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
    },
  });
}

export function usePunchoutConfigs() {
  return useQuery({
    queryKey: ["punchout-configs"],
    queryFn: async () => {
      const res = await apiClient.get("/catalog/punchout/configs");
      return (res.data.data ?? res.data) as PunchoutConfig[];
    },
  });
}

export function useLaunchPunchout() {
  return useMutation({
    mutationFn: async (payload: { config_id: string; return_url: string }) => {
      const res = await apiClient.post("/catalog/punchout/launch", payload);
      return (res.data.data ?? res.data) as PunchoutLaunchResult;
    },
  });
}
