import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface TenantBranding {
  id: string;
  org_id: string;
  company_display_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  custom_domain: string | null;
  custom_domain_verified: boolean;
  dns_txt_record_name: string | null;
  dns_txt_record_value: string | null;
  email_sender_name: string | null;
  email_footer_text: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantBrandingUpdateRequest {
  company_display_name?: string;
  logo_url?: string;
  favicon_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  custom_domain?: string;
  email_sender_name?: string;
  email_footer_text?: string;
  is_active?: boolean;
}

export interface PublicBranding {
  org_id: string;
  company_display_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
}

export function useTenantBranding() {
  return useQuery({
    queryKey: ["tenant-branding"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: TenantBranding }>("/admin/branding");
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateTenantBranding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TenantBrandingUpdateRequest) => {
      const res = await apiClient.patch<{ data: TenantBranding }>("/admin/branding", payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["tenant-branding"], data);
      queryClient.invalidateQueries({ queryKey: ["tenant-branding"] });
    },
  });
}

export function useVerifyCustomDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ data: TenantBranding }>("/admin/branding/verify-domain");
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["tenant-branding"], data);
      queryClient.invalidateQueries({ queryKey: ["tenant-branding"] });
    },
  });
}

export function usePublicBranding(params: { domain?: string; org_name?: string }) {
  return useQuery({
    queryKey: ["public-branding", params],
    queryFn: async () => {
      const res = await apiClient.get<{ data: PublicBranding }>("/public/branding", {
        params,
      });
      return res.data.data;
    },
    enabled: Boolean(params.domain || params.org_name),
    staleTime: 10 * 60 * 1000,
  });
}
