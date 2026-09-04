import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface CSLineRanking {
  id: string;
  cs_id: string;
  lot_id?: string | null;
  rfq_line_id?: string | null;
  bid_id: string;
  vendor_id: string;
  raw_unit_price: number;
  freight_per_unit: number;
  tax_per_unit: number;
  landed_cost: number;
  npv_adjusted_cost: number;
  rank: number;
  tax_discrepancy: boolean;
  supplier_declared_rate?: number | null;
  hsn_master_rate?: number | null;
  tie_breaking_applied: boolean;
  tie_breaking_reason?: string | null;
  lot_total_inr?: number | null;
  technical_score?: number | null;
  commercial_score?: number | null;
  composite_score?: number | null;
  is_l1: boolean;
}

export interface ComparativeStatement {
  id: string;
  org_id: string;
  rfq_id: string;
  cs_number: string;
  status: string;
  cost_of_capital_rate: number;
  evaluation_methodology: string;
  total_estimated_value: number;
  l1_total_value?: number | null;
  savings_percentage?: number | null;
  recommendations?: string | null;
  generated_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  pdf_document_id?: string | null;
  document_path?: string | null;
  cs_version: number;
  created_at?: string | null;
  rankings: CSLineRanking[];
}

export interface CSVersionSummary {
  id: string;
  cs_number: string;
  cs_version: number;
  status: string;
  l1_total_value?: number | null;
  savings_percentage?: number | null;
  created_at?: string | null;
  generated_by: string;
}

export interface Negotiation {
  id: string;
  org_id: string;
  rfq_id: string;
  cs_id?: string | null;
  vendor_id: string;
  round_number: number;
  original_price?: number | null;
  negotiated_price?: number | null;
  price_change_pct?: number | null;
  proposed_price?: number | null;
  counter_price?: number | null;
  status: string;
  notes?: string | null;
  negotiated_by: string;
  initiated_by?: string | null;
  created_at?: string | null;
}

export interface AwardDetail {
  id: string;
  arn_id: string;
  lot_id?: string | null;
  rfq_line_id?: string | null;
  vendor_id: string;
  bid_id: string;
  awarded_unit_price: number;
  awarded_quantity: number;
  awarded_total: number;
  award_type: string;
  justification?: string | null;
  created_at?: string | null;
}

export interface AwardRecommendation {
  id: string;
  org_id: string;
  rfq_id: string;
  cs_id: string;
  arn_number: string;
  status: string;
  justification: string;
  total_awarded_value?: number | null;
  recommended_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  details: AwardDetail[];
}

export function useComparativeStatement(rfqId: string) {
  return useQuery({
    queryKey: ["evaluations", "rfq", rfqId, "cs"],
    queryFn: async () => {
      const res = await apiClient.get(`/evaluations/rfq/${rfqId}/cs`);
      return res.data.data as ComparativeStatement;
    },
    enabled: Boolean(rfqId),
    retry: 1,
  });
}

export function useCSVersions(rfqId: string) {
  return useQuery({
    queryKey: ["evaluations", "rfq", rfqId, "cs-versions"],
    queryFn: async () => {
      const res = await apiClient.get(`/evaluations/rfq/${rfqId}/cs-versions`);
      return res.data.data as CSVersionSummary[];
    },
    enabled: Boolean(rfqId),
  });
}

export function useGenerateCS() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rfqId,
      costOfCapitalRate,
      evaluationMethodology,
    }: {
      rfqId: string;
      costOfCapitalRate?: number;
      evaluationMethodology?: string;
    }) => {
      const res = await apiClient.post(`/evaluations/rfq/${rfqId}/generate-cs`, {
        cost_of_capital_rate: costOfCapitalRate,
        evaluation_methodology: evaluationMethodology,
      });
      return res.data.data as ComparativeStatement;
    },
    onSuccess: (_, { rfqId }) => {
      queryClient.invalidateQueries({ queryKey: ["evaluations", "rfq", rfqId] });
      queryClient.invalidateQueries({ queryKey: ["rfqs", rfqId] });
    },
  });
}

export function useShortlistVendors() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      csId,
      vendorIds,
      criteria,
    }: {
      csId: string;
      vendorIds: string[];
      criteria?: string;
    }) => {
      const res = await apiClient.post(`/evaluations/${csId}/shortlist`, {
        vendor_ids: vendorIds,
        criteria,
      });
      return res.data.data;
    },
    onSuccess: (_, { csId }) => {
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
    },
  });
}

export function useNegotiations(csId: string) {
  return useQuery({
    queryKey: ["evaluations", csId, "negotiations"],
    queryFn: async () => {
      const res = await apiClient.get(`/evaluations/${csId}/negotiations`);
      return res.data.data as Negotiation[];
    },
    enabled: Boolean(csId),
  });
}

export function useStartNegotiation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      csId,
      vendorIds,
      notes,
    }: {
      csId: string;
      vendorIds: string[];
      notes?: string;
    }) => {
      const res = await apiClient.post(`/evaluations/${csId}/negotiations`, {
        vendor_ids: vendorIds,
        notes,
      });
      return res.data.data as Negotiation[];
    },
    onSuccess: (_, { csId }) => {
      queryClient.invalidateQueries({ queryKey: ["evaluations", csId, "negotiations"] });
    },
  });
}

export function useSubmitNegotiatedPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      negotiationId,
      negotiatedPrice,
      notes,
    }: {
      negotiationId: string;
      negotiatedPrice: number;
      notes?: string;
    }) => {
      const res = await apiClient.post(`/evaluations/negotiations/${negotiationId}/submit-price`, {
        negotiated_price: negotiatedPrice,
        notes,
      });
      return res.data.data as Negotiation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
    },
  });
}

export function useAwardRecommendation(csId: string) {
  return useQuery({
    queryKey: ["evaluations", csId, "award"],
    queryFn: async () => {
      const res = await apiClient.get(`/evaluations/${csId}/award`);
      return res.data.data as AwardRecommendation;
    },
    enabled: Boolean(csId),
    retry: 1,
  });
}

export function useRecommendAward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      csId,
      awards,
      justification,
    }: {
      csId: string;
      awards: Array<{
        lot_id?: string | null;
        rfq_line_id?: string | null;
        vendor_id: string;
        bid_id: string;
        value: number;
        quantity?: number;
        unit_price?: number;
        award_type?: string;
        justification: string;
      }>;
      justification: string;
    }) => {
      const res = await apiClient.post(`/evaluations/${csId}/recommend-award`, {
        awards,
        justification,
      });
      return res.data.data as AwardRecommendation;
    },
    onSuccess: (_, { csId }) => {
      queryClient.invalidateQueries({ queryKey: ["evaluations", csId, "award"] });
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
    },
  });
}

export function useApproveAward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      arnId,
      comments,
    }: {
      arnId: string;
      comments?: string;
    }) => {
      const res = await apiClient.post(`/evaluations/awards/${arnId}/approve`, {
        comments,
      });
      return res.data.data as AwardRecommendation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
    },
  });
}

export function useSendRegretLetters() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ csId }: { csId: string }) => {
      const res = await apiClient.post(`/evaluations/${csId}/send-regret-letters`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
    },
  });
}
