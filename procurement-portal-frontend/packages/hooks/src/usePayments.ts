import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  PaymentRecordResponse,
  PaymentProcessRequest,
  DisputeResponse,
  DisputeCreateRequest,
  DisputeMessageCreateRequest,
  DisputeResolveRequest,
  DisputeMessageResponse,
} from "@procurement/types";

export interface PaymentFilterParams {
  invoice_id?: string;
  vendor_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export function usePayments(params?: PaymentFilterParams) {
  return useQuery({
    queryKey: ["payments", params],
    queryFn: async () => {
      const res = await apiClient.get("/payments", { params });
      return (res.data.data ?? []) as PaymentRecordResponse[];
    },
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: ["payments", id],
    queryFn: async () => {
      const res = await apiClient.get(`/payments/${id}`);
      return res.data.data as PaymentRecordResponse;
    },
    enabled: Boolean(id),
  });
}

export function useSchedulePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiClient.post("/payments/schedule", { invoice_id: invoiceId });
      return res.data.data as PaymentRecordResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useProcessPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PaymentProcessRequest }) => {
      const res = await apiClient.post(`/payments/${id}/process`, data);
      return res.data.data as PaymentRecordResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useDisputes(params?: { invoice_id?: string; status?: string }) {
  return useQuery({
    queryKey: ["disputes", params],
    queryFn: async () => {
      const res = await apiClient.get("/payments/disputes/all", { params });
      return (res.data.data ?? []) as DisputeResponse[];
    },
  });
}

export function useCreateDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: DisputeCreateRequest) => {
      const res = await apiClient.post("/payments/disputes", data);
      return res.data.data as DisputeResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disputes"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useAddDisputeMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      disputeId,
      data,
    }: {
      disputeId: string;
      data: DisputeMessageCreateRequest;
    }) => {
      const res = await apiClient.post(`/payments/disputes/${disputeId}/messages`, data);
      return res.data.data as DisputeMessageResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disputes"] });
    },
  });
}

export function useResolveDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      disputeId,
      data,
    }: {
      disputeId: string;
      data: DisputeResolveRequest;
    }) => {
      const res = await apiClient.post(`/payments/disputes/${disputeId}/resolve`, data);
      return res.data.data as DisputeResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disputes"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}
