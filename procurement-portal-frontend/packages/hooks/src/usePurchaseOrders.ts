import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  POResponse,
  POLineResponse,
  POCreateRequest,
  POAmendmentResponse,
} from "@procurement/types";

export type { POResponse, POLineResponse, POCreateRequest, POAmendmentResponse };

export interface POFilterParams {
  status?: string;
  vendor_id?: string;
  business_unit_id?: string;
  rfq_id?: string;
  contract_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface POVendorAckRequest {
  accepted: boolean;
  rejection_reason?: string | null;
}

export interface POFromAwardRequest {
  arn_id: string;
  deviation_justification?: string | null;
}

export interface POAmendRequest {
  amendment_reason: string;
  lines?: {
    po_line_id?: string | null;
    item_description?: string;
    ordered_quantity?: number | string;
    unit_price?: number | string;
    promised_delivery_date?: string | null;
  }[];
}

export function usePurchaseOrders(params?: POFilterParams) {
  return useQuery({
    queryKey: ["purchase-orders", params],
    queryFn: async () => {
      const res = await apiClient.get("/purchase-orders", { params });
      return (res.data.data ?? []) as POResponse[];
    },
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: ["purchase-orders", id],
    queryFn: async () => {
      const res = await apiClient.get(`/purchase-orders/${id}`);
      return res.data.data as POResponse;
    },
    enabled: Boolean(id) && id !== "new",
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: POCreateRequest) => {
      const res = await apiClient.post("/purchase-orders", payload);
      return res.data.data as POResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function useCreatePOFromAward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: POFromAwardRequest) => {
      const res = await apiClient.post("/purchase-orders/from-award", payload);
      return res.data.data as POResponse[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function useApprovePO() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await apiClient.post(`/purchase-orders/${id}/approve`, { notes });
      return res.data.data as POResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function useSendPOToVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/purchase-orders/${id}/send-to-vendor`);
      return res.data.data as POResponse;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function useAcknowledgePO() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: POVendorAckRequest }) => {
      const res = await apiClient.post(`/purchase-orders/${id}/acknowledge`, payload);
      return res.data.data as POResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function useAmendPO() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: POAmendRequest }) => {
      const res = await apiClient.post(`/purchase-orders/${id}/amend`, payload);
      return res.data.data as POResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function useCancelPO() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiClient.post(`/purchase-orders/${id}/cancel`, { reason });
      return res.data.data as POResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function useDownloadPOPDF() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.get(`/purchase-orders/${id}/pdf`);
      return res.data.data as { po_id: string; po_number: string; download_url?: string; status: string };
    },
  });
}
