import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  AiRfqDraft,
  ConvertDraftToRfqResult,
  NegotiationSession,
  StartNegotiationPayload,
  SubmitCounterPayload,
  SupplierRadarScore,
} from "@procurement/types";

export function useSmartRfqDrafts() {
  return useQuery({
    queryKey: ["ai-sourcing-smart-rfq-drafts"],
    queryFn: async () => {
      const res = await apiClient.get("/ai-sourcing/smart-rfq/drafts");
      return (res.data.data ?? res.data) as AiRfqDraft[];
    },
  });
}

export function useGenerateSmartRfq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { pr_id?: string; unmapped_exception_ids?: string[]; custom_lot_items?: any[]; title?: string }) => {
      const res = await apiClient.post("/ai-sourcing/smart-rfq/generate", payload);
      return (res.data.data ?? res.data) as AiRfqDraft;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-sourcing-smart-rfq-drafts"] });
    },
  });
}

export function useConvertDraftToRfq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { draft_id: string; bid_submission_deadline?: string }) => {
      const res = await apiClient.post("/ai-sourcing/smart-rfq/convert", payload);
      return (res.data.data ?? res.data) as ConvertDraftToRfqResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-sourcing-smart-rfq-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
    },
  });
}

export function useNegotiationSessions(vendorId?: string) {
  return useQuery({
    queryKey: ["ai-sourcing-negotiation-sessions", vendorId],
    queryFn: async () => {
      const res = await apiClient.get("/ai-sourcing/negotiation/sessions", {
        params: vendorId ? { vendor_id: vendorId } : {},
      });
      return (res.data.data ?? res.data) as NegotiationSession[];
    },
  });
}

export function useNegotiationSession(sessionId: string) {
  return useQuery({
    queryKey: ["ai-sourcing-negotiation-session", sessionId],
    queryFn: async () => {
      const res = await apiClient.get(`/ai-sourcing/negotiation/sessions/${sessionId}`);
      return (res.data.data ?? res.data) as NegotiationSession;
    },
    enabled: Boolean(sessionId),
  });
}

export function useStartBotNegotiation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: StartNegotiationPayload) => {
      const res = await apiClient.post("/ai-sourcing/negotiation/sessions", payload);
      return (res.data.data ?? res.data) as NegotiationSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-sourcing-negotiation-sessions"] });
    },
  });
}

export function useSubmitNegotiationCounter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SubmitCounterPayload) => {
      const res = await apiClient.post("/ai-sourcing/negotiation/counter", payload);
      return (res.data.data ?? res.data) as NegotiationSession;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ai-sourcing-negotiation-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["ai-sourcing-negotiation-session", data.id] });
    },
  });
}

export function useSupplierRadarScores(categoryId?: string) {
  return useQuery({
    queryKey: ["ai-sourcing-supplier-radar-scores", categoryId],
    queryFn: async () => {
      const res = await apiClient.get("/ai-sourcing/radar/scores", {
        params: categoryId ? { category_id: categoryId } : {},
      });
      return (res.data.data ?? res.data) as SupplierRadarScore[];
    },
  });
}

export function useCalculateRadarScores() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { category_id?: string; vendor_ids?: string[] }) => {
      const res = await apiClient.post("/ai-sourcing/radar/calculate", payload);
      return (res.data.data ?? res.data) as SupplierRadarScore[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-sourcing-supplier-radar-scores"] });
    },
  });
}
