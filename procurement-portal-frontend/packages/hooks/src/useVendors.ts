import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface Vendor {
  id: string;
  org_id: string;
  vendor_code: string | null;
  company_name: string;
  legal_name: string | null;
  registration_type: string;
  pan: string | null;
  gstin: string | null;
  cin: string | null;
  duns_number: string | null;
  website: string | null;
  primary_email: string;
  primary_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country_code: string;
  status:
    | "INVITED"
    | "REGISTRATION_IN_PROGRESS"
    | "SUBMITTED"
    | "UNDER_REVIEW"
    | "RESUBMISSION_REQUESTED"
    | "QUALIFIED"
    | "ACTIVE"
    | "SUSPENDED"
    | "COMPLIANCE_HOLD"
    | "BLACKLISTED"
    | "DEACTIVATED";
  erp_vendor_code: string | null;
  erp_sync_status: string | null;
  onboarding_step: number;
  submitted_at: string | null;
  qualified_at: string | null;
  activated_at: string | null;
  blacklisted_at: string | null;
  blacklist_reason: string | null;
  suspension_reason: string | null;
  compliance_score: number | null;
  performance_score: number | null;
  last_scorecard_at: string | null;
  created_at: string;
  updated_at: string;
  invitation_token_raw?: string;
}

export interface VendorContact {
  id: string;
  vendor_id: string;
  name: string;
  designation: string | null;
  email: string;
  phone: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
}

export interface VendorBankAccount {
  id: string;
  vendor_id: string;
  account_holder_name: string;
  bank_name: string;
  branch_name: string | null;
  account_number_masked: string | null;
  ifsc_code: string;
  swift_code: string | null;
  is_primary: boolean;
  penny_test_status: string;
  penny_test_reference: string | null;
  penny_test_initiated_at: string | null;
  penny_test_validated_at: string | null;
}

export interface VendorDocument {
  id: string;
  vendor_id: string;
  document_id: string;
  document_type_id: string;
  document_type_name?: string;
  expiry_date: string | null;
  verification_status: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
  verification_notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  clamav_status?: "CLEAN" | "INFECTED" | "SCANNING" | "UNSCANNED";
}

export interface VendorScorecard {
  id: string;
  vendor_id: string;
  period_start: string;
  period_end: string;
  on_time_delivery_rate: number;
  quality_acceptance_rate: number;
  commercial_compliance_score: number;
  responsiveness_score: number;
  overall_score: number;
  calculated_at: string;
}

export interface VendorDetail extends Vendor {
  category_ids: string[];
  contacts: VendorContact[];
  bank_accounts: VendorBankAccount[];
  documents: VendorDocument[];
  scorecard: VendorScorecard | null;
}

export interface VendorListParams {
  status?: string;
  category_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

export interface VendorInvitePayload {
  company_name: string;
  primary_email: string;
  primary_phone?: string;
  category_ids?: string[];
  invited_note?: string;
}

export interface VendorRegistrationPayload {
  company_name?: string;
  legal_name?: string;
  pan?: string;
  gstin?: string;
  cin?: string;
  duns_number?: string;
  primary_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_code?: string;
  website?: string;
  category_ids?: string[];
  contacts?: Array<{
    name: string;
    designation?: string;
    email: string;
    phone?: string;
    is_primary?: boolean;
  }>;
  bank_accounts?: Array<{
    account_holder_name: string;
    bank_name: string;
    branch_name?: string;
    account_number: string;
    ifsc_code: string;
    swift_code?: string;
    is_primary?: boolean;
  }>;
}

export interface APIEnvelope<T> {
  data: T;
  meta?: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export function useVendors(params?: VendorListParams) {
  return useQuery({
    queryKey: ["vendors", params],
    queryFn: async () => {
      const res = await apiClient.get<APIEnvelope<Vendor[]>>("/vendors", {
        params: {
          status: params?.status,
          category_id: params?.category_id,
          search: params?.search,
          page: params?.page ?? 1,
          page_size: params?.page_size ?? 20,
          sort_by: params?.sort_by ?? "created_at",
          sort_dir: params?.sort_dir ?? "desc",
        },
      });
      return res.data;
    },
    select: (res) => ({
      vendors: res.data,
      meta: res.meta,
    }),
    staleTime: 60 * 1000,
  });
}

export function useVendorDetail(id: string) {
  return useQuery({
    queryKey: ["vendor", id],
    queryFn: async () => {
      const res = await apiClient.get<APIEnvelope<VendorDetail>>(`/vendors/${id}`);
      return res.data.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useValidateInvitationToken(token: string) {
  return useQuery({
    queryKey: ["vendorInvitation", token],
    queryFn: async () => {
      const res = await apiClient.get<APIEnvelope<Vendor>>(`/vendors/invitation/${token}`);
      return res.data.data;
    },
    enabled: !!token,
    retry: false,
  });
}

export function useRegisterVendor(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: VendorRegistrationPayload) => {
      const res = await apiClient.post<APIEnvelope<Vendor>>(
        `/vendors/register/${token}`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorInvitation", token] });
    },
  });
}

export function useInviteVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: VendorInvitePayload) => {
      const res = await apiClient.post<APIEnvelope<Vendor>>("/vendors/invite", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function useUpdateVendor(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<VendorRegistrationPayload>) => {
      const res = await apiClient.put<APIEnvelope<Vendor>>(`/vendors/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function useSubmitVendor(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notes?: string) => {
      const res = await apiClient.post<APIEnvelope<Vendor>>(`/vendors/${id}/submit`, {
        notes,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function useQualifyVendor(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notes?: string) => {
      const res = await apiClient.post<APIEnvelope<Vendor>>(`/vendors/${id}/qualify`, {
        notes,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function useActivateVendor(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<APIEnvelope<Vendor>>(`/vendors/${id}/activate`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function useRejectVendor(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiClient.post<APIEnvelope<Vendor>>(`/vendors/${id}/reject`, {
        reason,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function useRequestResubmission(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiClient.post<APIEnvelope<Vendor>>(
        `/vendors/${id}/request-resubmission`,
        { reason }
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function useSuspendVendor(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiClient.post<APIEnvelope<Vendor>>(`/vendors/${id}/suspend`, {
        reason,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function useReinstateVendor(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason?: string) => {
      const res = await apiClient.post<APIEnvelope<Vendor>>(`/vendors/${id}/reinstate`, {
        reason,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function useInitiateBlacklist(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiClient.post<APIEnvelope<Vendor>>(
        `/vendors/${id}/initiate-blacklist`,
        { reason }
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function useConfirmBlacklist(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload?: { workflow_task_id?: string; reason?: string }) => {
      const res = await apiClient.post<APIEnvelope<Vendor>>(
        `/vendors/${id}/confirm-blacklist`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function useAddVendorDocument(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      document_id: string;
      document_type_id: string;
      expiry_date?: string;
      verification_notes?: string;
    }) => {
      const res = await apiClient.post<APIEnvelope<VendorDocument>>(
        `/vendors/${id}/documents`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", id] });
    },
  });
}

export function useAddBankAccount(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      account_holder_name: string;
      bank_name: string;
      branch_name?: string;
      account_number: string;
      ifsc_code: string;
      swift_code?: string;
      is_primary?: boolean;
    }) => {
      const res = await apiClient.post<APIEnvelope<VendorBankAccount>>(
        `/vendors/${id}/bank-accounts`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", id] });
    },
  });
}

export function useMyVendor() {
  return useQuery({
    queryKey: ["myVendor"],
    queryFn: async () => {
      const res = await apiClient.get<APIEnvelope<VendorDetail>>("/vendors/me");
      return res.data.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useUpdateMyVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<VendorRegistrationPayload>) => {
      const res = await apiClient.put<APIEnvelope<Vendor>>("/vendors/me", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myVendor"] });
    },
  });
}

export function useVendorDocuments(vendorId?: string) {
  return useQuery({
    queryKey: ["vendorDocuments", vendorId],
    queryFn: async () => {
      const url = vendorId ? `/vendors/${vendorId}/documents` : "/vendors/me/documents";
      const res = await apiClient.get<APIEnvelope<VendorDocument[]>>(url);
      return res.data.data;
    },
    enabled: vendorId !== undefined || true,
    staleTime: 15 * 1000,
  });
}

export function useMyVendorDocuments() {
  return useQuery({
    queryKey: ["myVendorDocuments"],
    queryFn: async () => {
      const res = await apiClient.get<APIEnvelope<VendorDocument[]>>("/vendors/me/documents");
      return res.data.data;
    },
    staleTime: 15 * 1000,
  });
}

export function useAddMyVendorDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      document_id: string;
      document_type_id: string;
      expiry_date?: string;
      verification_notes?: string;
    }) => {
      const res = await apiClient.post<APIEnvelope<VendorDocument>>(
        "/vendors/me/documents",
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myVendorDocuments"] });
      queryClient.invalidateQueries({ queryKey: ["myVendor"] });
    },
  });
}

export function useInitiatePennyTest(vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bankId: string) => {
      const res = await apiClient.post<APIEnvelope<{ status: string; reference?: string }>>(
        `/vendors/${vendorId}/bank-accounts/${bankId}/initiate-penny-test`
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["myVendor"] });
    },
  });
}

export function useConfirmPennyTest(vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bankId, amountReceived }: { bankId: string; amountReceived: number }) => {
      const res = await apiClient.post<APIEnvelope<{ status: string; is_valid: boolean }>>(
        `/vendors/${vendorId}/bank-accounts/${bankId}/confirm-penny-test`,
        { amount_received: amountReceived }
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["myVendor"] });
    },
  });
}

