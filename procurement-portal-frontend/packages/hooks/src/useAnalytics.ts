import { useQuery, useMutation } from "@tanstack/react-query";
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

export interface ApprovalBottleneckItem {
  assigned_role: string;
  approver_name?: string;
  avg_turnaround_hours: number;
  p95_turnaround_hours: number;
  total_tasks: number;
  sla_breaches: number;
  is_bottleneck: boolean;
}

export interface CycleTimeData {
  pr_to_po_avg_days: number;
  rfq_to_award_avg_days: number;
  pr_to_po_by_category: Array<{ category_name: string; avg_days: number; count: number }>;
  rfq_to_award_by_category: Array<{ category_name: string; avg_days: number; count: number }>;
  approval_bottlenecks?: ApprovalBottleneckItem[];
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

// Spend Cube
export interface SpendCubeCategoryItem {
  category_id?: string;
  category_name: string;
  total_spend: number;
  po_count: number;
  capex_spend: number;
  opex_spend: number;
  percentage: number;
}

export interface SpendCubeBUItem {
  business_unit_id?: string;
  bu_name: string;
  bu_code: string;
  total_spend: number;
  po_count: number;
  capex_spend: number;
  opex_spend: number;
  percentage: number;
}

export interface ParetoVendorItem {
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  total_spend: number;
  po_count: number;
  cumulative_spend: number;
  cumulative_percentage: number;
  pareto_tier: "TOP_80" | "LONG_TAIL";
}

export interface ParetoSummary {
  total_vendors: number;
  top_vendors_count: number;
  top_vendors_spend_pct: number;
  tail_vendors_count: number;
  tail_vendors_spend_pct: number;
}

export interface SpendCubeData {
  total_spend: number;
  capex_spend: number;
  opex_spend: number;
  capex_percentage: number;
  opex_percentage: number;
  by_category: SpendCubeCategoryItem[];
  by_bu: SpendCubeBUItem[];
  pareto_vendors: ParetoVendorItem[];
  pareto_summary: ParetoSummary;
}

// Maverick Spend
export interface MaverickPOItem {
  po_id: string;
  po_number: string;
  vendor_name: string;
  category_name: string;
  bu_name: string;
  total_value: number;
  created_at: string;
  risk_level: "HIGH" | "MEDIUM" | "LOW";
}

export interface MaverickCategoryBreakdown {
  category_name: string;
  maverick_spend: number;
  compliant_spend: number;
  total_spend: number;
  leakage_rate: number;
  risk_level: "HIGH" | "MEDIUM" | "LOW";
}

export interface MaverickBUBreakdown {
  bu_name: string;
  maverick_spend: number;
  total_spend: number;
  leakage_rate: number;
}

export interface MaverickSpendData {
  total_po_spend: number;
  contracted_spend: number;
  sourced_spend: number;
  maverick_spend: number;
  leakage_rate: number;
  total_po_count: number;
  maverick_po_count: number;
  compliant_po_count: number;
  by_category: MaverickCategoryBreakdown[];
  by_bu: MaverickBUBreakdown[];
  uncontracted_pos: MaverickPOItem[];
}

// Custom Report Builder
export interface CustomReportFilter {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "in";
  value: any;
}

export interface CustomReportSort {
  field: string;
  direction?: "asc" | "desc";
}

export interface CustomReportRequest {
  name: string;
  dimensions: string[];
  metrics: string[];
  filters?: CustomReportFilter[];
  sort?: CustomReportSort[];
  page?: number;
  page_size?: number;
}

export interface CustomReportData {
  name: string;
  dimensions: string[];
  metrics: string[];
  total_records: number;
  page: number;
  page_size: number;
  data: Record<string, any>[];
}

// Compliance Audit Reports
export interface EmergencyRFQItem {
  id: string;
  rfq_number: string;
  title: string;
  category_name: string;
  bu_name: string;
  estimated_value: number;
  justification?: string;
  published_at?: string;
  status: string;
}

export interface SingleVendorRFQItem {
  id: string;
  rfq_number: string;
  title: string;
  category_name: string;
  bu_name: string;
  estimated_value: number;
  single_vendor_justification?: string;
  created_at: string;
  status: string;
}

export interface ForceApproveItem {
  id: string;
  entity_type: string;
  entity_id: string;
  actor_email?: string;
  action: string;
  created_at: string;
  reason?: string;
}

export interface SoDViolationItem {
  id: string;
  entity_type: string;
  entity_id: string;
  actor_email?: string;
  action: string;
  created_at: string;
  details?: Record<string, any>;
}

export interface ComplianceAuditData {
  emergency_rfqs: EmergencyRFQItem[];
  single_vendor_rfqs: SingleVendorRFQItem[];
  force_approves: ForceApproveItem[];
  sod_violations: SoDViolationItem[];
  summary: {
    emergency_rfq_count: number;
    single_vendor_count: number;
    force_approve_count: number;
    sod_violation_count: number;
  };
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

export function useSpendCube(params?: { fiscal_year?: string; business_unit_id?: string }) {
  return useQuery({
    queryKey: ["analytics", "spend-cube", params],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/spend-cube", { params });
      return res.data.data as SpendCubeData;
    },
  });
}

export function useMaverickSpend(params?: { fiscal_year?: string; business_unit_id?: string; limit?: number }) {
  return useQuery({
    queryKey: ["analytics", "maverick-spend", params],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/maverick-spend", { params });
      return res.data.data as MaverickSpendData;
    },
  });
}

export function useComplianceAuditReports(params?: {
  report_type?: string;
  fiscal_year?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["analytics", "compliance-reports", params],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/compliance-reports", { params });
      return res.data.data as ComplianceAuditData;
    },
  });
}

export function useExecuteCustomReport() {
  return useMutation({
    mutationFn: async (payload: CustomReportRequest) => {
      const res = await apiClient.post("/analytics/reports", payload);
      return res.data.data as CustomReportData;
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
