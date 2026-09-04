import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@procurement/stores";
import {
  apiClient,
  setAccessToken,
  getAccessToken,
  subscribeTokenChange,
} from "@procurement/utils";

// Wire token changes from interceptors to authStore
if (typeof window !== "undefined") {
  subscribeTokenChange((token) => {
    if (token) {
      useAuthStore.getState().setAccessToken(token);
    } else {
      useAuthStore.getState().logout();
    }
  });
}

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

async function syncUserProfile(token: string): Promise<CurrentUser> {
  setAccessToken(token);
  useAuthStore.getState().setAccessToken(token);
  const [userRes, permsRes] = await Promise.all([
    apiClient.get<{ data: CurrentUser }>("/users/me"),
    apiClient.get<PermissionsResponse>("/users/me/permissions"),
  ]);
  const u = userRes.data.data;
  const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email.split("@")[0];
  useAuthStore.getState().setUser(
    {
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      full_name: fullName,
      org_id: u.org_id,
      role_names: [],
      is_active: u.status === "ACTIVE",
      is_supplier_user: u.is_supplier_user,
    },
    permsRes.data.data.permissions || [],
  );
  return u;
}

export function useAuthInit() {
  const [isInitializing, setIsInitializing] = useState(true);
  const { isAuthenticated, user } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    let isMounted = true;

    async function init() {
      // If already authenticated and user loaded into store, nothing to do
      if (getAccessToken() && user) {
        if (isMounted) setIsInitializing(false);
        return;
      }

      try {
        // Attempt silent refresh via backend httpOnly cookie
        const res = await apiClient.post<LoginResponse>("/auth/refresh");
        const token = res.data.data?.access_token;
        if (token) {
          const u = await syncUserProfile(token);
          queryClient.setQueryData(["currentUser"], u);
        }
      } catch {
        setAccessToken(null);
        useAuthStore.getState().logout();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  return { isInitializing, isAuthenticated };
}

export function useLogin() {
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
        const u = await syncUserProfile(access_token);
        queryClient.setQueryData(["currentUser"], u);
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
      // Always clear local state and immediately navigate to login page
      setAccessToken(null);
      storeLogout();
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    },
  });
}

export function useCurrentUser() {
  const { isAuthenticated, user } = useAuthStore();

  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: CurrentUser }>("/users/me");
      return res.data.data;
    },
    enabled: Boolean(isAuthenticated || getAccessToken()),
    initialData: user
      ? ({
          id: user.id,
          email: user.email,
          first_name: user.first_name || "",
          last_name: user.last_name || "",
          status: user.is_active ? "ACTIVE" : "INACTIVE",
          mfa_enabled: false,
          is_supplier_user: Boolean(user.is_supplier_user),
          org_id: user.org_id,
        } as CurrentUser)
      : undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRefreshToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ data: { access_token: string } }>("/auth/refresh");
      return res.data;
    },
    onSuccess: async (data) => {
      const { access_token } = data.data;
      if (access_token) {
        const u = await syncUserProfile(access_token);
        queryClient.setQueryData(["currentUser"], u);
      }
    },
  });
}

export function useMFAVerify() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { mfa_token: string; totp_code: string }) => {
      const res = await apiClient.post<LoginResponse>("/auth/mfa/verify", payload);
      return res.data;
    },
    onSuccess: async (data) => {
      const { access_token } = data.data;
      if (access_token) {
        const u = await syncUserProfile(access_token);
        queryClient.setQueryData(["currentUser"], u);
      }
    },
  });
}
