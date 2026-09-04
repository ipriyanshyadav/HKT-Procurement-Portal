import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface BidLineDetail {
  id?: string;
  bid_id?: string;
  rfq_line_id: string;
  lot_id?: string | null;
  currency: string;
  quantity: number;
  delivery_days: number;
  unit_price?: number | null;
  total_price?: number | null;
  normalized_price_inr?: number | null;
  exchange_rate_used?: number | null;
  tax_rate_declared?: number;
  freight_quoted?: number;
  country_of_origin?: string;
  remarks?: string | null;
}

export interface BidDetail {
  id: string;
  org_id: string;
  rfq_id: string;
  vendor_id: string;
  status: string;
  current_version: number;
  submitted_at?: string | null;
  has_deviations: boolean;
  deviation_details?: string | null;
  technical_offer_compliant: boolean;
  payment_terms_code?: string | null;
  delivery_terms_incoterm?: string | null;
  bid_validity_days: number;
  covering_letter?: string | null;
  is_single_vendor_situation: boolean;
  bid_opened_at?: string | null;
  lines: BidLineDetail[];
}

export interface BidCount {
  rfq_id: string;
  bid_count: number;
  bids_opened: boolean;
  bids_opened_at?: string | null;
}

export function useBidCount(rfqId: string) {
  return useQuery({
    queryKey: ["rfqs", rfqId, "bid-count"],
    queryFn: async () => {
      const response = await apiClient.get(`/rfqs/${rfqId}/bid-count`);
      return response.data.data as BidCount;
    },
    enabled: Boolean(rfqId),
  });
}

export function useBidDetail(bidId: string) {
  return useQuery({
    queryKey: ["bids", bidId],
    queryFn: async () => {
      const response = await apiClient.get(`/bids/${bidId}`);
      return response.data.data as BidDetail;
    },
    enabled: Boolean(bidId),
  });
}

export function useSubmitBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rfqId, payload }: { rfqId: string; payload: any }) => {
      const response = await apiClient.post(`/rfqs/${rfqId}/bids`, payload);
      return response.data.data as BidDetail;
    },
    onSuccess: (_, { rfqId }) => {
      queryClient.invalidateQueries({ queryKey: ["rfqs", rfqId, "bid-count"] });
      queryClient.invalidateQueries({ queryKey: ["rfqs", rfqId] });
    },
  });
}

export function useReviseBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rfqId, payload }: { rfqId: string; payload: any }) => {
      const response = await apiClient.put(`/rfqs/${rfqId}/bids`, payload);
      return response.data.data as BidDetail;
    },
    onSuccess: (_, { rfqId }) => {
      queryClient.invalidateQueries({ queryKey: ["rfqs", rfqId, "bid-count"] });
    },
  });
}

export function useWithdrawBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rfqId, reason }: { rfqId: string; reason?: string }) => {
      const response = await apiClient.delete(`/rfqs/${rfqId}/bids`, { data: { reason } });
      return response.data.data as BidDetail;
    },
    onSuccess: (_, { rfqId }) => {
      queryClient.invalidateQueries({ queryKey: ["rfqs", rfqId, "bid-count"] });
      queryClient.invalidateQueries({ queryKey: ["rfqs", rfqId] });
    },
  });
}
