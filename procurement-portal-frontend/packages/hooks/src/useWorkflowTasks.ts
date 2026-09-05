import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface WorkflowTask {
  id: string;
  workflow_instance_id: string;
  step_number: number;
  assigned_to: string;
  assigned_role: string | null;
  status: string;
  action: string | null;
  comment: string | null;
  acted_at: string | null;
  sla_deadline: string | null;
  sla_status: "WITHIN_SLA" | "WARNING" | "ESCALATED" | "REASSIGNED" | "CRITICAL";
  created_at: string;
}

export interface WorkflowInstance {
  id: string;
  template_id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  current_step_number: number;
  started_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export interface TaskListResponse {
  data: WorkflowTask[];
  meta: {
    page: number;
    page_size: number;
    total: number;
  } | null;
}

export interface TaskActionPayload {
  comment?: string;
}

export function useMyWorkflowTasks(params?: { page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ["workflowTasks", "mine", params],
    queryFn: async () => {
      const res = await apiClient.get<TaskListResponse>("/workflows/tasks/my", {
        params: {
          page: params?.page ?? 1,
          page_size: params?.page_size ?? 25,
        },
      });
      return res.data;
    },
    select: (res) => ({
      tasks: res.data,
      meta: res.meta,
    }),
    staleTime: 30 * 1000, // 30s — tasks change frequently
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });
}

export function useWorkflowInstance(instanceId: string) {
  return useQuery({
    queryKey: ["workflowInstance", instanceId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: WorkflowInstance }>(
        `/workflows/instances/${instanceId}`
      );
      return res.data.data;
    },
    enabled: !!instanceId,
    staleTime: 30 * 1000,
  });
}

export function useApproveTask(instanceId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TaskActionPayload) => {
      const res = await apiClient.post<{ data: WorkflowInstance }>(
        `/workflows/instances/${instanceId}/tasks/${taskId}/approve`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflowTasks", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["workflowInstance", instanceId] });
    },
  });
}

export function useRejectTask(instanceId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TaskActionPayload) => {
      const res = await apiClient.post<{ data: WorkflowInstance }>(
        `/workflows/instances/${instanceId}/tasks/${taskId}/reject`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflowTasks", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["workflowInstance", instanceId] });
    },
  });
}

export function useReturnTask(instanceId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TaskActionPayload) => {
      const res = await apiClient.post<{ data: WorkflowInstance }>(
        `/workflows/instances/${instanceId}/tasks/${taskId}/return`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflowTasks", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["workflowInstance", instanceId] });
    },
  });
}

export function useBatchApproveTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tasks: Array<{ instanceId: string; taskId: string; comment?: string }>) => {
      const results = [];
      for (const t of tasks) {
        const res = await apiClient.post<{ data: WorkflowInstance }>(
          `/workflows/instances/${t.instanceId}/tasks/${t.taskId}/approve`,
          { comment: t.comment || "Batch approved" }
        );
        results.push(res.data.data);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflowTasks"] });
      queryClient.invalidateQueries({ queryKey: ["workflowInstance"] });
    },
  });
}
