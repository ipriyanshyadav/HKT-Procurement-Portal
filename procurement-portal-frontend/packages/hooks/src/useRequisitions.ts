import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface RequisitionLineItem {
  id?: string;
  requisition_id?: string;
  line_number: number;
  item_description: string;
  item_code?: string | null;
  category_id: string;
  uom_id: string;
  quantity: number;
  estimated_unit_price: number;
  estimated_total?: number;
  hsn_code?: string | null;
  specifications?: string | null;
  required_by_date?: string | null;
  delivery_location_id?: string | null;
}

export interface Requisition {
  id: string;
  org_id: string;
  pr_number: string;
  title: string;
  source: string;
  status: string;
  procurement_type: string;
  requestor_id: string;
  business_unit_id: string;
  category_id: string;
  currency: string;
  estimated_value: number;
  budget_check_status: string;
  required_by_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequisitionDetail extends Requisition {
  description?: string | null;
  plant_id?: string | null;
  department_id?: string | null;
  cost_center_id: string;
  budget_reserved_amount: number;
  is_emergency: boolean;
  is_capex: boolean;
  delivery_location_id?: string | null;
  erp_pr_number?: string | null;
  erp_sync_status: string;
  merged_from?: string[] | null;
  split_into?: string[] | null;
  split_from?: string | null;
  approved_at?: string | null;
  aging_alert_level: number;
  po_id?: string | null;
  po_number?: string | null;
  lines: RequisitionLineItem[];
}

export interface CreateRequisitionPayload {
  title: string;
  description?: string;
  procurement_type: string;
  business_unit_id: string;
  plant_id?: string;
  department_id?: string;
  cost_center_id: string;
  category_id: string;
  currency?: string;
  is_emergency?: boolean;
  is_capex?: boolean;
  required_by_date?: string;
  delivery_location_id?: string;
  lines: RequisitionLineItem[];
}

export interface UpdateRequisitionPayload {
  title?: string;
  description?: string;
  procurement_type?: string;
  business_unit_id?: string;
  plant_id?: string;
  department_id?: string;
  cost_center_id?: string;
  category_id?: string;
  currency?: string;
  is_emergency?: boolean;
  is_capex?: boolean;
  required_by_date?: string;
  delivery_location_id?: string;
  lines?: RequisitionLineItem[];
}

export interface MergeRequisitionsPayload {
  pr_ids: string[];
  merged_title?: string;
}

export interface SplitRequisitionPayload {
  splits: Array<{
    category_id: string;
    line_numbers: number[];
    title?: string;
  }>;
}

export interface UnmappedPRException {
  id: string;
  org_id: string;
  requisition_id: string;
  failed_fields: Record<string, any> | any[];
  status: string;
  assigned_to?: string | null;
  sla_deadline?: string | null;
  sla_breach_level: number;
  proposed_mappings?: Record<string, any> | any[] | null;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  reprocessing_attempts: number;
  last_reprocessing_error?: string | null;
  created_at: string;
  updated_at: string;
  requisition?: Requisition;
}

export interface UnmappedPRDashboardData {
  total_pending: number;
  tier_1_count: number;
  tier_2_count: number;
  tier_3_count: number;
  tier_4_count: number;
  total_blocked_value: number;
}

export interface MappingSuggestion {
  exception_id: string;
  suggested_category_id?: string | null;
  confidence: number;
  auto_apply: boolean;
  based_on_records: number;
  suggestions: Array<{
    target_id: string;
    label: string;
    confidence: number;
    method: string;
  }>;
  reason?: string | null;
}

export interface MapPRPayload {
  mappings: Array<{
    field: string;
    value: string;
    label?: string;
    source_value?: string;
  }>;
  notes?: string;
}

export interface RequisitionListParams {
  status?: string;
  business_unit_id?: string;
  category_id?: string;
  requestor_id?: string;
  search?: string;
  scope?: "all" | "mine" | "bu";
  page?: number;
  page_size?: number;
}

export function useRequisitions(params?: RequisitionListParams) {
  return useQuery({
    queryKey: ["requisitions", params],
    queryFn: async () => {
      const response = await apiClient.get("/requisitions", { params });
      return {
        requisitions: response.data.data as Requisition[],
        meta: response.data.meta,
      };
    },
  });
}

export function useRequisition(id: string) {
  return useQuery({
    queryKey: ["requisitions", id],
    queryFn: async () => {
      const response = await apiClient.get(`/requisitions/${id}`);
      return response.data.data as RequisitionDetail;
    },
    enabled: Boolean(id),
  });
}

export function useCreateRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRequisitionPayload) => {
      const response = await apiClient.post("/requisitions", payload);
      return response.data.data as RequisitionDetail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
    },
  });
}

export function useUpdateRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateRequisitionPayload }) => {
      const response = await apiClient.put(`/requisitions/${id}`, payload);
      return response.data.data as RequisitionDetail;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["requisitions", id] });
    },
  });
}

export function useSubmitRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/requisitions/${id}/submit`);
      return response.data.data as RequisitionDetail;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["requisitions", id] });
    },
  });
}

export function useWithdrawRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/requisitions/${id}/withdraw`);
      return response.data.data as RequisitionDetail;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["requisitions", id] });
    },
  });
}

export function useAmendRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateRequisitionPayload }) => {
      const response = await apiClient.post(`/requisitions/${id}/amend`, payload);
      return response.data.data as RequisitionDetail;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["requisitions", id] });
    },
  });
}

export function useMergeRequisitions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MergeRequisitionsPayload) => {
      const response = await apiClient.post("/requisitions/merge", payload);
      return response.data.data as RequisitionDetail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
    },
  });
}

export function useSplitRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: SplitRequisitionPayload }) => {
      const response = await apiClient.post(`/requisitions/${id}/split`, payload);
      return response.data.data as RequisitionDetail[];
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["requisitions", id] });
    },
  });
}

export function useConvertToRFQ() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/requisitions/${id}/convert-to-rfq`);
      return response.data.data as RequisitionDetail;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["requisitions", id] });
    },
  });
}

export function useConvertToPO() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: string | { id: string; vendor_id?: string }) => {
      const id = typeof args === "string" ? args : args.id;
      const payload = typeof args === "object" && args.vendor_id ? { vendor_id: args.vendor_id } : undefined;
      const response = await apiClient.post(`/requisitions/${id}/convert-to-po`, payload);
      return response.data.data as RequisitionDetail;
    },
    onSuccess: (_, args) => {
      const id = typeof args === "string" ? args : args.id;
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["requisitions", id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function usePRAuditTrail(id: string) {
  return useQuery({
    queryKey: ["requisition-audit", id],
    queryFn: async () => {
      const response = await apiClient.get(`/requisitions/${id}/audit-trail`);
      return response.data.data;
    },
    enabled: Boolean(id),
  });
}

export function useUnmappedPRs(params?: { status?: string; page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ["unmapped-prs", params],
    queryFn: async () => {
      const response = await apiClient.get("/unmapped-prs", { params });
      return {
        exceptions: response.data.data as UnmappedPRException[],
        meta: response.data.meta,
      };
    },
  });
}

export function useUnmappedPRDashboard() {
  return useQuery({
    queryKey: ["unmapped-prs", "dashboard"],
    queryFn: async () => {
      const response = await apiClient.get("/unmapped-prs/dashboard");
      return response.data.data as UnmappedPRDashboardData;
    },
  });
}

export function useSuggestMapping(exceptionId: string) {
  return useQuery({
    queryKey: ["unmapped-pr-suggest", exceptionId],
    queryFn: async () => {
      const response = await apiClient.get(`/unmapped-prs/${exceptionId}/suggest`);
      return response.data.data as MappingSuggestion;
    },
    enabled: Boolean(exceptionId),
  });
}

export function useMapPR() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: MapPRPayload }) => {
      const response = await apiClient.post(`/unmapped-prs/${id}/map`, payload);
      return response.data.data as RequisitionDetail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unmapped-prs"] });
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
    },
  });
}

export function useAutoMapPR() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/unmapped-prs/${id}/auto-map`);
      return response.data.data as RequisitionDetail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unmapped-prs"] });
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
    },
  });
}

export function useBulkCreateRequisitions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { items: CreateRequisitionPayload[] }) => {
      const response = await apiClient.post("/requisitions/bulk", payload);
      return response.data.data as RequisitionDetail[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
    },
  });
}
