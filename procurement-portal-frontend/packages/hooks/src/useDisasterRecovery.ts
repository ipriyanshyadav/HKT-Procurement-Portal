import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  DRBackupCheckpoint,
  DRFailoverDrill,
  DRPostureMetrics,
  RunFailoverDrillPayload,
  TriggerPITRSnapshotPayload,
} from "@procurement/types";

export function useDRPosture() {
  return useQuery({
    queryKey: ["disaster-recovery", "posture"],
    queryFn: async () => {
      const res = await apiClient.get("/disaster-recovery/posture");
      return res.data.data as DRPostureMetrics;
    },
    refetchInterval: 30000,
  });
}

export function useDRCheckpoints(checkpointType?: string, status?: string) {
  return useQuery({
    queryKey: ["disaster-recovery", "checkpoints", checkpointType, status],
    queryFn: async () => {
      const res = await apiClient.get("/disaster-recovery/checkpoints", {
        params: {
          checkpoint_type: checkpointType || undefined,
          status: status || undefined,
          limit: 50,
        },
      });
      return (res.data.data ?? []) as DRBackupCheckpoint[];
    },
  });
}

export function useDRDrills() {
  return useQuery({
    queryKey: ["disaster-recovery", "drills"],
    queryFn: async () => {
      const res = await apiClient.get("/disaster-recovery/drills", {
        params: { limit: 50 },
      });
      return (res.data.data ?? []) as DRFailoverDrill[];
    },
  });
}

export function useDRDrillDetail(drillId?: string) {
  return useQuery({
    queryKey: ["disaster-recovery", "drills", drillId],
    queryFn: async () => {
      const res = await apiClient.get(`/disaster-recovery/drills/${drillId}`);
      return res.data.data as DRFailoverDrill;
    },
    enabled: Boolean(drillId),
  });
}

export function useTriggerPITRSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TriggerPITRSnapshotPayload) => {
      const res = await apiClient.post("/disaster-recovery/checkpoints/snapshot", payload);
      return res.data.data as DRBackupCheckpoint;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disaster-recovery", "checkpoints"] });
      queryClient.invalidateQueries({ queryKey: ["disaster-recovery", "posture"] });
    },
  });
}

export function useVerifyCheckpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (checkpointId: string) => {
      const res = await apiClient.post(`/disaster-recovery/checkpoints/${checkpointId}/verify`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disaster-recovery", "checkpoints"] });
      queryClient.invalidateQueries({ queryKey: ["disaster-recovery", "posture"] });
    },
  });
}

export function useRunFailoverDrill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RunFailoverDrillPayload) => {
      const res = await apiClient.post("/disaster-recovery/drills/run", payload);
      return res.data.data as DRFailoverDrill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disaster-recovery", "drills"] });
      queryClient.invalidateQueries({ queryKey: ["disaster-recovery", "posture"] });
    },
  });
}
