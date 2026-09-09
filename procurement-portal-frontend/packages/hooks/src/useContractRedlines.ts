import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  ContractClause,
  ContractClauseInstance,
  ContractRedline,
  ContractEsignSession,
  ContractRedlineCreatePayload,
  ContractRedlineReviewPayload,
} from "@procurement/types";

export function useClauseLibrary(category?: string) {
  return useQuery({
    queryKey: ["contracts", "clauses", "library", category],
    queryFn: async () => {
      const res = await apiClient.get("/contracts/clauses/library", {
        params: category ? { category } : undefined,
      });
      return (res.data.data ?? []) as ContractClause[];
    },
  });
}

export function useCreateLibraryClause() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<ContractClause>) => {
      const res = await apiClient.post("/contracts/clauses/library", data);
      return res.data.data as ContractClause;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts", "clauses", "library"] });
    },
  });
}

export function useContractClauses(contractId: string) {
  return useQuery({
    queryKey: ["contracts", contractId, "clauses"],
    queryFn: async () => {
      const res = await apiClient.get(`/contracts/${contractId}/clauses`);
      return (res.data.data ?? []) as ContractClauseInstance[];
    },
    enabled: Boolean(contractId),
  });
}

export function useContractRedlines(contractId: string) {
  return useQuery({
    queryKey: ["contracts", contractId, "redlines"],
    queryFn: async () => {
      const res = await apiClient.get(`/contracts/${contractId}/redlines`);
      return (res.data.data ?? []) as ContractRedline[];
    },
    enabled: Boolean(contractId),
  });
}

export function useSubmitRedline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId,
      data,
    }: {
      contractId: string;
      data: ContractRedlineCreatePayload;
    }) => {
      const res = await apiClient.post(`/contracts/${contractId}/redlines`, data);
      return res.data.data as ContractRedline;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId, "redlines"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId, "clauses"] });
    },
  });
}

export function useReviewRedline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      redlineId,
      contractId,
      data,
    }: {
      redlineId: string;
      contractId: string;
      data: ContractRedlineReviewPayload;
    }) => {
      const res = await apiClient.post(`/contracts/redlines/${redlineId}/review`, data);
      return res.data.data as ContractRedline;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId, "redlines"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId, "clauses"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
    },
  });
}

export function useInitiateSigningCeremony() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId,
      signers,
    }: {
      contractId: string;
      signers?: Array<{ name: string; email: string; role: string }>;
    }) => {
      const res = await apiClient.post(`/contracts/${contractId}/ceremony/initiate`, { signers });
      return res.data.data as ContractEsignSession;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId, "ceremony"] });
    },
  });
}

export function useSubmitDigitalSignature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId,
      signerEmail,
      signatureToken,
    }: {
      contractId: string;
      signerEmail: string;
      signatureToken?: string;
    }) => {
      const res = await apiClient.post(`/contracts/${contractId}/ceremony/sign`, {
        signer_email: signerEmail,
        signature_token: signatureToken,
      });
      return res.data.data as ContractEsignSession;
    },
    onSuccess: (_, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
      queryClient.invalidateQueries({ queryKey: ["contracts", contractId, "ceremony"] });
    },
  });
}
