import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  ApiKeyCreateRequest,
  ApiKeyCreatedResponse,
  ApiKeyResponse,
  ApiKeyRevokeRequest,
  DeveloperScopesResponse,
  WebhookDeliveryResponse,
  WebhookSubscriptionCreateRequest,
  WebhookSubscriptionResponse,
  WebhookSubscriptionUpdateRequest,
  WebhookTestPingRequest,
} from "@procurement/types";

export function useApiKeys() {
  return useQuery({
    queryKey: ["developer-api-keys"],
    queryFn: async () => {
      const res = await apiClient.get("/developer/keys");
      return (res.data.data ?? []) as ApiKeyResponse[];
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ApiKeyCreateRequest) => {
      const res = await apiClient.post("/developer/keys", payload);
      return res.data.data as ApiKeyCreatedResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["developer-api-keys"] });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ApiKeyRevokeRequest }) => {
      const res = await apiClient.post(`/developer/keys/${id}/revoke`, payload);
      return res.data.data as ApiKeyResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["developer-api-keys"] });
    },
  });
}

export function useWebhooks() {
  return useQuery({
    queryKey: ["developer-webhooks"],
    queryFn: async () => {
      const res = await apiClient.get("/developer/webhooks");
      return (res.data.data ?? []) as WebhookSubscriptionResponse[];
    },
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: WebhookSubscriptionCreateRequest) => {
      const res = await apiClient.post("/developer/webhooks", payload);
      return res.data.data as WebhookSubscriptionResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["developer-webhooks"] });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: WebhookSubscriptionUpdateRequest }) => {
      const res = await apiClient.patch(`/developer/webhooks/${id}`, payload);
      return res.data.data as WebhookSubscriptionResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["developer-webhooks"] });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/developer/webhooks/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["developer-webhooks"] });
    },
  });
}

export function useTestPingWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: WebhookTestPingRequest }) => {
      const res = await apiClient.post(`/developer/webhooks/${id}/test`, payload);
      return res.data.data as WebhookDeliveryResponse;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["developer-webhooks"] });
      queryClient.invalidateQueries({ queryKey: ["webhook-deliveries", vars.id] });
    },
  });
}

export function useWebhookDeliveries(subscriptionId: string) {
  return useQuery({
    queryKey: ["webhook-deliveries", subscriptionId],
    queryFn: async () => {
      const res = await apiClient.get(`/developer/webhooks/${subscriptionId}/deliveries`);
      return (res.data.data ?? []) as WebhookDeliveryResponse[];
    },
    enabled: Boolean(subscriptionId),
  });
}

export function useDeveloperScopes() {
  return useQuery({
    queryKey: ["developer-scopes"],
    queryFn: async () => {
      const res = await apiClient.get("/developer/scopes");
      return res.data.data as DeveloperScopesResponse;
    },
    staleTime: 10 * 60 * 1000,
  });
}
