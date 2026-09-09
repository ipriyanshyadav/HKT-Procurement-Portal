import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type { components } from "@procurement/types";

export type Contract = components["schemas"]["ContractResponse"];
export type ContractList = components["schemas"]["ContractListResponse"];
export type ContractLine = components["schemas"]["ContractLineResponse"];
export type ContractMilestone = components["schemas"]["ContractMilestoneResponse"];
export type ContractAmendment = components["schemas"]["ContractAmendmentResponse"];
export type ContractTemplate = components["schemas"]["ContractTemplateResponse"];
export type ContractCreateRequest = components["schemas"]["ContractCreateRequest"];
export type ContractFromAwardRequest = components["schemas"]["ContractFromAwardRequest"];
export type ContractAmendRequest = components["schemas"]["ContractAmendRequest"];
export type EsignInitiateRequest = components["schemas"]["EsignInitiateRequest"];
export type EsignInitiateResponse = components["schemas"]["EsignInitiateResponse"];
export type ContractMilestoneUpdate = components["schemas"]["ContractMilestoneUpdate"];
export type ContractUtilizationUpdateRequest = components["schemas"]["ContractUtilizationUpdateRequest"];

export interface ContractFilterParams {
  status?: string;
  vendor_id?: string;
  expiring_within_days?: number;
  search?: string;
  page?: number;
  page_size?: number;
}

export function useContracts(params?: ContractFilterParams) {
  return useQuery({
    queryKey: ["contracts", params],
    queryFn: async () => {
      const res = await apiClient.get("/contracts", { params });
      return (res.data.data ?? []) as Contract[];
    },
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: ["contracts", id],
    queryFn: async () => {
      const res = await apiClient.get(`/contracts/${id}`);
      return res.data.data as Contract;
    },
    enabled: Boolean(id),
  });
}

export function useContractTemplates() {
  return useQuery({
    queryKey: ["contracts", "templates"],
    queryFn: async () => {
      const res = await apiClient.get("/contracts/templates");
      return (res.data.data ?? []) as ContractTemplate[];
    },
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ContractCreateRequest) => {
      const res = await apiClient.post("/contracts", data);
      return res.data.data as Contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useCreateContractFromAward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ContractFromAwardRequest) => {
      const res = await apiClient.post("/contracts/from-award", data);
      return res.data.data as Contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useSubmitContractForReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, comment }: { contractId: string; comment?: string }) => {
      const res = await apiClient.post(`/contracts/${contractId}/submit-review`, { comment });
      return res.data.data as Contract;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

export function useApproveContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, comment }: { contractId: string; comment?: string }) => {
      const res = await apiClient.post(`/contracts/${contractId}/approve`, { comment });
      return res.data.data as Contract;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

export function useReturnContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, reason }: { contractId: string; reason: string }) => {
      const res = await apiClient.post(`/contracts/${contractId}/return`, { reason });
      return res.data.data as Contract;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

export function useInitiateContractEsign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId,
      data,
    }: {
      contractId: string;
      data?: EsignInitiateRequest;
    }) => {
      const res = await apiClient.post(`/contracts/${contractId}/initiate-esign`, data ?? {});
      return res.data.data as EsignInitiateResponse;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

export function useConfirmContractEsign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId,
      signedDocumentId,
    }: {
      contractId: string;
      signedDocumentId?: string;
    }) => {
      const res = await apiClient.post(`/contracts/${contractId}/confirm-esign`, {
        signed_document_id: signedDocumentId,
      });
      return res.data.data as Contract;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

export function useAmendContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId,
      data,
    }: {
      contractId: string;
      data: ContractAmendRequest;
    }) => {
      const res = await apiClient.post(`/contracts/${contractId}/amend`, data);
      return res.data.data as Contract;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

export function useCompleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      milestoneId,
      contractId,
      data,
    }: {
      milestoneId: string;
      contractId: string;
      data?: ContractMilestoneUpdate;
    }) => {
      const res = await apiClient.post(
        `/contracts/milestones/${milestoneId}/complete`,
        data ?? { status: "COMPLETED" }
      );
      return res.data.data as ContractMilestone;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

export function useUpdateContractUtilization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId,
      data,
    }: {
      contractId: string;
      data: ContractUtilizationUpdateRequest;
    }) => {
      const res = await apiClient.post(`/contracts/${contractId}/utilization`, data);
      return res.data.data as Contract;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

export function useActivateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, notes }: { contractId: string; notes?: string }) => {
      const res = await apiClient.post(`/contracts/${contractId}/activate`, { notes });
      return res.data.data as Contract;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

export function useTerminateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, reason }: { contractId: string; reason: string }) => {
      const res = await apiClient.post(`/contracts/${contractId}/terminate`, { reason });
      return res.data.data as Contract;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId,
      data,
    }: {
      contractId: string;
      data: {
        title: string;
        description?: string;
        due_date: string;
        responsible_party: "BUYER" | "SUPPLIER" | "VENDOR" | "BOTH" | string;
        milestone_weight?: number;
      };
    }) => {
      const res = await apiClient.post(`/contracts/${contractId}/milestones`, data);
      return res.data.data as ContractMilestone;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

export function useAddContractLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId,
      data,
    }: {
      contractId: string;
      data: {
        line_number: number;
        item_description: string;
        uom_id: string;
        contracted_quantity?: number;
        unit_rate: number;
        hsn_code?: string;
      };
    }) => {
      const res = await apiClient.post(`/contracts/${contractId}/lines`, data);
      return res.data.data as ContractLine;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

export function useDeleteContractLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId,
      lineId,
    }: {
      contractId: string;
      lineId: string;
    }) => {
      const res = await apiClient.delete(`/contracts/${contractId}/lines/${lineId}`);
      return res.data.data;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

