import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  GrnResponse,
  GrnLineResponse,
  GrnCreateRequest,
  GrnLineCreate,
  QualityInspectionResponse,
  QualityInspectionCreate,
} from "@procurement/types";

export type {
  GrnResponse,
  GrnLineResponse,
  GrnCreateRequest,
  GrnLineCreate,
  QualityInspectionResponse,
  QualityInspectionCreate,
};

export interface GrnFilterParams {
  po_id?: string;
  vendor_id?: string;
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export function useGRNs(params?: GrnFilterParams) {
  return useQuery({
    queryKey: ["grn", params],
    queryFn: async () => {
      const res = await apiClient.get("/grn", { params });
      return (res.data.data ?? []) as GrnResponse[];
    },
  });
}

export function useGRN(id: string) {
  return useQuery({
    queryKey: ["grn", id],
    queryFn: async () => {
      const res = await apiClient.get(`/grn/${id}`);
      return res.data.data as GrnResponse;
    },
    enabled: Boolean(id),
  });
}

export function useCreateGRN() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GrnCreateRequest) => {
      const res = await apiClient.post("/grn", payload);
      return res.data.data as GrnResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grn"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function useConfirmGRN() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await apiClient.post(`/grn/${id}/confirm`, { notes });
      return res.data.data as GrnResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["grn", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["grn"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function useQualityInspection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: QualityInspectionCreate) => {
      const res = await apiClient.post("/grn/inspection", payload);
      return res.data.data as QualityInspectionResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grn"] });
    },
  });
}

export function useCancelGRN() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiClient.post(`/grn/${id}/cancel`, { reason });
      return res.data.data as GrnResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["grn", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["grn"] });
    },
  });
}
