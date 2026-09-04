import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface BusinessUnit {
  id: string;
  org_id: string;
  code: string;
  name: string;
  legal_entity_id: string;
  erp_company_code?: string | null;
  default_currency: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CostCenter {
  id: string;
  org_id: string;
  code: string;
  name: string;
  business_unit_id: string;
  gl_account?: string | null;
  erp_cost_center_code?: string | null;
  annual_budget: number | string;
  available_budget: number | string;
  budget_period_start?: string | null;
  budget_period_end?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface APIResponse<T> {
  data: T;
  meta?: unknown;
  links?: unknown;
  timestamp?: string;
}

const ORG_STALE_TIME = 1000 * 60 * 5; // 5 minutes

export function useBusinessUnits(params?: { active_only?: boolean }) {
  return useQuery({
    queryKey: ["organization", "business-units", params],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<BusinessUnit[]>>("/business-units", {
        params: { active_only: params?.active_only ?? true },
      });
      return res.data;
    },
    select: (res) => res.data,
    staleTime: ORG_STALE_TIME,
  });
}

export function useCostCenters(params?: { business_unit_id?: string; active_only?: boolean }) {
  return useQuery({
    queryKey: ["organization", "cost-centers", params],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<CostCenter[]>>("/cost-centers", {
        params: {
          business_unit_id: params?.business_unit_id,
          active_only: params?.active_only ?? true,
        },
      });
      return res.data;
    },
    select: (res) => res.data,
    staleTime: ORG_STALE_TIME,
  });
}
