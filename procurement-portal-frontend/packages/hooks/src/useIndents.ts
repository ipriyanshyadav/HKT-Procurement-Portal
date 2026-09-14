import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

// --- Types ---

export interface IndentLineItem {
  line_number: number;
  item_description: string;
  item_code?: string | null;
  category_id: string;
  uom_id: string;
  quantity: number;
  estimated_unit_price: number;
  hsn_code?: string | null;
  specifications?: string | null;
  required_by_date?: string | null;
  delivery_location_id?: string | null;
}

export interface IndentTransferPayload {
  title: string;
  description?: string;
  business_unit_id: string;
  cost_center_id: string;
  plant_id?: string;
  department_id?: string;
  category_id: string;
  procurement_type: "CAPEX" | "OPEX" | "PROJECT" | "MRO" | "SERVICES";
  currency?: string;
  is_emergency?: boolean;
  required_by_date?: string;
  delivery_location_id?: string;
  indent_notes?: string;
  assigned_buyer_id?: string | null;
  lines: IndentLineItem[];
}

export interface IndentCartTransferPayload {
  title: string;
  indent_notes?: string;
  assigned_buyer_id?: string | null;
  business_unit_id?: string;
  cost_center_id?: string;
  plant_id?: string;
  department_id?: string;
  category_id?: string;
  procurement_type?: "CAPEX" | "OPEX" | "PROJECT" | "MRO" | "SERVICES";
  currency?: string;
  is_emergency?: boolean;
  required_by_date?: string;
  delivery_location_id?: string;
}

export interface IndentTransferResult {
  pr_id: string;
  pr_number: string;
  title: string;
  status: string;
  is_indent: boolean;
  indentor_id: string;
  assigned_buyer_id?: string | null;
  assigned_buyer_name?: string | null;
  total_value: number;
  currency: string;
  line_count: number;
  message: string;
}

export interface BuyerSelectionItem {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email: string;
  department?: string | null;
  workload?: number;
  category_scopes?: string[];
  bu_scopes?: string[];
}

export interface IndentTrackingItem {
  pr_id: string;
  pr_number: string;
  title: string;
  status: string;
  is_indent: boolean;
  estimated_value: number;
  currency: string;
  created_at: string;
  approved_at?: string | null;
  assigned_buyer_name?: string | null;
  workflow_step?: string | null;
  expected_delivery_date?: string | null;
  po_number?: string | null;
  grn_status?: string | null;
}

export interface IndentTrackingMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface IndentTrackingResponse {
  items: IndentTrackingItem[];
  meta: IndentTrackingMeta;
}

export interface IndentTrackingParams {
  page?: number;
  page_size?: number;
  status_filter?: string;
}

// --- Hooks ---

export function useAvailableBuyers(params?: {
  category_id?: string;
  business_unit_id?: string;
}) {
  return useQuery({
    queryKey: ["indent-buyers", params],
    queryFn: async () => {
      const res = await apiClient.get("/requisitions/indent/buyers", {
        params: {
          category_id: params?.category_id,
          business_unit_id: params?.business_unit_id,
        },
      });
      return (res.data.data ?? res.data) as BuyerSelectionItem[];
    },
    staleTime: 60_000,
  });
}

export function useTransferIndent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: IndentTransferPayload) => {
      const res = await apiClient.post("/requisitions/indent", payload);
      return (res.data.data ?? res.data) as IndentTransferResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indent-tracking"] });
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
    },
  });
}

export function useTransferCartAsIndent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: IndentCartTransferPayload) => {
      const res = await apiClient.post("/requisitions/indent/from-cart", payload);
      return (res.data.data ?? res.data) as IndentTransferResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-cart"] });
      queryClient.invalidateQueries({ queryKey: ["indent-tracking"] });
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
    },
  });
}

export function useIndentTracking(params?: IndentTrackingParams) {
  return useQuery({
    queryKey: ["indent-tracking", params],
    queryFn: async () => {
      const res = await apiClient.get("/requisitions/indent/tracking", {
        params: {
          page: params?.page ?? 1,
          page_size: params?.page_size ?? 20,
          status_filter: params?.status_filter,
        },
      });
      const raw = res.data.data ?? res.data;
      const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
      const meta = res.data?.meta ?? raw?.meta ?? {
        total: items.length,
        page: params?.page ?? 1,
        page_size: params?.page_size ?? 20,
        total_pages: 1,
      };
      return { items, meta } as IndentTrackingResponse;
    },
  });
}
