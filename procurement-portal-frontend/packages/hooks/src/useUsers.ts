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
