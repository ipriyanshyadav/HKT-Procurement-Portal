import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@procurement/stores";
import { apiClient, setAccessToken } from "@procurement/utils";

interface LoginPayload {
  email: string;
  password: string;
  org_id: string;
}

interface LoginResponse {
  data: {
    access_token?: string;
    mfa_required?: boolean;
    mfa_token?: string;
    password_expired?: boolean;
  };
}

interface CurrentUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  mfa_enabled: boolean;
  is_supplier_user: boolean;
  org_id: string;
}

interface PermissionsResponse {
  data: {
    permissions: string[];
  };
}

export function useLogin() {
  const { setAccessToken: storeSetToken, setUser } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const res = await apiClient.post<LoginResponse>("/auth/login", payload);
      return res.data;
    },
    onSuccess: async (data) => {
      const { access_token, mfa_required } = data.data;
      if (mfa_required) {
        // Caller handles MFA redirect with mfa_token from data.data.mfa_token
        return;
      }
      if (access_token) {
        // Store in memory (Zustand + module-level var for interceptor)
        setAccessToken(access_token);
        storeSetToken(access_token);
        // Load user profile and permissions
        const [userRes, permsRes] = await Promise.all([
          apiClient.get<{ data: CurrentUser }>("/users/me"),
          apiClient.get<PermissionsResponse>("/users/me/permissions"),
        ]);
        setUser(
          {
            id: userRes.data.data.id,
            email: userRes.data.data.email,
            full_name: `${userRes.data.data.first_name} ${userRes.data.data.last_name}`,
            org_id: userRes.data.data.org_id,
            role_names: [],
            is_active: userRes.data.data.status === "ACTIVE",
          },
          permsRes.data.data.permissions,
        );
        await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      }
    },
  });
}

export function useLogout() {
  const { logout: storeLogout } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.post("/auth/logout");
    },
    onSettled: () => {
      // Always clear local state even if API call fails
      setAccessToken(null);
      storeLogout();
      queryClient.clear();
    },
  });
}

export function useCurrentUser() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: CurrentUser }>("/users/me");
      return res.data.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRefreshToken() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ data: { access_token: string } }>("/auth/refresh");
      return res.data;
    },
    onSuccess: (data) => {
      const { access_token } = data.data;
      if (access_token) {
        setAccessToken(access_token);
        useAuthStore.getState().setAccessToken(access_token);
      }
    },
  });
}

export function useMFAVerify() {
  const { setAccessToken: storeSetToken, setUser } = useAuthStore();

  return useMutation({
    mutationFn: async (payload: { mfa_token: string; totp_code: string }) => {
      const res = await apiClient.post<LoginResponse>("/auth/mfa/verify", payload);
      return res.data;
    },
    onSuccess: async (data) => {
      const { access_token } = data.data;
      if (access_token) {
        setAccessToken(access_token);
        storeSetToken(access_token);
        const [userRes, permsRes] = await Promise.all([
          apiClient.get<{ data: CurrentUser }>("/users/me"),
          apiClient.get<PermissionsResponse>("/users/me/permissions"),
        ]);
        setUser(
          {
            id: userRes.data.data.id,
            email: userRes.data.data.email,
            full_name: `${userRes.data.data.first_name} ${userRes.data.data.last_name}`,
            org_id: userRes.data.data.org_id,
            role_names: [],
            is_active: userRes.data.data.status === "ACTIVE",
          },
          permsRes.data.data.permissions,
        );
      }
    },
  });
}
