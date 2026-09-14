import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface TenantWebhookEndpoint {
  id: string;
  name: string;
  url: string;
  subscribed_events: string[];
  is_active: boolean;
  secret_masked: string;
  custom_headers: Record<string, string>;
  ip_allowlist: string[];
  max_retries: number;
  timeout_seconds: number;
  failure_count: number;
  last_delivery_at: string | null;
  last_status_code: number | null;
  created_at: string;
  updated_at: string;
}

export interface TenantWebhookCreateRequest {
  name: string;
  url: string;
  subscribed_events: string[];
  custom_headers?: Record<string, string>;
  ip_allowlist?: string[];
  max_retries?: number;
  timeout_seconds?: number;
}

export interface TenantWebhookCreateResponse {
  webhook: TenantWebhookEndpoint;
  secret: string;
}

export interface TenantWebhookUpdateRequest {
  name?: string;
  url?: string;
  subscribed_events?: string[];
  is_active?: boolean;
  custom_headers?: Record<string, string>;
  ip_allowlist?: string[];
  max_retries?: number;
  timeout_seconds?: number;
}

export interface TenantWebhookDeliveryItem {
  id: string;
  event_type: string;
  status: string;
  status_code: number | null;
  attempt_number: number;
  latency_ms: number;
  error_message: string | null;
  payload: Record<string, unknown>;
  response_body: string | null;
  delivered_at: string;
}

export interface TenantWebhookTestResult {
  delivery_id: string;
  event_type: string;
  status: string;
  status_code: number | null;
  latency_ms: number;
  error_message: string | null;
  delivered_at: string;
}

export function useTenantWebhooks() {
  return useQuery({
    queryKey: ["tenant-webhooks"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: TenantWebhookEndpoint[] }>("/webhooks");
      return res.data.data ?? [];
    },
  });
}

export function useTenantWebhookEvents() {
  return useQuery({
    queryKey: ["tenant-webhook-events"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: string[] }>("/webhooks/events");
      return res.data.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTenantWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TenantWebhookCreateRequest) => {
      const res = await apiClient.post<{ data: TenantWebhookCreateResponse }>("/webhooks", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-webhooks"] });
    },
  });
}

export function useUpdateTenantWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TenantWebhookUpdateRequest }) => {
      const res = await apiClient.patch<{ data: TenantWebhookEndpoint }>(`/webhooks/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-webhooks"] });
    },
  });
}

export function useDeleteTenantWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/webhooks/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-webhooks"] });
    },
  });
}

export function useRotateTenantWebhookSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<{ data: { webhook_id: string; new_secret: string } }>(
        `/webhooks/${id}/rotate-secret`
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-webhooks"] });
    },
  });
}

export function useTestTenantWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      event_type,
      payload,
    }: {
      id: string;
      event_type?: string;
      payload?: Record<string, unknown>;
    }) => {
      const res = await apiClient.post<{ data: TenantWebhookTestResult }>(`/webhooks/${id}/test`, {
        event_type,
        payload,
      });
      return res.data.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["tenant-webhooks"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-webhook-deliveries", vars.id] });
    },
  });
}

export function useTenantWebhookDeliveries(webhookId: string | null) {
  return useQuery({
    queryKey: ["tenant-webhook-deliveries", webhookId],
    queryFn: async () => {
      if (!webhookId) return [];
      const res = await apiClient.get<{ data: TenantWebhookDeliveryItem[] }>(
        `/webhooks/${webhookId}/deliveries`
      );
      return res.data.data ?? [];
    },
    enabled: Boolean(webhookId),
    refetchInterval: 10000,
  });
}
