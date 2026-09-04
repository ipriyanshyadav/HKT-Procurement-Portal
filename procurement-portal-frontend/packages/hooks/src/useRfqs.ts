import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface RfqLot {
  id?: string;
  lot_number?: number;
  title: string;
  description?: string | null;
  estimated_value?: number;
  payment_term_override_id?: string | null;
  incoterm_override_id?: string | null;
}

export interface RfqLine {
  id?: string;
  line_number: number;
  lot_id?: string | null;
  item_description: string;
  item_code?: string | null;
  category_id: string;
  uom_id: string;
  quantity: number;
  estimated_unit_price: number;
  hsn_code?: string | null;
  specifications?: string | null;
  delivery_location_id?: string | null;
  required_by_date?: string | null;
}

export interface RfqParticipant {
  id: string;
  rfq_id: string;
  vendor_id: string;
  invitation_status: string;
  invited_at: string;
  accepted_at?: string | null;
  regretted_at?: string | null;
}

export interface RfqClarification {
  id: string;
  rfq_id: string;
  question: string;
  answer?: string | null;
  asked_by: string;
  asked_by_vendor_id?: string | null;
  answered_by?: string | null;
  answered_at?: string | null;
  is_published: boolean;
  published_at?: string | null;
  created_at: string;
}

export interface Rfq {
  id: string;
  rfq_number: string;
  title: string;
  rfq_type: string;
  sourcing_type: string;
  evaluation_type: string;
  procurement_type: string;
  status: string;
  currency: string;
  estimated_value: number;
  bid_open_at?: string | null;
  bid_close_at?: string | null;
  bid_validity_days: number;
  is_multi_lot: boolean;
  amendment_count: number;
  created_at: string;
  updated_at: string;
}

export interface RfqDetail extends Rfq {
  description?: string | null;
  buyer_id: string;
  business_unit_id: string;
  category_id: string;
  payment_term_id?: string | null;
  incoterm_id?: string | null;
  delivery_location_id?: string | null;
  is_emergency: boolean;
  is_single_vendor: boolean;
  single_vendor_justification?: string | null;
  requires_co_authorization: boolean;
  published_at?: string | null;
  bids_opened_at?: string | null;
  bids_opened_by?: string | null;
  co_authorized_by?: string | null;
  bid_opening_initiated_by?: string | null;
  bid_opening_initiated_at?: string | null;
  source_pr_id?: string | null;
  lots: RfqLot[];
  lines: RfqLine[];
  participants: RfqParticipant[];
  clarifications: RfqClarification[];
}

export interface RfqListParams {
  status?: string;
  rfq_type?: string;
  business_unit_id?: string;
  category_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export function useRfqs(params?: RfqListParams) {
  return useQuery({
    queryKey: ["rfqs", params],
    queryFn: async () => {
      const response = await apiClient.get("/rfqs", { params });
      return {
        rfqs: response.data.data as Rfq[],
        meta: response.data.meta,
      };
    },
  });
}

export function useRfq(id: string) {
  return useQuery({
    queryKey: ["rfqs", id],
    queryFn: async () => {
      const response = await apiClient.get(`/rfqs/${id}`);
      return response.data.data as RfqDetail;
    },
    enabled: Boolean(id),
  });
}

export function useRfqDashboard(id: string) {
  return useQuery({
    queryKey: ["rfqs", id, "dashboard"],
    queryFn: async () => {
      const response = await apiClient.get(`/rfqs/${id}/dashboard`);
      return response.data.data;
    },
    enabled: Boolean(id),
  });
}

export function useRfqClarifications(id: string) {
  return useQuery({
    queryKey: ["rfqs", id, "clarifications"],
    queryFn: async () => {
      const response = await apiClient.get(`/rfqs/${id}/clarifications`);
      return response.data.data as RfqClarification[];
    },
    enabled: Boolean(id),
  });
}

export function useCreateRfq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const response = await apiClient.post("/rfqs", payload);
      return response.data.data as RfqDetail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
    },
  });
}

export function usePublishRfq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/rfqs/${id}/publish`);
      return response.data.data as RfqDetail;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
      queryClient.invalidateQueries({ queryKey: ["rfqs", id] });
    },
  });
}

export function useAddRfqParticipants() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, vendor_ids }: { id: string; vendor_ids: string[] }) => {
      const response = await apiClient.post(`/rfqs/${id}/add-participants`, { vendor_ids });
      return response.data.data as RfqParticipant[];
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["rfqs", id] });
    },
  });
}

export function useInitiateBidOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/rfqs/${id}/initiate-bid-opening`);
      return response.data.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["rfqs", id] });
    },
  });
}

export function useCoAuthorizeBidOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/rfqs/${id}/co-authorize-opening`);
      return response.data.data as RfqDetail;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["rfqs", id] });
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
    },
  });
}

export function useAddClarification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rfq_id, question }: { rfq_id: string; question: string }) => {
      const response = await apiClient.post(`/rfqs/${rfq_id}/clarifications`, { question });
      return response.data.data as RfqClarification;
    },
    onSuccess: (_, { rfq_id }) => {
      queryClient.invalidateQueries({ queryKey: ["rfqs", rfq_id, "clarifications"] });
    },
  });
}

export function useRespondClarification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rfq_id,
      clarification_id,
      answer,
      broadcast = true,
    }: {
      rfq_id: string;
      clarification_id: string;
      answer: string;
      broadcast?: boolean;
    }) => {
      const response = await apiClient.put(`/rfqs/${rfq_id}/clarifications/${clarification_id}/respond`, {
        answer,
        broadcast,
      });
      return response.data.data as RfqClarification;
    },
    onSuccess: (_, { rfq_id }) => {
      queryClient.invalidateQueries({ queryKey: ["rfqs", rfq_id, "clarifications"] });
    },
  });
}
