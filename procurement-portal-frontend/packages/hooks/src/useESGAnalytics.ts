import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  CarbonFootprintResponse,
  CategoryEmissionFactorCreate,
  CategoryEmissionFactorItem,
  SupplierESGScorecardItem,
  SupplierESGScorecardUpdate,
} from "@procurement/types";

export function useCarbonFootprint() {
  return useQuery({
    queryKey: ["analytics", "esg", "footprint"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/esg/footprint");
      return res.data.data as CarbonFootprintResponse;
    },
    refetchInterval: 60000,
  });
}

export function useRecalculateCarbonFootprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/analytics/esg/recalculate");
      return res.data.data as CarbonFootprintResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics", "esg", "footprint"] });
    },
  });
}

export function useEmissionFactors() {
  return useQuery({
    queryKey: ["analytics", "esg", "emission-factors"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/esg/emission-factors");
      return (res.data.data ?? []) as CategoryEmissionFactorItem[];
    },
  });
}

export function useSaveEmissionFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CategoryEmissionFactorCreate) => {
      const res = await apiClient.post("/analytics/esg/emission-factors", payload);
      return res.data.data as CategoryEmissionFactorItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics", "esg", "emission-factors"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "esg", "footprint"] });
    },
  });
}

export function useSupplierESGScorecards() {
  return useQuery({
    queryKey: ["analytics", "esg", "supplier-scorecards"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/esg/supplier-scorecards");
      return (res.data.data ?? []) as SupplierESGScorecardItem[];
    },
  });
}

export function useUpdateSupplierESGScorecard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      vendorId,
      data,
    }: {
      vendorId: string;
      data: SupplierESGScorecardUpdate;
    }) => {
      const res = await apiClient.put(`/analytics/esg/supplier-scorecards/${vendorId}`, data);
      return res.data.data as SupplierESGScorecardItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics", "esg", "supplier-scorecards"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "esg", "footprint"] });
    },
  });
}
