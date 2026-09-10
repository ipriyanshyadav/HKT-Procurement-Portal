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

export interface UomCreatePayload {
  code: string;
  name: string;
  iso_code?: string | null;
}

export interface UomUpdatePayload {
  name?: string;
  iso_code?: string | null;
  is_active?: boolean;
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

export interface CurrencyCreatePayload {
  code: string;
  name: string;
  symbol?: string;
  exchange_rate_to_base?: number | string;
  is_base_currency?: boolean;
}

export interface CurrencyUpdatePayload {
  name?: string;
  symbol?: string;
  exchange_rate_to_base?: number | string;
  is_active?: boolean;
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

export interface PaymentTermCreatePayload {
  code: string;
  name: string;
  net_days: number;
  discount_percentage?: number | string;
  discount_days?: number;
  description?: string | null;
}

export interface PaymentTermUpdatePayload {
  name?: string;
  net_days?: number;
  discount_percentage?: number | string;
  discount_days?: number;
  description?: string | null;
  is_active?: boolean;
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

export interface IncotermCreatePayload {
  code: string;
  name: string;
  edition_year?: number;
  risk_transfer_point: string;
}

export interface IncotermUpdatePayload {
  name?: string;
  edition_year?: number;
  risk_transfer_point?: string;
  is_active?: boolean;
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

export interface TaxCodeCreatePayload {
  code: string;
  name: string;
  rate: number | string;
  tax_type: string;
  hsn_chapter?: string | null;
}

export interface TaxCodeUpdatePayload {
  name?: string;
  rate?: number | string;
  tax_type?: string;
  hsn_chapter?: string | null;
  is_active?: boolean;
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

export interface LocationUpdatePayload {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_code?: string;
  plant_id?: string | null;
  is_active?: boolean;
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

export interface ItemMaster {
  id: string;
  org_id: string;
  code: string;
  name: string;
  description: string | null;
  category_id: string;
  uom_id: string;
  standard_price: number | string;
  currency: string;
  hsn_code: string | null;
  image_url: string | null;
  is_punchout: boolean;
  punchout_vendor_id: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ItemCreatePayload {
  code: string;
  name: string;
  description?: string | null;
  category_id: string;
  uom_id: string;
  standard_price?: number | string;
  currency?: string;
  hsn_code?: string | null;
  image_url?: string | null;
  is_punchout?: boolean;
  punchout_vendor_id?: string | null;
}

export interface ItemUpdatePayload {
  name?: string | null;
  description?: string | null;
  category_id?: string | null;
  uom_id?: string | null;
  standard_price?: number | string | null;
  currency?: string | null;
  hsn_code?: string | null;
  image_url?: string | null;
  is_punchout?: boolean | null;
  punchout_vendor_id?: string | null;
  is_active?: boolean | null;
}

export interface PunchOutSessionRequest {
  vendor_id?: string | null;
  return_url?: string | null;
}

export interface PunchOutSessionResponse {
  session_id: string;
  punchout_url: string;
  vendor_id?: string | null;
  expires_at: string;
  status: string;
}

export interface PunchOutCartItem {
  item_code: string;
  item_description: string;
  quantity: number;
  unit_price: number;
  currency: string;
  uom?: string;
  category_code?: string;
  vendor_part_number?: string;
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

export function useCreateUom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UomCreatePayload) => {
      const res = await apiClient.post<APIResponse<UomMaster>>("/master-data/uoms", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "uom"] });
    },
  });
}

export function useUpdateUom(defaultId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: UomUpdatePayload | { id: string; payload: UomUpdatePayload }) => {
      const targetId = "id" in vars ? vars.id : defaultId;
      const payload = "payload" in vars ? vars.payload : vars;
      if (!targetId) throw new Error("UOM ID is required");
      const res = await apiClient.put<APIResponse<UomMaster>>(`/master-data/uoms/${targetId}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "uom"] });
    },
  });
}

export function useDeleteUom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<APIResponse<{ message: string }>>(`/master-data/uoms/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "uom"] });
    },
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

export function useCreateCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CurrencyCreatePayload) => {
      const res = await apiClient.post<APIResponse<CurrencyMaster>>("/master-data/currencies", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "currencies"] });
    },
  });
}

export function useUpdateCurrency(defaultId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: CurrencyUpdatePayload | { id: string; payload: CurrencyUpdatePayload }) => {
      const targetId = "id" in vars ? vars.id : defaultId;
      const payload = "payload" in vars ? vars.payload : vars;
      if (!targetId) throw new Error("Currency ID is required");
      const res = await apiClient.put<APIResponse<CurrencyMaster>>(`/master-data/currencies/${targetId}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "currencies"] });
    },
  });
}

export function useDeleteCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<APIResponse<{ message: string }>>(`/master-data/currencies/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "currencies"] });
    },
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

export function useCreatePaymentTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PaymentTermCreatePayload) => {
      const res = await apiClient.post<APIResponse<PaymentTerm>>("/master-data/payment-terms", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "payment-terms"] });
    },
  });
}

export function useUpdatePaymentTerm(defaultId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: PaymentTermUpdatePayload | { id: string; payload: PaymentTermUpdatePayload }) => {
      const targetId = "id" in vars ? vars.id : defaultId;
      const payload = "payload" in vars ? vars.payload : vars;
      if (!targetId) throw new Error("Payment Term ID is required");
      const res = await apiClient.put<APIResponse<PaymentTerm>>(`/master-data/payment-terms/${targetId}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "payment-terms"] });
    },
  });
}

export function useDeletePaymentTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<APIResponse<{ message: string }>>(`/master-data/payment-terms/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "payment-terms"] });
    },
  });
}

// -----------------------------------------------------------------------------
// Incoterms Hooks
// -----------------------------------------------------------------------------

export function useIncoterms(params?: { active_only?: boolean }) {
  return useQuery({
    queryKey: ["master-data", "incoterms", params],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<Incoterm[]>>("/master-data/incoterms", {
        params: {
          active_only: params?.active_only ?? false,
        },
      });
      return res.data;
    },
    select: (res) => res.data,
    staleTime: MASTER_DATA_STALE_TIME,
  });
}

export function useCreateIncoterm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: IncotermCreatePayload) => {
      const res = await apiClient.post<APIResponse<Incoterm>>("/master-data/incoterms", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "incoterms"] });
    },
  });
}

export function useUpdateIncoterm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: IncotermUpdatePayload }) => {
      const res = await apiClient.put<APIResponse<Incoterm>>(`/master-data/incoterms/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "incoterms"] });
    },
  });
}

export function useDeleteIncoterm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<APIResponse<{ message: string }>>(`/master-data/incoterms/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "incoterms"] });
    },
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

export function useCreateTaxCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TaxCodeCreatePayload) => {
      const res = await apiClient.post<APIResponse<TaxCode>>("/master-data/tax-codes", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "tax-codes"] });
    },
  });
}

export function useUpdateTaxCode(defaultId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TaxCodeUpdatePayload | { id: string; payload: TaxCodeUpdatePayload }) => {
      const targetId = "id" in vars ? vars.id : defaultId;
      const payload = "payload" in vars ? vars.payload : vars;
      if (!targetId) throw new Error("Tax Code ID is required");
      const res = await apiClient.put<APIResponse<TaxCode>>(`/master-data/tax-codes/${targetId}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "tax-codes"] });
    },
  });
}

export function useDeleteTaxCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<APIResponse<{ message: string }>>(`/master-data/tax-codes/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "tax-codes"] });
    },
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

export function useUpdateLocation(defaultId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: LocationUpdatePayload | { id: string; payload: LocationUpdatePayload }) => {
      const targetId = "id" in vars ? vars.id : defaultId;
      const payload = "payload" in vars ? vars.payload : vars;
      if (!targetId) throw new Error("Location ID is required");
      const res = await apiClient.put<APIResponse<DeliveryLocation>>(`/master-data/delivery-locations/${targetId}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "delivery-locations"] });
    },
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<APIResponse<{ message: string }>>(`/master-data/delivery-locations/${id}`);
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

export function useDeleteHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<APIResponse<{ message: string }>>(`/master-data/holidays/${id}`);
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

export function useImportMasterDataEntity(entityType: string) {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post<APIResponse<{ job_id: string; status: string; message: string }>>(
        `/master-data/import/${entityType}`,
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
      try {
        const res = await apiClient.get<APIResponse<ImportJobStatus>>(`/master-data/import/jobs/${jobId}`);
        return res.data.data;
      } catch {
        const res = await apiClient.get<APIResponse<ImportJobStatus>>(`/master-data/import/categories/${jobId}`);
        return res.data.data;
      }
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

// -----------------------------------------------------------------------------
// Catalog Item & PunchOut Hooks
// -----------------------------------------------------------------------------

export function useCatalogItems(params?: {
  search?: string;
  category_id?: string;
  active_only?: boolean;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["master-data", "items", params],
    queryFn: async () => {
      const res = await apiClient.get<APIResponse<ItemMaster[]>>("/master-data/items", {
        params: {
          search: params?.search || undefined,
          category_id: params?.category_id || undefined,
          active_only: params?.active_only ?? true,
          page: params?.page ?? 1,
          page_size: params?.page_size ?? 50,
        },
      });
      return res.data.data;
    },
    staleTime: MASTER_DATA_STALE_TIME,
  });
}

export function useCatalogItem(id: string | null) {
  return useQuery({
    queryKey: ["master-data", "items", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<APIResponse<ItemMaster>>(`/master-data/items/${id}`);
      return res.data.data;
    },
    enabled: !!id,
    staleTime: MASTER_DATA_STALE_TIME,
  });
}

export function useCreateCatalogItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ItemCreatePayload) => {
      const res = await apiClient.post<APIResponse<ItemMaster>>("/master-data/items", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "items"] });
    },
  });
}

export function useUpdateCatalogItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ItemUpdatePayload }) => {
      const res = await apiClient.put<APIResponse<ItemMaster>>(`/master-data/items/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "items"] });
    },
  });
}

export function useDeleteCatalogItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<APIResponse<{ message: string }>>(`/master-data/items/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-data", "items"] });
    },
  });
}

export function usePunchOutSession() {
  return useMutation({
    mutationFn: async (payload: PunchOutSessionRequest) => {
      const res = await apiClient.post<APIResponse<PunchOutSessionResponse>>("/master-data/punchout/session", payload);
      return res.data.data;
    },
  });
}

export function usePunchOutCart() {
  return useMutation({
    mutationFn: async (items: PunchOutCartItem[]) => {
      const res = await apiClient.post<APIResponse<{ received_count: number; items: PunchOutCartItem[]; message: string }>>(
        "/master-data/punchout/cart",
        items
      );
      return res.data.data;
    },
  });
}

