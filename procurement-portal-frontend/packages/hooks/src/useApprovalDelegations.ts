import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  DelegationRuleCreateRequest,
  DelegationRuleResponse,
} from "@procurement/types";

export function useMyDelegations() {
  return useQuery({
    queryKey: ["users", "me", "delegations"],
    queryFn: async () => {
      const res = await apiClient.get("/users/me/delegations");
      return (res.data.data ?? []) as DelegationRuleResponse[];
    },
    refetchInterval: 30000,
  });
}

export function useOrgDelegationMatrix() {
  return useQuery({
    queryKey: ["users", "delegations", "matrix"],
    queryFn: async () => {
      const res = await apiClient.get("/users/delegations/matrix");
      return (res.data.data ?? []) as DelegationRuleResponse[];
    },
    refetchInterval: 30000,
  });
}

export function useCreateDelegation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DelegationRuleCreateRequest) => {
      const res = await apiClient.post("/users/me/delegations", payload);
      return res.data.data as DelegationRuleResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "me", "delegations"] });
      queryClient.invalidateQueries({ queryKey: ["users", "delegations", "matrix"] });
    },
  });
}

export function useRevokeDelegation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await apiClient.delete(`/users/me/delegations/${ruleId}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "me", "delegations"] });
      queryClient.invalidateQueries({ queryKey: ["users", "delegations", "matrix"] });
    },
  });
}

// Backward-compatible aliases for legacy tasks inbox
export const useDeleteDelegation = useRevokeDelegation;
export type DelegationRule = DelegationRuleResponse;
export type DelegationCreatePayload = DelegationRuleCreateRequest;
