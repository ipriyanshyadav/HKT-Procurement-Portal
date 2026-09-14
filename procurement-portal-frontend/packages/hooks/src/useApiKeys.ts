import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_rpm: number;
  status: string;
  key_type: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ApiKeyCreateRequest {
  name: string;
  scopes: string[];
  rate_limit_tier?: "TEST" | "STANDARD" | "ENTERPRISE";
  key_type?: "LIVE" | "TEST";
  ip_allowlist?: string[];
  expires_in_days?: number;
}

export interface ApiKeyCreateResponse {
  api_key: ApiKeyItem;
  raw_key: string;
}

export interface ApiKeyUpdateRequest {
  name?: string;
  scopes?: string[];
  rate_limit_rpm?: number;
  ip_allowlist?: string[];
  status?: "ACTIVE" | "REVOKED";
}

export interface ApiKeyUsageMetrics {
  key_id: string;
  total_requests: number;
  requests_today: number;
  requests_this_month: number;
  error_count_today: number;
  avg_latency_ms: number;
  last_active_at: string | null;
}

export interface ApiKeyLogItem {
  id: string;
  endpoint: string;
  method: string;
  status_code: number;
  latency_ms: number;
  ip_address: string | null;
  timestamp: string;
}

export function useTenantApiKeys() {
  return useQuery({
    queryKey: ["tenant-api-keys"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiKeyItem[] }>("/api-keys");
      return res.data.data ?? [];
    },
  });
}

export function useCreateTenantApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ApiKeyCreateRequest) => {
      const res = await apiClient.post<{ data: ApiKeyCreateResponse }>("/api-keys", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-api-keys"] });
    },
  });
}

export function useUpdateTenantApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ApiKeyUpdateRequest }) => {
      const res = await apiClient.patch<{ data: ApiKeyItem }>(`/api-keys/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-api-keys"] });
    },
  });
}

export function useRevokeTenantApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api-keys/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-api-keys"] });
    },
  });
}

export function useRotateTenantApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<{ data: ApiKeyCreateResponse }>(`/api-keys/${id}/rotate`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-api-keys"] });
    },
  });
}

export function useApiKeyUsageMetrics(keyId: string | null) {
  return useQuery({
    queryKey: ["api-key-usage", keyId],
    queryFn: async () => {
      if (!keyId) return null;
      const res = await apiClient.get<{ data: ApiKeyUsageMetrics }>(`/api-keys/${keyId}/usage`);
      return res.data.data;
    },
    enabled: Boolean(keyId),
  });
}

export function useApiKeyRecentLogs(keyId: string | null) {
  return useQuery({
    queryKey: ["api-key-logs", keyId],
    queryFn: async () => {
      if (!keyId) return [];
      const res = await apiClient.get<{ data: ApiKeyLogItem[] }>(`/api-keys/${keyId}/logs`);
      return res.data.data ?? [];
    },
    enabled: Boolean(keyId),
  });
}
