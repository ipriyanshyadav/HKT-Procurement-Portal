import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface BuyerActivitySummary {
  user_id: string;
  full_name: string;
  total_actions: number;
  prs_created: number;
  pos_processed: number;
  tickets_raised: number;
  avg_turnaround_hours: number;
}

export interface HeatmapDataPoint {
  day_of_week: number; // 0=Monday, 6=Sunday
  hour_of_day: number; // 0..23
  count: number;
}

export interface HeatmapResponse {
  matrix: HeatmapDataPoint[];
  total_actions: number;
  peak_day: string;
  peak_hour: number;
}

export interface BuyerPerformanceRow {
  rank: number;
  buyer_id: string;
  buyer_name: string;
  prs_created: number;
  prs_approved: number;
  avg_approval_hours: number;
  tickets_raised: number;
  sla_compliance_rate: number;
}

export interface ProcurementVelocityBucket {
  bucket_label: string;
  count: number;
  percentage: number;
}

export interface ProcurementVelocityResponse {
  avg_cycle_days: number;
  median_cycle_days: number;
  distribution: ProcurementVelocityBucket[];
}

export interface BottleneckStep {
  step_name: string;
  avg_duration_hours: number;
  max_duration_hours: number;
  delayed_count: number;
}

export interface SessionSecurityAnalytics {
  active_users_today: number;
  dormant_users_30d: number;
  concurrent_sessions_peak: number;
  failed_login_attempts_today: number;
}

export function useBuyerActivitySummary(userId?: string) {
  return useQuery({
    queryKey: ["analytics", "buyer-activity", userId ?? "me"],
    queryFn: async () => {
      const endpoint = userId
        ? `/analytics/buyer-activity/${userId}`
        : "/analytics/buyer-activity";
      const res = await apiClient.get(endpoint);
      return (res.data.data ?? null) as BuyerActivitySummary | null;
    },
  });
}

export function useActivityHeatmap() {
  return useQuery({
    queryKey: ["analytics", "buyer-activity", "heatmap"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/buyer-activity/heatmap");
      return (res.data.data ?? {
        matrix: [],
        total_actions: 0,
        peak_day: "Monday",
        peak_hour: 14,
      }) as HeatmapResponse;
    },
  });
}

export function useBuyerLeagueTable() {
  return useQuery({
    queryKey: ["analytics", "buyer-activity", "users"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/buyer-activity/users");
      return (res.data.data ?? []) as BuyerPerformanceRow[];
    },
  });
}

export function useSessionSecurityAnalytics() {
  return useQuery({
    queryKey: ["analytics", "buyer-activity", "sessions"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/buyer-activity/sessions");
      return (res.data.data ?? {
        active_users_today: 0,
        dormant_users_30d: 0,
        concurrent_sessions_peak: 0,
        failed_login_attempts_today: 0,
      }) as SessionSecurityAnalytics;
    },
  });
}

export function useProcurementVelocity() {
  return useQuery({
    queryKey: ["analytics", "procurement-velocity"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/procurement-velocity");
      return (res.data.data ?? {
        avg_cycle_days: 0,
        median_cycle_days: 0,
        distribution: [],
      }) as ProcurementVelocityResponse;
    },
  });
}

export function useBottlenecks() {
  return useQuery({
    queryKey: ["analytics", "bottlenecks"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/bottlenecks");
      return (res.data.data ?? []) as BottleneckStep[];
    },
  });
}
