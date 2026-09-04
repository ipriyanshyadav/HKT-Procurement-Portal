import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

// -----------------------------------------------------------------------------
// Data Types (matching backend responses exactly)
// -----------------------------------------------------------------------------

export interface Category {
  id: string;
  org_id: string;
  code: string;
  name: string;
  parent_id: string | null;
  level: number;
  path: string;
  unspsc_code: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryTreeNode {
  id: string;
  name: string;
  code: string;
  parent_id: string | null;
  level: number;
  path: string;
  is_active: boolean;
  unspsc_code: string | null;
  children: CategoryTreeNode[];
}

export interface CategoryCreatePayload {
  code: string;
  name: string;
  parent_id?: string | null;
  unspsc_code?: string | null;
}

export interface CategoryUpdatePayload {
  name?: string;
  unspsc_code?: string | null;
  is_active?: boolean;
}

export interface UomMaster {
  id: string;
  org_id: string;
  code: string;
  name: string;
  iso_code: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CurrencyMaster {
  id: string;
  org_id: string;
  code: string;
  name: string;
  symbol: string;
  exchange_rate_to_base: string | number;
  is_base_currency: boolean;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentTerm {
  id: string;
  org_id: string;
  code: string;
  name: string;
  net_days: number;
  discount_percentage: string | number;
  discount_days: number;
  description: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Incoterm {
  id: string;
  org_id: string;
  code: string;
  name: string;
  edition_year: number;
  risk_transfer_point: string;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TaxCode {
  id: string;
  org_id: string;
  code: string;
  name: string;
  rate: string | number;
  tax_type: string;
  hsn_chapter: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DeliveryLocation {
  id: string;
  org_id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  plant_id: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface LocationCreatePayload {
  code: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country_code?: string;
  plant_id?: string | null;
}

export interface HolidayMaster {
  id: string;
  org_id: string;
  name: string;
  holiday_date: string;
  plant_id: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface HolidayCreatePayload {
  name: string;
  holiday_date: string;
  plant_id?: string | null;
}

export interface ImportJobStatus {
  job_id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  response_payload?: {
    total_rows: number;
    success_count: number;
    error_count: number;
    errors?: Array<{ row: string; code: string; error: string }>;
  } | null;
  error_message?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
}

interface APIResponse<T> {
  data: T;
  meta?: unknown;
  links?: unknown;
  timestamp?: string;
}

// Master data changes rarely — 30 minutes cache time
const MASTER_DATA_STALE_TIME = 30 * 60 * 1000;

// -----------------------------------------------------------------------------
// Category Hooks
// -----------------------------------------------------------------------------

export function useCategories(params?: { flat?: boolean; active_only?: boolean }) {
  return useQuery({
    queryKey: ["master-data", "categories", params],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<Category[]>>("/master-data/categories", {
        params: { flat: params?.flat ?? true, active_only: params?.active_only ?? true },
      });
      return res.data;
    },
    select: (res) => res.data,
    staleTime: MASTER_DATA_STALE_TIME,
  });
}

export function useCategoryTree(rootId?: string) {
  return useQuery({
    queryKey: ["master-data", "category-tree", rootId],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<CategoryTreeNode[]>>("/master-data/categories/tree", {
        params: rootId ? { root_id: rootId } : undefined,
      });
      return res.data;
    },
    select: (res) => res.data,
    staleTime: MASTER_DATA_STALE_TIME,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CategoryCreatePayload) => {
      const res = await apiClient.post<APIResponse<Category>>("/master-data/categories", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["master-data", "category-tree"] });
    },
  });
}

export function useUpdateCategory(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CategoryUpdatePayload) => {
      const res = await apiClient.put<APIResponse<Category>>(`/master-data/categories/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["master-data", "category-tree"] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<APIResponse<{ message: string }>>(`/master-data/categories/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["master-data", "category-tree"] });
    },
  });
}

// -----------------------------------------------------------------------------
// UOM Hooks
// -----------------------------------------------------------------------------

export function useUoms(params?: { active_only?: boolean }) {
  return useQuery({
    queryKey: ["master-data", "uom", params],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<UomMaster[]>>("/master-data/uom", {
        params: { active_only: params?.active_only ?? true },
      });
      return res.data;
    },
    select: (res) => res.data,
    staleTime: MASTER_DATA_STALE_TIME,
  });
}

// -----------------------------------------------------------------------------
// Currency Hooks
// -----------------------------------------------------------------------------

export function useCurrencies(params?: { include_rates?: boolean; active_only?: boolean }) {
  return useQuery({
    queryKey: ["master-data", "currencies", params],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<CurrencyMaster[]>>("/master-data/currencies", {
        params: {
          include_rates: params?.include_rates ?? false,
          active_only: params?.active_only ?? true,
        },
      });
      return res.data;
    },
    select: (res) => res.data,
    staleTime: MASTER_DATA_STALE_TIME,
  });
}

// -----------------------------------------------------------------------------
// Payment Terms Hooks
// -----------------------------------------------------------------------------

export function usePaymentTerms(params?: { active_only?: boolean }) {
  return useQuery({
    queryKey: ["master-data", "payment-terms", params],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<PaymentTerm[]>>("/master-data/payment-terms", {
        params: { active_only: params?.active_only ?? true },
      });
      return res.data;
    },
    select: (res) => res.data,
    staleTime: MASTER_DATA_STALE_TIME,
  });
}

// -----------------------------------------------------------------------------
// Incoterms Hooks
// -----------------------------------------------------------------------------

export function useIncoterms() {
  return useQuery({
    queryKey: ["master-data", "incoterms"],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<Incoterm[]>>("/master-data/incoterms");
      return res.data;
    },
    select: (res) => res.data,
    staleTime: MASTER_DATA_STALE_TIME,
  });
}

// -----------------------------------------------------------------------------
// Tax Code Hooks
// -----------------------------------------------------------------------------

export function useTaxCodes(params?: { tax_type?: string; active_only?: boolean }) {
  return useQuery({
    queryKey: ["master-data", "tax-codes", params],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<TaxCode[]>>("/master-data/tax-codes", {
        params: {
          tax_type: params?.tax_type,
          active_only: params?.active_only ?? true,
        },
      });
      return res.data;
    },
    select: (res) => res.data,
    staleTime: MASTER_DATA_STALE_TIME,
  });
}

// -----------------------------------------------------------------------------
// Delivery Location Hooks
// -----------------------------------------------------------------------------

export function useDeliveryLocations(params?: { active_only?: boolean; country_code?: string }) {
  return useQuery({
    queryKey: ["master-data", "delivery-locations", params],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<DeliveryLocation[]>>("/master-data/delivery-locations", {
        params: {
          active_only: params?.active_only ?? true,
          country_code: params?.country_code,
        },
      });
      return res.data;
    },
    select: (res) => res.data,
    staleTime: MASTER_DATA_STALE_TIME,
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LocationCreatePayload) => {
      const res = await apiClient.post<APIResponse<DeliveryLocation>>("/master-data/delivery-locations", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "delivery-locations"] });
    },
  });
}

// -----------------------------------------------------------------------------
// Holiday Hooks
// -----------------------------------------------------------------------------

export function useHolidays(year: number) {
  return useQuery({
    queryKey: ["master-data", "holidays", year],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<HolidayMaster[]>>(`/master-data/holidays/${year}`);
      return res.data;
    },
    select: (res) => res.data,
    staleTime: MASTER_DATA_STALE_TIME,
  });
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: HolidayCreatePayload) => {
      const res = await apiClient.post<APIResponse<HolidayMaster>>("/master-data/holidays", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "holidays"] });
    },
  });
}

// -----------------------------------------------------------------------------
// Import Hooks
// -----------------------------------------------------------------------------

export function useImportCategories() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post<APIResponse<{ job_id: string; status: string; message: string }>>(
        "/master-data/import/categories",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return res.data.data;
    },
  });
}

export function useImportJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ["master-data", "import-job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const res = await apiClient.get<APIResponse<ImportJobStatus>>(`/master-data/import/categories/${jobId}`);
      return res.data.data;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "PENDING" || status === "RUNNING") {
        return 2000;
      }
      return false;
    },
  });
}
