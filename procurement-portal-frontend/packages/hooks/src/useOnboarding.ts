import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface OnboardingSession {
  id: string;
  org_id: string;
  initiated_by: string;
  current_step: number;
  completed_steps: number[];
  step_data: Record<string, any>;
  status: "IN_PROGRESS" | "COMPLETED";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingStepUpdateRequest {
  step: number;
  data: Record<string, any>;
  mark_step_completed?: boolean;
}

export interface OnboardingChecklistItem {
  key: string;
  title: string;
  description: string;
  is_completed: boolean;
}

export interface OnboardingChecklist {
  total_steps: number;
  completed_count: number;
  percent_complete: number;
  items: OnboardingChecklistItem[];
  is_ready_for_golive: boolean;
}

export function useOnboardingSession() {
  return useQuery({
    queryKey: ["onboarding-session"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: OnboardingSession }>("/onboarding/session");
      return res.data.data;
    },
  });
}

export function useSaveOnboardingStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: OnboardingStepUpdateRequest) => {
      const res = await apiClient.put<{ data: OnboardingSession }>("/onboarding/session/step", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-session"] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-checklist"] });
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ data: OnboardingSession }>("/onboarding/session/complete");
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-session"] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-checklist"] });
    },
  });
}

export function useOnboardingChecklist() {
  return useQuery({
    queryKey: ["onboarding-checklist"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: OnboardingChecklist }>("/onboarding/checklist");
      return res.data.data;
    },
  });
}
