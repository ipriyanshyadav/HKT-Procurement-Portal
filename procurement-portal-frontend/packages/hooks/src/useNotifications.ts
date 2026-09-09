import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import { useAuthStore, useNotificationStore } from "@procurement/stores";
import type {
  NotificationItem,
  NotificationPreference,
  NotificationTemplateItem,
  NotificationTemplateCreatePayload,
  NotificationTemplateUpdatePayload,
  NotificationTemplatePreviewPayload,
  NotificationTemplatePreviewResult,
} from "@procurement/types";

export interface NotificationsListResponse {
  data: NotificationItem[];
  meta: {
    page: number;
    page_size: number;
    total: number;
    unread_count?: number;
  };
}

export function useNotifications() {
  const token = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setConnected = useNotificationStore((state) => state.setConnected);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const queryClient = useQueryClient();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
      return;
    }

    let isUnmounted = false;

    function connect() {
      if (isUnmounted) return;

      let wsBaseUrl =
        typeof window !== "undefined"
          ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname.includes(":") && !window.location.hostname.startsWith("[") ? `[${window.location.hostname}]` : window.location.hostname}:8000`
          : (typeof process !== "undefined" && process.env.NEXT_PUBLIC_WS_URL
              ? process.env.NEXT_PUBLIC_WS_URL.replace(/^http/, "ws")
              : null) || "ws://localhost:8000";

      const url = `${wsBaseUrl}/ws/notifications?token=${encodeURIComponent(token!)}`;

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) {
            ws.close();
            return;
          }
          retryCountRef.current = 0;
          setConnected(true);

          // Heartbeat ping every 30 seconds
          if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 30000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "pong") {
              return;
            }

            // Normal notification message
            if (data.id || data.title) {
              const notification: NotificationItem = {
                id: data.id || data.notification_id,
                org_id: data.org_id || "",
                user_id: data.user_id || "",
                notification_type: data.notification_type || "GENERAL",
                channel: data.channel || "IN_APP",
                title: data.title,
                body: data.message || data.body || "",
                entity_type: data.entity_type,
                entity_id: data.entity_id,
                status: data.status || "SENT",
                created_at: data.created_at || new Date().toISOString(),
                is_read: false,
                retry_count: 0,
              };
              addNotification(notification);
              queryClient.invalidateQueries({ queryKey: ["notifications"] });
            }
          } catch {
            // Ignored invalid JSON payloads
          }
        };

        ws.onclose = (event) => {
          setConnected(false);
          if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

          if (!isUnmounted && event.code !== 4001) {
            // Reconnect with exponential backoff (1s, 2s, 4s, max 15s)
            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 15000);
            retryCountRef.current += 1;
            reconnectTimeoutRef.current = setTimeout(connect, delay);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        // WebSocket connection retry handled by reconnect logic
      }
    }

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [token, isAuthenticated, setConnected, addNotification, queryClient]);

  return {
    isConnected: useNotificationStore((state) => state.isConnected),
  };
}

export function useNotificationsList(params?: {
  page?: number;
  page_size?: number;
  unread_only?: boolean;
}) {
  const setNotifications = useNotificationStore((state) => state.setNotifications);

  return useQuery({
    queryKey: ["notifications", params],
    queryFn: async () => {
      const res = await apiClient.get<NotificationsListResponse>("/notifications", {
        params: {
          page: params?.page ?? 1,
          page_size: params?.page_size ?? 20,
          unread_only: params?.unread_only ?? false,
        },
      });
      if (res.data?.data) {
        setNotifications(res.data.data, res.data.meta?.unread_count);
      }
      return res.data;
    },
    select: (res) => ({
      items: res.data,
      meta: res.meta,
    }),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const markAsRead = useNotificationStore((state) => state.markAsRead);

  return useMutation({
    mutationFn: async (id: string) => {
      markAsRead(id);
      const res = await apiClient.post(`/notifications/${id}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);

  return useMutation({
    mutationFn: async () => {
      markAllAsRead();
      const res = await apiClient.post("/notifications/mark-all-read");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notificationPreferences"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: NotificationPreference[] }>("/notifications/preferences");
      return res.data.data;
    },
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: NotificationPreference[]) => {
      const res = await apiClient.put("/notifications/preferences", { preferences });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationPreferences"] });
    },
  });
}

export interface NotificationTemplatesResponse {
  data: NotificationTemplateItem[];
  meta: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export function useNotificationTemplates(params?: {
  channel?: string;
  language?: string;
  search?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["notificationTemplates", params],
    queryFn: async () => {
      const res = await apiClient.get<NotificationTemplatesResponse>("/notifications/templates", {
        params: {
          channel: params?.channel || undefined,
          language: params?.language || undefined,
          search: params?.search || undefined,
          is_active: params?.is_active !== undefined ? params.is_active : undefined,
          page: params?.page || 1,
          page_size: params?.page_size || 50,
        },
      });
      return res.data;
    },
  });
}

export function useNotificationTemplate(templateId?: string) {
  return useQuery({
    queryKey: ["notificationTemplate", templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const res = await apiClient.get<{ data: NotificationTemplateItem }>(`/notifications/templates/${templateId}`);
      return res.data.data;
    },
    enabled: !!templateId,
  });
}

export function useCreateNotificationTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: NotificationTemplateCreatePayload) => {
      const res = await apiClient.post<{ data: NotificationTemplateItem }>("/notifications/templates", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationTemplates"] });
    },
  });
}

export function useUpdateNotificationTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      payload,
    }: {
      templateId: string;
      payload: NotificationTemplateUpdatePayload;
    }) => {
      const res = await apiClient.put<{ data: NotificationTemplateItem }>(
        `/notifications/templates/${templateId}`,
        payload
      );
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notificationTemplates"] });
      queryClient.invalidateQueries({ queryKey: ["notificationTemplate", variables.templateId] });
    },
  });
}

export function useDeleteNotificationTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const res = await apiClient.delete<{ data: { message: string } }>(
        `/notifications/templates/${templateId}`
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationTemplates"] });
    },
  });
}

export function usePreviewNotificationTemplate() {
  return useMutation({
    mutationFn: async (payload: NotificationTemplatePreviewPayload) => {
      const res = await apiClient.post<{ data: NotificationTemplatePreviewResult }>(
        "/notifications/templates/preview",
        payload
      );
      return res.data.data;
    },
  });
}

