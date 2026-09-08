import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  TicketDetailResponse,
  TicketListResponse,
  TicketCreateRequest,
  TicketUpdateRequest,
  TicketCommentResponse,
  TicketCommentRequest,
  TicketCommentEditRequest,
  TicketAttachmentResponse,
  TicketWatcherResponse,
  TicketSLAConfigResponse,
  TicketSLAConfigRequest,
  TicketDashboardMetricsResponse,
  TicketAssignRequest,
  TicketResolveRequest,
  TicketCloseRequest,
  TicketReopenRequest,
  TicketEscalateRequest,
  TicketPendingResponseRequest,
  TicketSearchRequest,
  TicketBulkAssignRequest,
  TicketBulkStatusRequest,
  TicketType,
  TicketPriority,
  TicketStatus,
  TicketLinkItem,
  TicketLinkCreatePayload,
  CustomFieldDefItem,
  CustomFieldDefCreatePayload,
  CustomFieldDefUpdatePayload,
  CustomFieldValueRecord,
  AutomationRuleItem,
  AutomationRuleCreatePayload,
  AutomationRuleUpdatePayload,
} from "@procurement/types";

export interface TicketFilterParams {
  ticket_type?: TicketType;
  priority?: TicketPriority;
  status?: TicketStatus;
  assigned_to?: string;
  entity_type?: string;
  entity_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export function useTickets(params?: TicketFilterParams) {
  return useQuery({
    queryKey: ["tickets", params],
    queryFn: async () => {
      const res = await apiClient.get("/tickets", { params });
      return (res.data?.data ?? []) as TicketListResponse[];
    },
  });
}

export function useTicket(id?: string) {
  return useQuery({
    queryKey: ["tickets", id],
    queryFn: async () => {
      const res = await apiClient.get(`/tickets/${id}`);
      return (res.data?.data ?? res.data) as TicketDetailResponse;
    },
    enabled: Boolean(id),
  });
}

export function useMyRaisedTickets(params?: { page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ["tickets", "my-raised", params],
    queryFn: async () => {
      const res = await apiClient.get("/tickets/my/raised", { params });
      return (res.data?.data ?? []) as TicketListResponse[];
    },
  });
}

export function useMyAssignedTickets(params?: { page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ["tickets", "my-assigned", params],
    queryFn: async () => {
      const res = await apiClient.get("/tickets/my/assigned", { params });
      return (res.data?.data ?? []) as TicketListResponse[];
    },
  });
}

export function useEntityTickets(entityType?: string, entityId?: string) {
  return useQuery({
    queryKey: ["tickets", "entity", entityType, entityId],
    queryFn: async () => {
      const res = await apiClient.get(`/tickets/entity/${entityType}/${entityId}`);
      return (res.data?.data ?? []) as TicketListResponse[];
    },
    enabled: Boolean(entityType && entityId),
  });
}

export function useTicketDashboard() {
  return useQuery({
    queryKey: ["tickets", "dashboard"],
    queryFn: async () => {
      const res = await apiClient.get("/tickets/dashboard");
      return (res.data?.data ?? res.data) as TicketDashboardMetricsResponse;
    },
  });
}

export function useTicketSLAConfigs() {
  return useQuery({
    queryKey: ["tickets", "sla-configs"],
    queryFn: async () => {
      const res = await apiClient.get("/tickets/sla-config");
      return (res.data?.data ?? []) as TicketSLAConfigResponse[];
    },
  });
}

export function useTicketComments(ticketId?: string) {
  return useQuery({
    queryKey: ["tickets", ticketId, "comments"],
    queryFn: async () => {
      const res = await apiClient.get(`/tickets/${ticketId}/comments`);
      return (res.data?.data ?? []) as TicketCommentResponse[];
    },
    enabled: Boolean(ticketId),
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TicketCreateRequest) => {
      const res = await apiClient.post("/tickets", data);
      return (res.data?.data ?? res.data) as TicketDetailResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TicketUpdateRequest }) => {
      const res = await apiClient.put(`/tickets/${id}`, data);
      return (res.data?.data ?? res.data) as TicketDetailResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.id] });
    },
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/tickets/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useAssignTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TicketAssignRequest }) => {
      const res = await apiClient.post(`/tickets/${id}/assign`, data);
      return (res.data?.data ?? res.data) as TicketDetailResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.id] });
    },
  });
}

export function useStartTicketProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/tickets/${id}/start-progress`);
      return (res.data?.data ?? res.data) as TicketDetailResponse;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["tickets", id] });
    },
  });
}

export function useResolveTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TicketResolveRequest }) => {
      const res = await apiClient.post(`/tickets/${id}/resolve`, data);
      return (res.data?.data ?? res.data) as TicketDetailResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.id] });
    },
  });
}

export function useCloseTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data?: TicketCloseRequest }) => {
      const res = await apiClient.post(`/tickets/${id}/close`, data || {});
      return (res.data?.data ?? res.data) as TicketDetailResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.id] });
    },
  });
}

export function useReopenTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TicketReopenRequest }) => {
      const res = await apiClient.post(`/tickets/${id}/reopen`, data);
      return (res.data?.data ?? res.data) as TicketDetailResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.id] });
    },
  });
}

export function useEscalateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TicketEscalateRequest }) => {
      const res = await apiClient.post(`/tickets/${id}/escalate`, data);
      return (res.data?.data ?? res.data) as TicketDetailResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.id] });
    },
  });
}

export function useSetTicketPendingResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TicketPendingResponseRequest }) => {
      const res = await apiClient.post(`/tickets/${id}/pending-response`, data);
      return (res.data?.data ?? res.data) as TicketDetailResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.id] });
    },
  });
}

export function useAddTicketComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: string; data: TicketCommentRequest }) => {
      const res = await apiClient.post(`/tickets/${ticketId}/comments`, data);
      return (res.data?.data ?? res.data) as TicketCommentResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.ticketId, "comments"] });
    },
  });
}

export function useEditTicketComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ticketId,
      commentId,
      data,
    }: {
      ticketId: string;
      commentId: string;
      data: TicketCommentEditRequest;
    }) => {
      const res = await apiClient.put(`/tickets/${ticketId}/comments/${commentId}`, data);
      return (res.data?.data ?? res.data) as TicketCommentResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.ticketId, "comments"] });
    },
  });
}

export function useDeleteTicketComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, commentId }: { ticketId: string; commentId: string }) => {
      const res = await apiClient.delete(`/tickets/${ticketId}/comments/${commentId}`);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.ticketId, "comments"] });
    },
  });
}

export function useAddTicketWatcher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, userId }: { ticketId: string; userId: string }) => {
      const res = await apiClient.post(`/tickets/${ticketId}/watchers/${userId}`);
      return (res.data?.data ?? res.data) as TicketWatcherResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.ticketId] });
    },
  });
}

export function useRemoveTicketWatcher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, userId }: { ticketId: string; userId: string }) => {
      const res = await apiClient.delete(`/tickets/${ticketId}/watchers/${userId}`);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.ticketId] });
    },
  });
}

export function useUploadTicketAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, formData }: { ticketId: string; formData: FormData }) => {
      const res = await apiClient.post(`/tickets/${ticketId}/attachments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return (res.data?.data ?? res.data) as TicketAttachmentResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.ticketId] });
    },
  });
}

export function useDeleteTicketAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, attachmentId }: { ticketId: string; attachmentId: string }) => {
      const res = await apiClient.delete(`/tickets/${ticketId}/attachments/${attachmentId}`);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets", variables.ticketId] });
    },
  });
}

export function useUpdateTicketSLAConfigs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TicketSLAConfigRequest[]) => {
      const res = await apiClient.put("/tickets/sla-config", data);
      return (res.data?.data ?? res.data) as TicketSLAConfigResponse[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", "sla-configs"] });
    },
  });
}

export function useSearchTickets() {
  return useMutation({
    mutationFn: async (data: TicketSearchRequest) => {
      const res = await apiClient.post("/tickets/search", data);
      return (res.data?.data ?? []) as TicketListResponse[];
    },
  });
}

export function useBulkAssignTickets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TicketBulkAssignRequest) => {
      const res = await apiClient.post("/tickets/bulk/assign", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useBulkStatusTickets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TicketBulkStatusRequest) => {
      const res = await apiClient.post("/tickets/bulk/status", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

// --- Issue Linking Hooks (Jira-style Links) ---
export function useTicketLinks(ticketId?: string) {
  return useQuery({
    queryKey: ["tickets", ticketId, "links"],
    queryFn: async () => {
      const res = await apiClient.get(`/tickets/${ticketId}/links`);
      return (res.data?.data ?? []) as TicketLinkItem[];
    },
    enabled: Boolean(ticketId),
  });
}

export function useCreateTicketLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: string; data: TicketLinkCreatePayload }) => {
      const res = await apiClient.post(`/tickets/${ticketId}/links`, data);
      return res.data?.data ?? res.data;
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ["tickets", ticketId, "links"] });
      queryClient.invalidateQueries({ queryKey: ["tickets", ticketId] });
    },
  });
}

export function useRemoveTicketLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, linkId }: { ticketId: string; linkId: string }) => {
      const res = await apiClient.delete(`/tickets/${ticketId}/links/${linkId}`);
      return res.data;
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ["tickets", ticketId, "links"] });
      queryClient.invalidateQueries({ queryKey: ["tickets", ticketId] });
    },
  });
}

// --- Custom Fields Hooks ---
export function useCustomFieldDefs(ticketType?: string) {
  return useQuery({
    queryKey: ["tickets", "custom-field-defs", ticketType],
    queryFn: async () => {
      const res = await apiClient.get("/tickets/custom-fields/definitions", {
        params: ticketType ? { ticket_type: ticketType } : undefined,
      });
      return (res.data?.data ?? []) as CustomFieldDefItem[];
    },
  });
}

export function useCreateCustomFieldDef() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CustomFieldDefCreatePayload) => {
      const res = await apiClient.post("/tickets/custom-fields/definitions", data);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", "custom-field-defs"] });
    },
  });
}

export function useUpdateCustomFieldDef() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fieldDefId, data }: { fieldDefId: string; data: CustomFieldDefUpdatePayload }) => {
      const res = await apiClient.put(`/tickets/custom-fields/definitions/${fieldDefId}`, data);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", "custom-field-defs"] });
    },
  });
}

export function useDeleteCustomFieldDef() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fieldDefId: string) => {
      const res = await apiClient.delete(`/tickets/custom-fields/definitions/${fieldDefId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", "custom-field-defs"] });
    },
  });
}

export function useTicketCustomFields(ticketId?: string) {
  return useQuery({
    queryKey: ["tickets", ticketId, "custom-fields"],
    queryFn: async () => {
      const res = await apiClient.get(`/tickets/${ticketId}/custom-fields`);
      return (res.data?.data ?? []) as CustomFieldValueRecord[];
    },
    enabled: Boolean(ticketId),
  });
}

// --- Automation Rules Hooks ---
export function useAutomationRules() {
  return useQuery({
    queryKey: ["tickets", "automation-rules"],
    queryFn: async () => {
      const res = await apiClient.get("/tickets/automation/rules");
      return (res.data?.data ?? []) as AutomationRuleItem[];
    },
  });
}

export function useCreateAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AutomationRuleCreatePayload) => {
      const res = await apiClient.post("/tickets/automation/rules", data);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", "automation-rules"] });
    },
  });
}

export function useUpdateAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleId, data }: { ruleId: string; data: AutomationRuleUpdatePayload }) => {
      const res = await apiClient.put(`/tickets/automation/rules/${ruleId}`, data);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", "automation-rules"] });
    },
  });
}

export function useDeleteAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await apiClient.delete(`/tickets/automation/rules/${ruleId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", "automation-rules"] });
    },
  });
}

export function useRunAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleId, ticketId }: { ruleId: string; ticketId: string }) => {
      const res = await apiClient.post(`/tickets/automation/rules/${ruleId}/run/${ticketId}`);
      return res.data?.data ?? res.data;
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ["tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets", "automation-rules"] });
    },
  });
}

