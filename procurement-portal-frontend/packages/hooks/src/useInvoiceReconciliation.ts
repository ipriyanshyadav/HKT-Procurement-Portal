import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  AdvancedReconciliationRequest,
  AdvancedReconciliationResponse,
  ReconciliationDashboardStats,
} from "@procurement/types";

export function useReconciliationDashboard() {
  return useQuery({
    queryKey: ["invoices", "reconciliation-dashboard"],
    queryFn: async () => {
      const res = await apiClient.get("/invoices/reconciliation/dashboard");
      return (res.data.data ?? {}) as ReconciliationDashboardStats;
    },
  });
}

export function usePerformReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoiceId,
      payload,
    }: {
      invoiceId: string;
      payload?: AdvancedReconciliationRequest;
    }) => {
      const res = await apiClient.post(`/invoices/${invoiceId}/reconcile`, payload || {});
      return res.data.data as AdvancedReconciliationResponse;
    },
    onSuccess: (_, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["invoices", "reconciliation-dashboard"] });
    },
  });
}
