import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  AsnCreateRequest,
  AsnDispatchPayload,
  AsnFastGrnRequest,
  AsnLineCreate,
  AsnLineResponse,
  AsnResponse,
  GrnResponse,
} from "@procurement/types";

export type {
  AsnCreateRequest,
  AsnDispatchPayload,
  AsnFastGrnRequest,
  AsnLineCreate,
  AsnLineResponse,
  AsnResponse,
};

export interface AsnFilterParams {
  po_id?: string;
  vendor_id?: string;
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export function useAsns(params?: AsnFilterParams) {
  return useQuery({
    queryKey: ["asns", params],
    queryFn: async () => {
      const res = await apiClient.get("/asns", { params });
      return (res.data.data ?? []) as AsnResponse[];
    },
  });
}

export function useAsn(id: string) {
  return useQuery({
    queryKey: ["asns", id],
    queryFn: async () => {
      const res = await apiClient.get(`/asns/${id}`);
      return res.data.data as AsnResponse;
    },
    enabled: Boolean(id),
  });
}

export function useCreateAsn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AsnCreateRequest) => {
      const res = await apiClient.post("/asns", payload);
      return res.data.data as AsnResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asns"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function useDispatchAsn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AsnDispatchPayload }) => {
      const res = await apiClient.post(`/asns/${id}/dispatch`, payload);
      return res.data.data as AsnResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["asns", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["asns"] });
    },
  });
}

export function useScanLookupAsn() {
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await apiClient.post("/asns/scan-lookup", { code });
      return res.data.data as AsnResponse;
    },
  });
}

export function useFastGrnIntake() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AsnFastGrnRequest }) => {
      const res = await apiClient.post(`/asns/${id}/fast-grn`, payload);
      return res.data.data as { asn: AsnResponse; grn: GrnResponse };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["asns", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["asns"] });
      queryClient.invalidateQueries({ queryKey: ["grn"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}
