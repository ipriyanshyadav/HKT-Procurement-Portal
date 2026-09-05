import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface AuditLogEntry {
  id: string;
  org_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id?: string | null;
  actor_email?: string | null;
  actor_ip?: string | null;
  created_at: string;
  field_changes?: Record<string, any>;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  metadata?: Record<string, any>;
  trace_id?: string | null;
}

export interface AuditSearchFilters {
  entity_type?: string;
  action?: string;
  actor_id?: string;
  actor_email?: string;
  entity_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface AuditLogsResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
}

export function useAuditLogs(filters: AuditSearchFilters = {}) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.entity_type) params.append("entity_type", filters.entity_type);
      if (filters.action) params.append("action", filters.action);
      if (filters.actor_id) params.append("actor_id", filters.actor_id);
      if (filters.actor_email) params.append("actor_email", filters.actor_email);
      if (filters.entity_id) params.append("entity_id", filters.entity_id);
      if (filters.date_from) params.append("date_from", filters.date_from);
      if (filters.date_to) params.append("date_to", filters.date_to);
      if (filters.search) params.append("search", filters.search);
      if (filters.page) params.append("page", String(filters.page));
      if (filters.page_size) params.append("page_size", String(filters.page_size));

      const res = await apiClient.get(`/admin/audit-logs?${params.toString()}`);
      const items = (res.data?.data || []) as AuditLogEntry[];
      const total = (res.data?.meta?.total ?? items.length) as number;
      const page = (res.data?.meta?.page ?? filters.page ?? 1) as number;
      const page_size = (res.data?.meta?.page_size ?? filters.page_size ?? 20) as number;

      return {
        items,
        total,
        page,
        page_size,
      };
    },
  });
}
