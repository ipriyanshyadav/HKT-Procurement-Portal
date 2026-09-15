import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type { BuyerSelectionItem } from "./useIndents";

// Types — match Pydantic schemas exactly
export interface CartItem {
  id: string;
  cart_id: string;
  catalog_item_id: string | null;
  line_number: number;
  item_description: string;
  item_code: string | null;
  category_id: string;
  uom_id: string;
  quantity: number;
  estimated_unit_price: number;
  estimated_total: number;
  hsn_code: string | null;
  specifications: string | null;
  required_by_date: string | null;
  delivery_location_id: string | null;
  is_from_catalog: boolean;
  created_at: string;
}

export interface IndentCart {
  id: string;
  org_id: string;
  indentor_id: string;
  cart_name: string;
  status: string;
  assigned_buyer_id: string | null;
  transfer_note: string | null;
  transferred_at: string | null;
  business_unit_id: string | null;
  cost_center_id: string | null;
  delivery_location_id: string | null;
  required_by_date: string | null;
  items: CartItem[];
  item_count: number;
  estimated_total: number;
  created_at: string;
  updated_at: string;
}

export interface CartSummary {
  cart_id: string;
  item_count: number;
  estimated_total: number;
  currency: string;
  has_blocking_errors: boolean;
  warnings: { line_number: number; field: string; message: string }[];
  errors: string[];
}


export interface ConsigneeGRN {
  id: string;
  grn_number: string;
  po_id: string;
  vendor_name?: string;
  receipt_date?: string;
  consignee_status: "PENDING" | "CONFIRMED" | "REJECTED";
  consignee_confirmed_at?: string | null;
  consignee_rejection_reason?: string | null;
}

export function useActiveIndentCart() {
  return useQuery({
    queryKey: ["indent-cart", "active"],
    queryFn: async (): Promise<IndentCart | null> => {
      try {
        const res = await apiClient.get<{ data: IndentCart }>("/indent/cart");
        return res.data?.data || null;
      } catch (err: unknown) {
        return null;
      }
    },
    retry: false,
  });
}

export function useCreateCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      cart_name?: string;
      business_unit_id?: string;
      cost_center_id?: string;
      delivery_location_id?: string;
      required_by_date?: string;
    }): Promise<IndentCart> => {
      const res = await apiClient.post<{ data: IndentCart }>("/indent/cart", data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["indent-cart"] });
    },
  });
}

export function useAddCartItem(cartId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      item_description: string;
      category_id: string;
      uom_id: string;
      quantity: number;
      estimated_unit_price?: number;
      catalog_item_id?: string | null;
      is_from_catalog?: boolean;
      hsn_code?: string | null;
      specifications?: string | null;
    }): Promise<CartItem> => {
      const res = await apiClient.post<{ data: CartItem }>(`/indent/cart/${cartId}/items`, data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["indent-cart"] });
    },
  });
}

export function useRemoveCartItem(cartId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string): Promise<void> => {
      await apiClient.delete(`/indent/cart/${cartId}/items/${itemId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["indent-cart"] });
    },
  });
}

export function useTransferCart(cartId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      assigned_buyer_id?: string;
      transfer_note?: string;
      business_unit_id?: string;
      cost_center_id?: string;
    }): Promise<unknown> => {
      const res = await apiClient.post(`/indent/cart/${cartId}/transfer`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["indent-cart"] });
      qc.invalidateQueries({ queryKey: ["indents"] });
    },
  });
}

export function useCartSummary(cartId: string | undefined) {
  return useQuery({
    queryKey: ["indent-cart", cartId, "summary"],
    queryFn: async (): Promise<CartSummary> => {
      const res = await apiClient.get<{ data: CartSummary }>(`/indent/cart/${cartId}/summary`);
      return res.data.data;
    },
    enabled: !!cartId,
  });
}


export function useConsigneeGRNs() {
  return useQuery({
    queryKey: ["grn", "consignee", "mine"],
    queryFn: async (): Promise<ConsigneeGRN[]> => {
      const res = await apiClient.get<{ data: ConsigneeGRN[] }>("/grn/assigned-to-me");
      return res.data?.data || [];
    },
  });
}

export function useConsigneeConfirmGRN() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ grnId, note }: { grnId: string; note?: string }): Promise<unknown> => {
      const res = await apiClient.post(`/grn/${grnId}/consignee-confirm`, {
        confirmation_note: note || "",
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grn", "consignee"] });
    },
  });
}

export function useConsigneeRejectGRN() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ grnId, reason }: { grnId: string; reason: string }): Promise<unknown> => {
      const res = await apiClient.post(`/grn/${grnId}/consignee-reject`, {
        rejection_reason: reason,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grn", "consignee"] });
    },
  });
}

export function useIndentBuyers() {
  return useQuery({
    queryKey: ["indent-buyers"],
    queryFn: async (): Promise<BuyerSelectionItem[]> => {
      const res = await apiClient.get<{ data: BuyerSelectionItem[] }>("/requisitions/indent/buyers");
      return res.data?.data || [];
    },
  });
}
