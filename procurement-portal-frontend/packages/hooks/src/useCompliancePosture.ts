import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  ComplianceAttestation,
  CompliancePolicy,
  ComplianceScan,
  ComplianceScanRunRequest,
} from "@procurement/types";

export function useComplianceLatest() {
  return useQuery({
    queryKey: ["compliance-latest"],
    queryFn: async () => {
      const res = await apiClient.get("/compliance/latest");
      return res.data.data as ComplianceScan;
    },
  });
}

export function useComplianceScans(limit: number = 20) {
  return useQuery({
    queryKey: ["compliance-scans", limit],
    queryFn: async () => {
      const res = await apiClient.get(`/compliance/scans?limit=${limit}`);
      return (res.data.data ?? []) as ComplianceScan[];
    },
  });
}

export function useComplianceScanDetail(scanId?: string) {
  return useQuery({
    queryKey: ["compliance-scan", scanId],
    queryFn: async () => {
      if (!scanId) return null;
      const res = await apiClient.get(`/compliance/scans/${scanId}`);
      return res.data.data as ComplianceScan;
    },
    enabled: !!scanId,
  });
}

export function useCompliancePolicies() {
  return useQuery({
    queryKey: ["compliance-policies"],
    queryFn: async () => {
      const res = await apiClient.get("/compliance/policies");
      return (res.data.data ?? []) as CompliancePolicy[];
    },
  });
}

export function useRunComplianceScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ComplianceScanRunRequest = {}) => {
      const res = await apiClient.post("/compliance/scan", payload);
      return res.data.data as ComplianceScan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-latest"] });
      queryClient.invalidateQueries({ queryKey: ["compliance-scans"] });
    },
  });
}

export function useToggleCompliancePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ policyId, isEnabled }: { policyId: string; isEnabled: boolean }) => {
      const res = await apiClient.patch(`/compliance/policies/${policyId}`, {
        is_enabled: isEnabled,
      });
      return res.data.data as CompliancePolicy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-policies"] });
    },
  });
}

export function useGenerateComplianceAttestation() {
  return useMutation({
    mutationFn: async (scanId: string) => {
      const res = await apiClient.post(`/compliance/scans/${scanId}/attestation`);
      return res.data.data as ComplianceAttestation;
    },
  });
}
