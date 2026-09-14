import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface ExportJob {
  id: string;
  org_id: string;
  requested_by: string;
  export_type: string;
  filters: Record<string, unknown>;
  format: "CSV" | "EXCEL";
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED";
  total_rows: number | null;
  processed_rows: number;
  file_size_bytes: number | null;
  presigned_url: string | null;
  error_message: string | null;
  expires_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ExportJobCreateRequest {
  export_type: string;
  filters?: Record<string, unknown>;
  format?: "CSV" | "EXCEL";
}

export interface ExportJobRefreshUrlResponse {
  job_id: string;
  presigned_url: string;
  expires_at: string;
}

export function useExportJobs(limit: number = 30) {
  return useQuery({
    queryKey: ["exports", limit],
    queryFn: async () => {
      const res = await apiClient.get("/exports", { params: { limit } });
      return (res.data.data ?? []) as ExportJob[];
    },
    refetchInterval: (query) => {
      const jobs = query.state.data;
      const hasPending = jobs?.some(
        (j) => j.status === "QUEUED" || j.status === "PROCESSING"
      );
      return hasPending ? 4000 : false;
    },
  });
}

export function useExportJob(jobId: string | null | undefined) {
  return useQuery({
    queryKey: ["exports", "job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const res = await apiClient.get(`/exports/${jobId}`);
      return (res.data.data ?? null) as ExportJob | null;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data;
      return job && (job.status === "QUEUED" || job.status === "PROCESSING") ? 3000 : false;
    },
  });
}

export function useRequestExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ExportJobCreateRequest) => {
      const res = await apiClient.post("/exports", data);
      return res.data.data as ExportJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exports"] });
    },
  });
}

export function useCancelExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      await apiClient.delete(`/exports/${jobId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exports"] });
    },
  });
}

export function useRefreshExportUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiClient.post(`/exports/${jobId}/refresh-url`);
      return res.data.data as ExportJobRefreshUrlResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exports"] });
    },
  });
}
