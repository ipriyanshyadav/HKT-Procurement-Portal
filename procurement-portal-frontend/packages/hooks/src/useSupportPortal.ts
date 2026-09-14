import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_type: "CUSTOMER" | "AGENT" | "SYSTEM";
  message_text: string;
  is_internal_note: boolean;
  attachments: Record<string, any>[];
  created_at: string;
}

export interface SupportTicket {
  id: string;
  org_id: string;
  ticket_number: string;
  customer_id: string | null;
  customer_email: string;
  subject: string;
  description: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED";
  category: string;
  assigned_agent_id: string | null;
  csat_rating: number | null;
  csat_comment: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  messages?: SupportTicketMessage[];
}

export interface SupportMetrics {
  open_tickets_count: number;
  resolved_today_count: number;
  avg_response_time_minutes: number;
  csat_average: number;
}

export interface KBArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  content: string;
  is_published: boolean;
  helpful_votes: number;
  unhelpful_votes: number;
  created_at: string;
  updated_at: string;
}

export function useSupportTickets(params?: {
  status?: string;
  only_mine?: boolean;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["support-tickets", params],
    queryFn: async () => {
      const res = await apiClient.get<{ data: SupportTicket[] }>("/support/tickets", { params });
      return res.data.data;
    },
  });
}

export function useSupportTicket(id: string | undefined) {
  return useQuery({
    queryKey: ["support-ticket", id],
    queryFn: async () => {
      const res = await apiClient.get<{ data: SupportTicket }>(`/support/tickets/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      subject: string;
      description: string;
      priority?: string;
      category?: string;
    }) => {
      const res = await apiClient.post<{ data: SupportTicket }>("/support/tickets", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["support-metrics"] });
    },
  });
}

export function useAddSupportTicketMessage(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      message_text: string;
      is_internal_note?: boolean;
      attachments?: Record<string, any>[];
    }) => {
      const res = await apiClient.post<{ data: SupportTicketMessage }>(
        `/support/tickets/${ticketId}/messages`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });
}

export function useUpdateSupportTicket(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      status?: string;
      priority?: string;
      assigned_agent_id?: string;
      category?: string;
    }) => {
      const res = await apiClient.patch<{ data: SupportTicket }>(
        `/support/tickets/${ticketId}`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["support-metrics"] });
    },
  });
}

export function useSubmitSupportCSAT(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { rating: number; comment?: string }) => {
      const res = await apiClient.post<{ data: SupportTicket }>(
        `/support/tickets/${ticketId}/csat`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["support-metrics"] });
    },
  });
}

export function useSupportMetrics() {
  return useQuery({
    queryKey: ["support-metrics"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: SupportMetrics }>("/support/metrics");
      return res.data.data;
    },
  });
}

export function useSupportKBArticles(category?: string) {
  return useQuery({
    queryKey: ["support-kb-articles", category],
    queryFn: async () => {
      const res = await apiClient.get<{ data: KBArticle[] }>("/support/kb", {
        params: category ? { category } : undefined,
      });
      return res.data.data;
    },
  });
}
