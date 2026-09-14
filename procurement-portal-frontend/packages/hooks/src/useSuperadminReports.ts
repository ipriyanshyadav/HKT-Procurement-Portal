import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface SuperadminPlatformOverview {
  total_organizations: number;
  active_organizations: number;
  total_users: number;
  total_vendors: number;
  total_prs: number;
  total_pos: number;
  total_invoices: number;
  total_gmv_inr: number;
  mom_growth_percent: number;
}

export interface SuperadminOrgPerformanceItem {
  org_id: string;
  org_name: string;
  user_count: number;
  vendor_count: number;
  prs_count: number;
  pos_count: number;
  spend_mtd_inr: number;
  avg_sla_compliance_percent: number;
  status: string;
  created_at: string;
}

export interface SuperadminOrgDetail {
  org_id: string;
  org_name: string;
  legal_entities_count: number;
  business_units_count: number;
  active_users: number;
  active_vendors: number;
  total_spend_inr: number;
  open_tickets_count: number;
  last_activity_at?: string | null;
}

export function useSuperadminOverview() {
  return useQuery({
    queryKey: ["superadmin-overview"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: SuperadminPlatformOverview }>("/superadmin/reports/overview");
      return res.data.data;
    },
  });
}

export function useSuperadminOrgPerformance(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["superadmin-org-performance", page, pageSize],
    queryFn: async () => {
      const res = await apiClient.get<{ data: SuperadminOrgPerformanceItem[] }>("/superadmin/reports/orgs", {
        params: { page, page_size: pageSize },
      });
      return res.data.data;
    },
  });
}

export function useSuperadminOrgDetail(orgId: string | undefined) {
  return useQuery({
    queryKey: ["superadmin-org-detail", orgId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: SuperadminOrgDetail }>(`/superadmin/reports/orgs/${orgId}`);
      return res.data.data;
    },
    enabled: !!orgId,
  });
}
