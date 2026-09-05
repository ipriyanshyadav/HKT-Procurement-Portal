import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@procurement/utils";

export interface HealthCheckData {
  status: "ok" | "degraded" | "failed";
  checks: Record<string, string>;
  timestamp: string;
  latencyMs?: number;
}

export function useSystemHealth(pollingInterval: number = 5000, enabled: boolean = true) {
  return useQuery<HealthCheckData>({
    queryKey: ["system-health-ready"],
    queryFn: async () => {
      const startTime = performance.now();
      try {
        const response = await fetch(`${API_URL}/health/ready`, {
          headers: { Accept: "application/json" },
        });
        const duration = Math.round(performance.now() - startTime);
        const data = await response.json();
        return {
          status: data.status || (response.ok ? "ok" : "degraded"),
          checks: data.checks || {},
          timestamp: data.timestamp || new Date().toISOString(),
          latencyMs: duration,
        };
      } catch (err: any) {
        const duration = Math.round(performance.now() - startTime);
        return {
          status: "failed",
          checks: {
            api: "unreachable",
            error: err.message || "Connection refused",
          },
          timestamp: new Date().toISOString(),
          latencyMs: duration,
        };
      }
    },
    refetchInterval: enabled ? pollingInterval : false,
    refetchOnWindowFocus: true,
  });
}
