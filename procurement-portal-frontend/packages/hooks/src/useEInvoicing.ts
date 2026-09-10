import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  EInvoice,
  EWayBill,
  GenerateEInvoicePayload,
  CancelEInvoicePayload,
  GenerateEWayBillPayload,
  AsnDispatchComplianceResult,
} from "@procurement/types";

export function useEInvoices() {
  return useQuery({
    queryKey: ["einvoicing-invoices"],
    queryFn: async () => {
      const res = await apiClient.get("/einvoicing/list");
      return (res.data.data ?? res.data) as EInvoice[];
    },
  });
}

export function useEInvoiceByIrn(irn?: string) {
  return useQuery({
    queryKey: ["einvoicing-invoice", irn],
    queryFn: async () => {
      if (!irn) return null;
      const res = await apiClient.get(`/einvoicing/irn/${irn}`);
      return (res.data.data ?? res.data) as EInvoice;
    },
    enabled: !!irn,
  });
}

export function useGenerateEInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GenerateEInvoicePayload) => {
      const res = await apiClient.post("/einvoicing/generate", payload);
      return (res.data.data ?? res.data) as EInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["einvoicing-invoices"] });
    },
  });
}

export function useCancelEInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CancelEInvoicePayload) => {
      const res = await apiClient.post("/einvoicing/cancel", payload);
      return (res.data.data ?? res.data) as EInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["einvoicing-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["einvoicing-eway-bills"] });
    },
  });
}

export function useEWayBills() {
  return useQuery({
    queryKey: ["einvoicing-eway-bills"],
    queryFn: async () => {
      const res = await apiClient.get("/einvoicing/eway-bill/list");
      return (res.data.data ?? res.data) as EWayBill[];
    },
  });
}

export function useGenerateEWayBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GenerateEWayBillPayload) => {
      const res = await apiClient.post("/einvoicing/eway-bill", payload);
      return (res.data.data ?? res.data) as EWayBill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["einvoicing-eway-bills"] });
    },
  });
}

export function useGenerateDispatchCompliance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { asn_id: string; vehicle_number: string; distance_km: number }) => {
      const res = await apiClient.post(
        `/einvoicing/asn/${params.asn_id}/dispatch-compliance`,
        null,
        {
          params: {
            vehicle_number: params.vehicle_number,
            distance_km: params.distance_km,
          },
        }
      );
      return (res.data.data ?? res.data) as AsnDispatchComplianceResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["einvoicing-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["einvoicing-eway-bills"] });
      queryClient.invalidateQueries({ queryKey: ["asns"] });
    },
  });
}
