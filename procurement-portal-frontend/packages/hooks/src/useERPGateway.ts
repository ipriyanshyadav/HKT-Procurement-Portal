import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  ERPEntityMapping,
  ERPSyncTriggerPayload,
  ERPReconciliationReport,
} from "@procurement/types";

export function useERPMappings(params?: {
  erp_system?: string;
  entity_type?: string;
  sync_status?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["integrations", "erp-mappings", params],
    queryFn: async () => {
      const res = await apiClient.get("/integrations/erp-gateway/mappings", {
        params,
      });
      return {
        mappings: (res.data.data ?? []) as ERPEntityMapping[],
        meta: res.data.meta,
      };
    },
    refetchInterval: 30000,
  });
}

export function useERPReconciliation(erpSystem?: string) {
  return useQuery({
    queryKey: ["integrations", "erp-reconciliation", erpSystem],
    queryFn: async () => {
      const res = await apiClient.get("/integrations/erp-gateway/reconciliation", {
        params: { erp_system: erpSystem },
      });
      return res.data.data as ERPReconciliationReport;
    },
    refetchInterval: 30000,
  });
}

export function useTriggerERPSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ERPSyncTriggerPayload) => {
      const res = await apiClient.post("/integrations/erp-gateway/sync", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "erp-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["integrations", "erp-reconciliation"] });
    },
  });
}

export function useRetryERPMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mappingId: string) => {
      const res = await apiClient.post(`/integrations/erp-gateway/mappings/${mappingId}/retry`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "erp-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["integrations", "erp-reconciliation"] });
    },
  });
}
