import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";
import { useAuthStore } from "@procurement/stores";

export interface OrgMembershipItem {
  org_id: string;
  org_name: string;
  role_in_org: string[];
  is_primary: boolean;
  status: string;
  joined_at: string;
}

export interface SwitchOrgRequest {
  target_org_id: string;
  reason?: string;
}

export interface SwitchOrgResponse {
  access_token: string;
  token_type: string;
  switched_to_org_id: string;
  org_name: string;
  roles: string[];
}

export interface UserOrgMemberItem {
  membership_id: string;
  user_id: string;
  email: string;
  full_name: string;
  roles: string[];
  is_primary: boolean;
  status: string;
  joined_at: string;
}

export interface UserOrgInviteRequest {
  email: string;
  roles: string[];
}

export function useMyOrganizations() {
  return useQuery({
    queryKey: ["my-organizations"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: OrgMembershipItem[] }>("/auth/org/my-organizations");
      return res.data.data ?? [];
    },
    staleTime: 60 * 1000,
  });
}

export function useSwitchOrganization() {
  const queryClient = useQueryClient();
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const permissions = useAuthStore((state) => state.permissions);

  return useMutation({
    mutationFn: async (payload: SwitchOrgRequest) => {
      const res = await apiClient.post<{ data: SwitchOrgResponse }>("/auth/org/switch", payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      if (data?.access_token) {
        setAccessToken(data.access_token);
        if (user) {
          setUser(
            {
              ...user,
              org_id: data.switched_to_org_id,
              role_names: data.roles,
            },
            permissions
          );
        }
        if (typeof window !== "undefined") {
          localStorage.setItem("active_company_id", data.switched_to_org_id);
          localStorage.setItem("active_company_name", data.org_name);
        }
      }
      queryClient.clear();
    },
  });
}

export function useOrgMembers(orgId: string) {
  return useQuery({
    queryKey: ["org-members", orgId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: UserOrgMemberItem[] }>(`/admin/orgs/${orgId}/members`);
      return res.data.data ?? [];
    },
    enabled: Boolean(orgId),
  });
}

export function useInviteUserToOrg(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UserOrgInviteRequest) => {
      const res = await apiClient.post<{ data: UserOrgMemberItem }>(
        `/admin/orgs/${orgId}/members/invite`,
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
  });
}

export function useRemoveOrgMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (membershipId: string) => {
      await apiClient.delete(`/admin/orgs/${orgId}/members/${membershipId}`);
      return membershipId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
  });
}
