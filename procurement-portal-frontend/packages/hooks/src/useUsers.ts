import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@procurement/utils';

export interface UserItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING_ACTIVATION' | 'TERMINATED';
  roles: string[];
}

export interface RoleItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system_role?: boolean;
  is_supplier_role?: boolean;
  is_active?: boolean;
  permissions_count?: number;
  permissions?: string[];
}

export interface PermissionItem {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
  assigned_roles?: string[];
}

export interface RolePermissionsMatrix {
  roles: Array<{
    id: string;
    code: string;
    name: string;
    is_system_role: boolean;
    is_supplier_role: boolean;
    description?: string;
  }>;
  permissions: Array<{
    id: string;
    code: string;
    name: string;
    module: string;
    description?: string;
  }>;
  matrix: Record<string, string[]>;
}

export interface UserSessionItem {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  token_jti: string;
  ip_address: string;
  user_agent: string;
  created_at: string | null;
  last_activity_at: string | null;
  expires_at: string | null;
  is_revoked: boolean;
  revoked_reason: string | null;
  is_active: boolean;
}

export interface RoleCreatePayload {
  code: string;
  name: string;
  description?: string;
  is_supplier_role?: boolean;
  permission_codes?: string[];
}

export interface RoleUpdatePayload {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface UserCreatePayload {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  employee_id?: string;
  roles?: string[];
}

export function useUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: UserItem[] }>('/users/');
      return data.data;
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: RoleItem[] }>('/users/roles');
      return data.data;
    },
  });
}

export function useRole(roleId?: string) {
  return useQuery({
    queryKey: ['admin-role', roleId],
    queryFn: async () => {
      if (!roleId) return null;
      const { data } = await apiClient.get<{ data: RoleItem & { permissions: PermissionItem[] } }>(`/users/roles/${roleId}`);
      return data.data;
    },
    enabled: !!roleId,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RoleCreatePayload) => {
      const { data } = await apiClient.post<{ data: { id: string; code: string; name: string } }>('/users/roles', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-role-matrix'] });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleId, payload }: { roleId: string; payload: RoleUpdatePayload }) => {
      const { data } = await apiClient.put<{ data: { id: string; message: string } }>(`/users/roles/${roleId}`, payload);
      return data.data;
    },
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-role', roleId] });
      queryClient.invalidateQueries({ queryKey: ['admin-role-matrix'] });
    },
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleId, permissionCodes }: { roleId: string; permissionCodes: string[] }) => {
      const { data } = await apiClient.put<{ data: { message: string } }>(`/users/roles/${roleId}/permissions`, {
        permission_codes: permissionCodes,
      });
      return data.data;
    },
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-role', roleId] });
      queryClient.invalidateQueries({ queryKey: ['admin-role-matrix'] });
    },
  });
}

export function usePermissions(params?: { module?: string; search?: string }) {
  return useQuery({
    queryKey: ['admin-permissions', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: PermissionItem[] }>('/users/permissions', { params });
      return data.data;
    },
  });
}

export function useRolePermissionsMatrix() {
  return useQuery({
    queryKey: ['admin-role-matrix'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: RolePermissionsMatrix }>('/users/role-permissions/matrix');
      return data.data;
    },
  });
}

export function useToggleRolePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { role_code: string; permission_code: string; granted: boolean }) => {
      const { data } = await apiClient.post<{ data: { changed: boolean; granted: boolean } }>(
        '/users/role-permissions/toggle',
        payload
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-role-matrix'] });
    },
  });
}

export function useUserSessions(params?: { active_only?: boolean; search?: string; page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ['admin-user-sessions', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: UserSessionItem[]; meta: any }>('/users/sessions', { params });
      return data;
    },
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, reason }: { sessionId: string; reason?: string }) => {
      const { data } = await apiClient.post<{ data: { message: string } }>(`/users/sessions/${sessionId}/revoke`, {
        reason,
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-sessions'] });
    },
  });
}

export function useRevokeAllUserSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const { data } = await apiClient.post<{ data: { message: string } }>(`/users/sessions/user/${userId}/revoke-all`, {
        reason,
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-sessions'] });
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UserCreatePayload) => {
      const { data } = await apiClient.post<{ data: { id: string; email: string } }>('/users/', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, roleCode }: { userId: string; roleCode: string }) => {
      const { data } = await apiClient.post<{ data: { message: string } }>(`/users/${userId}/roles`, {
        role_code: roleCode,
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useRemoveRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, roleCode }: { userId: string; roleCode: string }) => {
      const { data } = await apiClient.delete<{ data: { message: string } }>(`/users/${userId}/roles/${roleCode}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: 'activate' | 'deactivate' }) => {
      const { data } = await apiClient.post<{ data: { message: string } }>(`/users/${userId}/${action}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export interface DelegationRule {
  id: string;
  org_id: string;
  delegator_id: string;
  delegate_id: string;
  delegate_name?: string | null;
  delegate_email?: string | null;
  reason: string;
  valid_from: string;
  valid_until: string;
  entity_types: string[];
  is_active: boolean;
  created_at?: string | null;
}

export interface DelegationCreatePayload {
  delegate_id: string;
  reason: string;
  valid_from: string;
  valid_until: string;
  entity_types?: string[];
}

export function useMyDelegations() {
  return useQuery({
    queryKey: ['my-delegations'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: DelegationRule[] }>('/users/me/delegations');
      return data.data;
    },
  });
}

export function useCreateDelegation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DelegationCreatePayload) => {
      const { data } = await apiClient.post<{ data: DelegationRule }>('/users/me/delegations', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-delegations'] });
    },
  });
}

export function useDeleteDelegation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const { data } = await apiClient.delete<{ data: { message: string } }>(`/users/me/delegations/${ruleId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-delegations'] });
    },
  });
}

