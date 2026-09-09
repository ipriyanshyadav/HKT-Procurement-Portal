import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type { MaverickClusterResponse } from "@procurement/types";

export function useMaverickClusters(status?: string, clusterType?: string) {
  return useQuery({
    queryKey: ["analytics", "maverick-clusters", status, clusterType],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/maverick-spend/clusters", {
        params: { status, cluster_type: clusterType },
      });
      return (res.data.data ?? {
        total_clusters: 0,
        critical_count: 0,
        high_count: 0,
        total_leaked_spend: 0,
        projected_savings_recovery: 0,
        clusters: [],
      }) as MaverickClusterResponse;
    },
    refetchInterval: 30000,
  });
}

export function useDetectMaverickAnomalies() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/analytics/maverick-spend/detect-anomalies");
      return res.data.data as MaverickClusterResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics", "maverick-clusters"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "maverick-spend"] });
    },
  });
}

export function useUpdateMaverickClusterStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clusterId,
      status,
      notes,
    }: {
      clusterId: string;
      status: string;
      notes?: string;
    }) => {
      const res = await apiClient.post(`/analytics/maverick-spend/clusters/${clusterId}/status`, {
        status,
        notes,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics", "maverick-clusters"] });
    },
  });
}
