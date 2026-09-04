import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@procurement/utils';

export interface WorkflowStepConfig {
  step_number: number;
  name: string;
  approver_role: string;
  timeout_hours: number;
  require_all?: boolean;
  condition?: string | null;
}

export interface WorkflowTemplateItem {
  id: string;
  code: string;
  name: string;
  entity_type: string;
  steps: WorkflowStepConfig[];
  is_active: boolean;
  created_at: string | null;
}

export interface WorkflowTemplateCreatePayload {
  code: string;
  name: string;
  entity_type: string;
  steps: WorkflowStepConfig[];
  is_active?: boolean;
}

export interface WorkflowTemplateUpdatePayload {
  name?: string;
  steps?: WorkflowStepConfig[];
  is_active?: boolean;
}

export function useWorkflowTemplates(entityType?: string) {
  return useQuery({
    queryKey: ['workflow-templates', entityType],
    queryFn: async () => {
      const url = entityType
        ? `/workflows/templates?entity_type=${encodeURIComponent(entityType)}`
        : '/workflows/templates';
      const { data } = await apiClient.get<{ data: WorkflowTemplateItem[] }>(url);
      return data.data;
    },
  });
}

export function useWorkflowTemplateDetail(templateId: string) {
  return useQuery({
    queryKey: ['workflow-template', templateId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: WorkflowTemplateItem }>(`/workflows/templates/${templateId}`);
      return data.data;
    },
    enabled: Boolean(templateId),
  });
}

export function useCreateWorkflowTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: WorkflowTemplateCreatePayload) => {
      const { data } = await apiClient.post<{ data: WorkflowTemplateItem }>('/workflows/templates', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
    },
  });
}

export function useUpdateWorkflowTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      templateId,
      payload,
    }: {
      templateId: string;
      payload: WorkflowTemplateUpdatePayload;
    }) => {
      const { data } = await apiClient.put<{ data: WorkflowTemplateItem }>(
        `/workflows/templates/${templateId}`,
        payload
      );
      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-template', variables.templateId] });
    },
  });
}
