import { create } from "zustand";

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  org_id: string;
  role_names: string[];
  is_active: boolean;
}

export interface AuthState {
  accessToken: string | null;
  user: CurrentUser | null;
  permissions: string[];
  orgId: string | null;
  isAuthenticated: boolean;
  setAccessToken: (token: string) => void;
  setUser: (user: CurrentUser, permissions: string[]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  permissions: [],
  orgId: null,
  isAuthenticated: false,
  setAccessToken: (token: string) =>
    set({ accessToken: token, isAuthenticated: true }),
  setUser: (user: CurrentUser, permissions: string[]) =>
    set({ user, permissions, orgId: user.org_id }),
  logout: () =>
    set({
      accessToken: null,
      user: null,
      permissions: [],
      orgId: null,
      isAuthenticated: false,
    }),
}));
