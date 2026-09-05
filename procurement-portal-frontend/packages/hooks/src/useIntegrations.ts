import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface IntegrationJob {
  id: string;
  org_id: string;
  job_type: string;
  entity_type: string;
  entity_id: string;
  direction: string;
  adapter_type: string;
  status: string;
  request_payload?: Record<string, any> | null;
  response_payload?: Record<string, any> | null;
  error_message?: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface IntegrationStats {
  total_jobs: number;
  pending_jobs: number;
  in_progress_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  retry_scheduled_jobs: number;
  success_rate: number;
}

export interface ScheduledJobRun {
  id: string;
  org_id?: string | null;
  job_name: string;
  started_at: string;
  completed_at?: string | null;
  status: string;
  records_processed: number;
  error_message?: string | null;
  created_at: string;
}

export interface IntegrationJobFilterParams {
  status?: string;
  job_type?: string;
  adapter_type?: string;
  page?: number;
  page_size?: number;
}

export function useIntegrationStats() {
  return useQuery({
    queryKey: ["integrations", "stats"],
    queryFn: async () => {
      const res = await apiClient.get("/integrations/stats");
      return res.data.data as IntegrationStats;
    },
    refetchInterval: 10000,
  });
}

export function useIntegrationJobs(params?: IntegrationJobFilterParams) {
  return useQuery({
    queryKey: ["integrations", "jobs", params],
    queryFn: async () => {
      const res = await apiClient.get("/integrations/jobs", { params });
      return {
        data: (res.data.data ?? []) as IntegrationJob[],
        meta: res.data.meta,
      };
    },
    refetchInterval: 10000,
  });
}

export function useScheduledRuns(limit: number = 20) {
  return useQuery({
    queryKey: ["integrations", "scheduled-runs", limit],
    queryFn: async () => {
      const res = await apiClient.get("/integrations/scheduled-runs", {
        params: { limit },
      });
      return (res.data.data ?? []) as ScheduledJobRun[];
    },
    refetchInterval: 15000,
  });
}

export function useRetryIntegrationJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiClient.post(`/integrations/jobs/${jobId}/retry`);
      return res.data.data as IntegrationJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });
}

export interface SyncTriggerPayload {
  adapter_type?: string;
  entity_type?: string;
}

export interface SyncTriggerResponse {
  status: string;
  adapter_type: string;
  jobs_created: number;
  records_processed: number;
  message: string;
  job_run_id?: string | null;
}

export function useTriggerSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SyncTriggerPayload = {}) => {
      const res = await apiClient.post("/integrations/sync/trigger", payload);
      return res.data.data as SyncTriggerResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });
}

