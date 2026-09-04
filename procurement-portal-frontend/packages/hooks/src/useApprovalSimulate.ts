import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface SimulateRequest {
  template_code: string;
  entity_context: Record<string, unknown>;
}

export interface SimulateApprover {
  id: string;
  name: string;
  role: string | null;
}

export interface SimulateChainStep {
  step_number: number;
  step_name: string | null;
  step_type: string | null;
  approvers: SimulateApprover[] | null;
  sla_hours: number | null;
  convergence: string | null;
  condition_met: boolean;
  condition_expression: string | null;
}

export interface SimulateResponse {
  chain: SimulateChainStep[];
}

/**
 * Calls POST /workflows/simulate — read-only, zero DB writes.
 * Returns the expected approval chain for a template + entity context.
 */
export function useApprovalSimulate() {
  return useMutation({
    mutationFn: async (payload: SimulateRequest): Promise<SimulateResponse> => {
      const res = await apiClient.post<SimulateResponse>("/workflows/simulate", payload);
      // Simulate endpoint returns chain directly (not wrapped in data envelope)
      return res.data;
    },
  });
}
