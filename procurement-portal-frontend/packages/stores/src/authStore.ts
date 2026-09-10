import { create } from "zustand";
import { EnterprisePersona, getPersonaById, SUPERADMIN_PERSONA } from "./personas";

export interface CurrentUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  org_id: string;
  role_names: string[];
  is_active: boolean;
  is_supplier_user?: boolean;
  vendor_id?: string | null;
}

export interface AuthState {
  accessToken: string | null;
  user: CurrentUser | null;
  permissions: string[];
  orgId: string | null;
  isAuthenticated: boolean;
  emulatedPersona: EnterprisePersona | null;
  setAccessToken: (token: string) => void;
  setUser: (user: CurrentUser, permissions: string[]) => void;
  setEmulatedPersona: (persona: EnterprisePersona | null) => void;
  logout: () => void;
}

const getInitialEmulatedPersona = (): EnterprisePersona | null => {
  if (typeof window !== "undefined") {
    try {
      const savedId = localStorage.getItem("hkt_emulated_persona_id");
      if (savedId && savedId !== "superadmin") {
        return getPersonaById(savedId) || null;
      }
    } catch {
      // Ignore storage errors
    }
  }
  return null;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  permissions: [],
  orgId: null,
  isAuthenticated: false,
  emulatedPersona: getInitialEmulatedPersona(),
  setAccessToken: (token: string) =>
    set({ accessToken: token, isAuthenticated: true }),
  setUser: (user: CurrentUser, permissions: string[]) =>
    set({ user, permissions, orgId: user.org_id }),
  setEmulatedPersona: (persona: EnterprisePersona | null) => {
    if (typeof window !== "undefined") {
      try {
        if (persona && persona.id !== "superadmin") {
          localStorage.setItem("hkt_emulated_persona_id", persona.id);
        } else {
          localStorage.removeItem("hkt_emulated_persona_id");
        }
      } catch {
        // Ignore storage errors
      }
    }
    set({ emulatedPersona: persona && persona.id !== "superadmin" ? persona : null });
  },
  logout: () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("hkt_emulated_persona_id");
      } catch {
        // Ignore storage errors
      }
    }
    set({
      accessToken: null,
      user: null,
      permissions: [],
      orgId: null,
      isAuthenticated: false,
      emulatedPersona: null,
    });
  },
}));
