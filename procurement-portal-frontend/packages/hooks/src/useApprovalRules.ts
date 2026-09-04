import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@procurement/utils';

export interface ApprovalRule {
  id: string;
  entity_type: 'PR' | 'RFQ' | 'PO' | 'VENDOR' | 'CONTRACT';
  rule_code: string;
  rule_name: string;
  priority: number;
  conditions: Record<string, any>;
  condition_expression: string | null;
  workflow_template_code: string;
  is_active: boolean;
  is_catch_all: boolean;
  effective_from: string;
  effective_to: string | null;
  created_by: string;
  created_at: string;
}

export interface ApprovalRuleVersion {
  id: string;
  rule_id: string;
  snapshot: Record<string, any>;
  activated_by: string;
  activated_at: string;
}

export interface ApprovalRuleCreatePayload {
  entity_type: string;
  rule_code: string;
  rule_name: string;
  priority: number;
  conditions?: Record<string, any>;
  condition_expression?: string | null;
  workflow_template_code: string;
  is_catch_all?: boolean;
  effective_from?: string;
  effective_to?: string | null;
}

export interface ApprovalRuleUpdatePayload {
  rule_name?: string;
  priority?: number;
  conditions?: Record<string, any>;
  condition_expression?: string | null;
  workflow_template_code?: string;
  effective_to?: string | null;
}

export interface ApprovalRuleSimulatePayload {
  entity_type: string;
  entity_context: Record<string, any>;
}

export interface ApprovalRuleSimulateResult {
  matched_rule: ApprovalRule | null;
  workflow_template_code: string | null;
  match_type: 'SPECIFIC' | 'CATCH_ALL' | 'NONE';
  evaluated_rules_count: number;
}

export function useApprovalRules(params?: { entity_type?: string; page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ['approval-rules', params],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApprovalRule[] }>('/approval-rules', { params });
      return res.data.data;
    },
  });
}

export function useApprovalRule(ruleId: string) {
  return useQuery({
    queryKey: ['approval-rules', ruleId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApprovalRule }>(`/approval-rules/${ruleId}`);
      return res.data.data;
    },
    enabled: Boolean(ruleId),
  });
}

export function useApprovalRuleVersions(ruleId: string) {
  return useQuery({
    queryKey: ['approval-rules', ruleId, 'versions'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApprovalRuleVersion[] }>(`/approval-rules/${ruleId}/versions`);
      return res.data.data;
    },
    enabled: Boolean(ruleId),
  });
}

export function useCreateApprovalRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ApprovalRuleCreatePayload) => {
      const res = await apiClient.post<{ data: ApprovalRule }>('/approval-rules', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] });
    },
  });
}

export function useUpdateApprovalRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ApprovalRuleUpdatePayload }) => {
      const res = await apiClient.put<{ data: ApprovalRule }>(`/approval-rules/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] });
    },
  });
}

export function useActivateApprovalRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<{ data: ApprovalRule }>(`/approval-rules/${id}/activate`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] });
    },
  });
}

export function useDeactivateApprovalRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<{ data: ApprovalRule }>(`/approval-rules/${id}/deactivate`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] });
    },
  });
}

export function useSimulateRuleMatching() {
  return useMutation({
    mutationFn: async (payload: ApprovalRuleSimulatePayload): Promise<ApprovalRuleSimulateResult> => {
      const res = await apiClient.post<ApprovalRuleSimulateResult>('/approval-rules/simulate', payload);
      return res.data;
    },
  });
}
