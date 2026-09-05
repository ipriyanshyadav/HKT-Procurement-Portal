import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface ProcurementKPIs {
  pr_to_po_cycle_days: number;
  savings_amount: number;
  savings_percentage: number;
  vendor_compliance_rate: number;
  on_time_delivery_rate: number;
  invoice_processing_days: number;
  cost_of_capital_rate: number;
  cost_of_capital_benefit: number;
  rfq_cycle_days?: number;
  bid_participation_rate?: number;
  contract_utilization_rate?: number;
}

export interface SpendCategoryItem {
  category_name: string;
  total_spend: number;
  po_count: number;
  vendor_count?: number;
  line_count?: number;
}

export interface SpendVendorItem {
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  total_spend: number;
  po_count: number;
}

export interface SpendBUItem {
  business_unit_id: string;
  bu_name: string;
  bu_code: string;
  total_spend: number;
  po_count: number;
}

export interface AllSpendData {
  by_category: SpendCategoryItem[];
  by_vendor: SpendVendorItem[];
  by_bu: SpendBUItem[];
  total_spend: number;
}

export interface SavingsAnalysisData {
  total_budgeted: number;
  total_actual: number;
  total_savings: number;
  savings_percentage: number;
  cost_of_capital_rate: number;
  cost_of_capital_benefit: number;
  by_category: Array<{
    category_name: string;
    budgeted: number;
    actual: number;
    savings: number;
    savings_percentage: number;
  }>;
  monthly_trend: Array<{
    month: string;
    budgeted: number;
    actual: number;
    savings: number;
  }>;
}

export interface CycleTimeData {
  pr_to_po_avg_days: number;
  rfq_to_award_avg_days: number;
  pr_to_po_by_category: Array<{ category_name: string; avg_days: number; count: number }>;
  rfq_to_award_by_category: Array<{ category_name: string; avg_days: number; count: number }>;
}

export interface VendorScorecardItem {
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  total_pos: number;
  avg_quality: number;
  avg_delivery: number;
  avg_price: number;
  avg_responsiveness: number;
  avg_compliance: number;
  composite_score: number;
  performance_tier: "PREFERRED" | "ACCEPTABLE" | "AT_RISK";
}

export interface SLAComplianceData {
  total_tasks: number;
  breached_tasks: number;
  sla_compliance_rate: number;
  avg_turnaround_hours: number;
}

export interface ComplianceDashboardData {
  active_vendors: number;
  total_vendors: number;
  contracts_expiring_soon: number;
  active_contracts: number;
  emergency_rfqs: number;
  single_vendor_rfqs: number;
}

export interface UnmappedPRAnalyticsData {
  pending: number;
  resolved: number;
  avg_resolution_hours: number;
  sla_breach_count: number;
}

export interface InvoiceAnalyticsData {
  total_invoiced: number;
  total_paid: number;
  total_invoices: number;
  pending_count: number;
  paid_count: number;
  overdue_count: number;
  avg_payment_days: number;
}

export interface AnalyticsDashboardData {
  kpis: ProcurementKPIs;
  spend: AllSpendData;
  savings: SavingsAnalysisData;
  cycle_times: CycleTimeData;
  compliance: ComplianceDashboardData;
}

export function useAnalyticsDashboard(params?: { fiscal_year?: string; business_unit_id?: string }) {
  return useQuery({
    queryKey: ["analytics", "dashboard", params],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/dashboard", { params });
      return res.data.data as AnalyticsDashboardData;
    },
  });
}

export function useProcurementKPIs(params?: { fiscal_year?: string; business_unit_id?: string }) {
  return useQuery({
    queryKey: ["analytics", "kpis", params],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/dashboard", { params });
      return res.data.data?.kpis as ProcurementKPIs;
    },
  });
}

export function useAllSpend(params?: { fiscal_year?: string; business_unit_id?: string }) {
  return useQuery({
    queryKey: ["analytics", "spend", "all", params],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/spend", { params });
      return res.data.data as AllSpendData;
    },
  });
}

export function useSpendSummary(params?: { group_by?: string; fiscal_year?: string; business_unit_id?: string }) {
  return useQuery({
    queryKey: ["analytics", "spend", params?.group_by, params],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/spend", { params });
      return res.data.data as any[];
    },
  });
}

export function useSavingsAnalysis(params?: { fiscal_year?: string; business_unit_id?: string }) {
  return useQuery({
    queryKey: ["analytics", "savings", params],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/savings", { params });
      return res.data.data as SavingsAnalysisData;
    },
  });
}

export function useCycleTimeAnalysis(params?: { fiscal_year?: string; business_unit_id?: string }) {
  return useQuery({
    queryKey: ["analytics", "cycle-times", params],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/cycle-times", { params });
      return res.data.data as CycleTimeData;
    },
  });
}

export function useVendorPerformance(vendorId?: string, params?: { business_unit_id?: string }) {
  return useQuery({
    queryKey: ["analytics", "vendor-performance", vendorId, params],
    queryFn: async () => {
      const url = vendorId ? `/analytics/vendor-performance/${vendorId}` : "/analytics/vendor-performance";
      const res = await apiClient.get(url, { params });
      return res.data.data as VendorScorecardItem | VendorScorecardItem[];
    },
  });
}

export function useSLACompliance(params?: { business_unit_id?: string }) {
  return useQuery({
    queryKey: ["analytics", "sla-compliance", params],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/sla-compliance", { params });
      return res.data.data as SLAComplianceData;
    },
  });
}

export function useComplianceDashboard() {
  return useQuery({
    queryKey: ["analytics", "compliance"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/compliance");
      return res.data.data as ComplianceDashboardData;
    },
  });
}

export function useUnmappedPRAnalytics() {
  return useQuery({
    queryKey: ["analytics", "unmapped-prs"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/unmapped-prs");
      return res.data.data as UnmappedPRAnalyticsData;
    },
  });
}

export function useInvoiceAnalytics(params?: { business_unit_id?: string }) {
  return useQuery({
    queryKey: ["analytics", "invoices", params],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/invoices", { params });
      return res.data.data as InvoiceAnalyticsData;
    },
  });
}

export async function downloadAnalyticsExport(
  format: "csv" | "excel",
  payload: {
    report_type?: string;
    data?: any[];
    filename?: string;
    group_by?: string;
    columns?: string[];
    sheet_name?: string;
    fiscal_year?: string;
  }
) {
  const url = format === "csv" ? "/analytics/export/csv" : "/analytics/export/excel";
  const res = await apiClient.post(url, payload, { responseType: "blob" });
  const blob = new Blob([res.data], {
    type:
      format === "csv"
        ? "text/csv"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = payload.filename || `export.${format === "csv" ? "csv" : "xlsx"}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
