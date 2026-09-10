import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import type {
  BusinessUnitCreateRequest,
  BusinessUnitResponse,
  BusinessUnitUpdateRequest,
  CostCenterCreateRequest,
  CostCenterResponse,
  CostCenterUpdateRequest,
  DepartmentCreateRequest,
  DepartmentResponse,
  DepartmentUpdateRequest,
  LegalEntityCreateRequest,
  LegalEntityResponse,
  LegalEntityUpdateRequest,
  OrganizationResponse,
  OrganizationUpdateRequest,
  PlantCreateRequest,
  PlantResponse,
  PlantUpdateRequest,
} from "@procurement/types";

export type {
  BusinessUnitResponse,
  BusinessUnitCreateRequest,
  BusinessUnitUpdateRequest,
  BusinessUnitResponse as BusinessUnit,
  CostCenterResponse,
  CostCenterCreateRequest,
  CostCenterUpdateRequest,
  CostCenterResponse as CostCenter,
  DepartmentResponse,
  DepartmentCreateRequest,
  DepartmentUpdateRequest,
  DepartmentResponse as Department,
  LegalEntityResponse,
  LegalEntityCreateRequest,
  LegalEntityUpdateRequest,
  LegalEntityResponse as LegalEntity,
  OrganizationResponse,
  OrganizationUpdateRequest,
  OrganizationResponse as Organization,
  PlantResponse,
  PlantCreateRequest,
  PlantUpdateRequest,
  PlantResponse as Plant,
};

interface APIResponse<T> {
  data: T;
  meta?: unknown;
  links?: unknown;
  timestamp?: string;
}

const ORG_STALE_TIME = 1000 * 60 * 5; // 5 minutes

// ============================================================================
// Organization Profile
// ============================================================================

export function useOrganizationProfile() {
  return useQuery({
    queryKey: ["organization", "profile"],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<OrganizationResponse>>("/organization");
      return res.data;
    },
    select: (res) => res.data,
    staleTime: ORG_STALE_TIME,
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: OrganizationUpdateRequest) => {
      const res = await apiClient.patch<APIResponse<OrganizationResponse>>("/organization", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "profile"] });
    },
  });
}

// ============================================================================
// Legal Entities
// ============================================================================

export function useLegalEntities() {
  return useQuery({
    queryKey: ["organization", "legal-entities"],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<LegalEntityResponse[]>>("/legal-entities");
      return res.data;
    },
    select: (res) => res.data,
    staleTime: ORG_STALE_TIME,
  });
}

export function useCreateLegalEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LegalEntityCreateRequest) => {
      const res = await apiClient.post<APIResponse<LegalEntityResponse>>("/legal-entities", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "legal-entities"] });
    },
  });
}

export function useUpdateLegalEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: LegalEntityUpdateRequest }) => {
      const res = await apiClient.put<APIResponse<LegalEntityResponse>>(`/legal-entities/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "legal-entities"] });
    },
  });
}

export function useDeleteLegalEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<APIResponse<{ deleted: boolean; id: string }>>(`/legal-entities/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "legal-entities"] });
    },
  });
}

// ============================================================================
// Business Units
// ============================================================================

export function useBusinessUnits(params?: { active_only?: boolean; legal_entity_id?: string }) {
  return useQuery({
    queryKey: ["organization", "business-units", params],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<BusinessUnitResponse[]>>("/business-units", {
        params: {
          active_only: params?.active_only ?? true,
          legal_entity_id: params?.legal_entity_id,
        },
      });
      return res.data;
    },
    select: (res) => res.data,
    staleTime: ORG_STALE_TIME,
  });
}

export function useCreateBusinessUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BusinessUnitCreateRequest) => {
      const res = await apiClient.post<APIResponse<BusinessUnitResponse>>("/business-units", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "business-units"] });
    },
  });
}

export function useUpdateBusinessUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: BusinessUnitUpdateRequest }) => {
      const res = await apiClient.put<APIResponse<BusinessUnitResponse>>(`/business-units/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "business-units"] });
    },
  });
}

export function useDeleteBusinessUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<APIResponse<{ deleted: boolean; id: string }>>(`/business-units/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "business-units"] });
    },
  });
}

// ============================================================================
// Plants
// ============================================================================

export function usePlants(params?: { business_unit_id?: string; active_only?: boolean }) {
  return useQuery({
    queryKey: ["organization", "plants", params],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<PlantResponse[]>>("/plants", {
        params: {
          business_unit_id: params?.business_unit_id,
          active_only: params?.active_only ?? true,
        },
      });
      return res.data;
    },
    select: (res) => res.data,
    staleTime: ORG_STALE_TIME,
  });
}

export function useCreatePlant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PlantCreateRequest) => {
      const res = await apiClient.post<APIResponse<PlantResponse>>("/plants", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "plants"] });
      queryClient.invalidateQueries({ queryKey: ["master-data", "locations"] });
    },
  });
}

export function useUpdatePlant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: PlantUpdateRequest }) => {
      const res = await apiClient.put<APIResponse<PlantResponse>>(`/plants/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "plants"] });
      queryClient.invalidateQueries({ queryKey: ["master-data", "locations"] });
    },
  });
}

export function useDeletePlant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<APIResponse<{ deleted: boolean; id: string }>>(`/plants/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "plants"] });
    },
  });
}

// ============================================================================
// Departments
// ============================================================================

export function useDepartments(params?: { business_unit_id?: string; active_only?: boolean }) {
  return useQuery({
    queryKey: ["organization", "departments", params],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<DepartmentResponse[]>>("/departments", {
        params: {
          business_unit_id: params?.business_unit_id,
          active_only: params?.active_only ?? true,
        },
      });
      return res.data;
    },
    select: (res) => res.data,
    staleTime: ORG_STALE_TIME,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DepartmentCreateRequest) => {
      const res = await apiClient.post<APIResponse<DepartmentResponse>>("/departments", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "departments"] });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: DepartmentUpdateRequest }) => {
      const res = await apiClient.put<APIResponse<DepartmentResponse>>(`/departments/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "departments"] });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<APIResponse<{ deleted: boolean; id: string }>>(`/departments/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "departments"] });
    },
  });
}

// ============================================================================
// Cost Centers
// ============================================================================

export function useCostCenters(params?: { business_unit_id?: string; active_only?: boolean }) {
  return useQuery({
    queryKey: ["organization", "cost-centers", params],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<CostCenterResponse[]>>("/cost-centers", {
        params: {
          business_unit_id: params?.business_unit_id,
          active_only: params?.active_only ?? true,
        },
      });
      return res.data;
    },
    select: (res) => res.data,
    staleTime: ORG_STALE_TIME,
  });
}

export function useCreateCostCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CostCenterCreateRequest) => {
      const res = await apiClient.post<APIResponse<CostCenterResponse>>("/cost-centers", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "cost-centers"] });
    },
  });
}

export function useUpdateCostCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: CostCenterUpdateRequest }) => {
      const res = await apiClient.put<APIResponse<CostCenterResponse>>(`/cost-centers/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "cost-centers"] });
    },
  });
}

export function useDeleteCostCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<APIResponse<{ deleted: boolean; id: string }>>(`/cost-centers/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "cost-centers"] });
    },
  });
}

