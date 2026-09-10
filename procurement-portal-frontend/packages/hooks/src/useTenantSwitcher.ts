import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import { useAuthStore } from "@procurement/stores";
import type {
  CompanyContextResponse,
  CrossTenantRollupResponse,
  SwitchCompanyContextRequest,
  SwitchCompanyContextResponse,
} from "@procurement/types";

export function useAccessibleCompanies() {
  return useQuery({
    queryKey: ["accessible-companies"],
    queryFn: async () => {
      const res = await apiClient.get("/tenant/accessible-companies");
      return (res.data.data ?? []) as CompanyContextResponse[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSwitchCompanyContext() {
  const queryClient = useQueryClient();
  const setAccessToken = useAuthStore((state) => state.setAccessToken);

  return useMutation({
    mutationFn: async (payload: SwitchCompanyContextRequest) => {
      const res = await apiClient.post("/tenant/switch-context", payload);
      return res.data.data as SwitchCompanyContextResponse;
    },
    onSuccess: (data) => {
      if (data?.access_token) {
        setAccessToken(data.access_token);
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("active_company_id", data.active_company.id);
          localStorage.setItem("active_company_name", data.active_company.name);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["accessible-companies"] });
      queryClient.invalidateQueries({ queryKey: ["cross-tenant-rollup"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export function useCrossTenantRollup() {
  return useQuery({
    queryKey: ["cross-tenant-rollup"],
    queryFn: async () => {
      const res = await apiClient.get("/tenant/cross-tenant-rollup");
      return res.data.data as CrossTenantRollupResponse;
    },
    staleTime: 2 * 60 * 1000,
  });
}
