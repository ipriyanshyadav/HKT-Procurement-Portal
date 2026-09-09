import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  VendorSelfRegistrationPayload,
  VendorKYCReviewPayload,
  VendorOnboardingApplication,
} from "@procurement/types";

export function usePendingOnboardingApplications(skip = 0, limit = 50) {
  return useQuery({
    queryKey: ["vendors", "onboarding", "pending", skip, limit],
    queryFn: async () => {
      const res = await apiClient.get("/vendors/onboarding/pending", {
        params: { skip, limit },
      });
      return (res.data.data ?? []) as VendorOnboardingApplication[];
    },
    refetchInterval: 30000,
  });
}

export function useSelfRegisterVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: VendorSelfRegistrationPayload) => {
      const res = await apiClient.post("/vendors/self-register", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors", "onboarding"] });
    },
  });
}

export function useReviewOnboardingApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      appId,
      payload,
    }: {
      appId: string;
      payload: VendorKYCReviewPayload;
    }) => {
      const res = await apiClient.post(`/vendors/onboarding/${appId}/review`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors", "onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}
