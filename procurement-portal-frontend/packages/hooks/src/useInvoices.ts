import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  InvoiceResponse,
  InvoiceSubmitRequest,
  InvoiceDisputeRequest,
  InvoiceRejectRequest,
  EligibleLineResponse,
} from "@procurement/types";

export interface InvoiceFilterParams {
  po_id?: string;
  vendor_id?: string;
  status?: string;
  match_status?: string;
  payment_status?: string;
  financial_year?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export function useInvoices(params?: InvoiceFilterParams) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: async () => {
      const res = await apiClient.get("/invoices", { params });
      return (res.data.data ?? []) as InvoiceResponse[];
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => {
      const res = await apiClient.get(`/invoices/${id}`);
      return res.data.data as InvoiceResponse;
    },
    enabled: Boolean(id),
  });
}

export function useEligibleInvoiceLines(vendorId?: string) {
  return useQuery({
    queryKey: ["invoices", "eligible-lines", vendorId],
    queryFn: async () => {
      const res = await apiClient.get("/invoices/eligible-lines", {
        params: vendorId ? { vendor_id: vendorId } : undefined,
      });
      return (res.data.data ?? []) as EligibleLineResponse[];
    },
    staleTime: 10_000,
  });
}

export function useSubmitInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      vendorId,
    }: {
      data: InvoiceSubmitRequest;
      vendorId?: string;
    }) => {
      const res = await apiClient.post("/invoices", data, {
        params: vendorId ? { vendor_id: vendorId } : undefined,
      });
      return res.data.data as InvoiceResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function useApproveInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/invoices/${id}/approve`);
      return res.data.data as InvoiceResponse;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}

export function useRejectInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InvoiceRejectRequest }) => {
      const res = await apiClient.post(`/invoices/${id}/reject`, data);
      return res.data.data as InvoiceResponse;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", id] });
    },
  });
}

export function useDisputeInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InvoiceDisputeRequest }) => {
      const res = await apiClient.post(`/invoices/${id}/dispute`, data);
      return res.data.data as InvoiceResponse;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["disputes"] });
    },
  });
}

export function useMatchInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/invoices/${id}/match`);
      return res.data.data as InvoiceResponse;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", id] });
    },
  });
}
