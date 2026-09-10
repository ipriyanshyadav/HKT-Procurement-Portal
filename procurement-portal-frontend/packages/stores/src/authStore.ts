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

export interface StoredAuthSession {
  accessToken: string;
  refreshToken?: string | null;
  user: CurrentUser;
  permissions: string[];
  orgId: string | null;
  emulatedPersonaId?: string | null;
}

export const SESSION_STORAGE_KEY = "hkt_auth_session";

export function loadSessionFromStorage(): StoredAuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.accessToken && parsed.user) {
      return parsed as StoredAuthSession;
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

export function saveSessionToStorage(session: Partial<StoredAuthSession>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadSessionFromStorage() || ({} as StoredAuthSession);
    const updated = { ...existing, ...session };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage write errors
  }
}

export function clearSessionFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem("hkt_emulated_persona_id");
  } catch {
    // Ignore storage errors
  }
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: CurrentUser | null;
  permissions: string[];
  orgId: string | null;
  isAuthenticated: boolean;
  emulatedPersona: EnterprisePersona | null;
  setAccessToken: (token: string, refreshToken?: string | null) => void;
  setUser: (user: CurrentUser, permissions: string[]) => void;
  setEmulatedPersona: (persona: EnterprisePersona | null) => void;
  logout: () => void;
}

const getInitialEmulatedPersona = (savedPersonaId?: string | null): EnterprisePersona | null => {
  if (savedPersonaId && savedPersonaId !== "superadmin") {
    return getPersonaById(savedPersonaId) || null;
  }
  if (typeof window !== "undefined") {
    try {
      const savedId =
        sessionStorage.getItem("hkt_emulated_persona_id") ||
        localStorage.getItem("hkt_emulated_persona_id");
      if (savedId && savedId !== "superadmin") {
        return getPersonaById(savedId) || null;
      }
    } catch {
      // Ignore storage errors
    }
  }
  return null;
};

const initialSession = loadSessionFromStorage();

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: initialSession?.accessToken || null,
  refreshToken: initialSession?.refreshToken || null,
  user: initialSession?.user || null,
  permissions: initialSession?.permissions || [],
  orgId: initialSession?.orgId || null,
  isAuthenticated: Boolean(initialSession?.accessToken && initialSession?.user),
  emulatedPersona: getInitialEmulatedPersona(initialSession?.emulatedPersonaId),
  setAccessToken: (token: string, refreshToken?: string | null) => {
    saveSessionToStorage({
      accessToken: token,
      ...(refreshToken !== undefined ? { refreshToken } : {}),
    });
    set((state) => ({
      accessToken: token,
      refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
      isAuthenticated: true,
    }));
  },
  setUser: (user: CurrentUser, permissions: string[]) => {
    saveSessionToStorage({ user, permissions, orgId: user.org_id });
    set({
      user,
      permissions,
      orgId: user.org_id,
      isAuthenticated: Boolean(get().accessToken),
    });
  },
  setEmulatedPersona: (persona: EnterprisePersona | null) => {
    const personaId = persona && persona.id !== "superadmin" ? persona.id : null;
    if (typeof window !== "undefined") {
      try {
        if (personaId) {
          sessionStorage.setItem("hkt_emulated_persona_id", personaId);
          localStorage.setItem("hkt_emulated_persona_id", personaId);
        } else {
          sessionStorage.removeItem("hkt_emulated_persona_id");
          localStorage.removeItem("hkt_emulated_persona_id");
        }
      } catch {
        // Ignore storage errors
      }
    }
    saveSessionToStorage({ emulatedPersonaId: personaId });
    set({ emulatedPersona: persona && persona.id !== "superadmin" ? persona : null });
  },
  logout: () => {
    clearSessionFromStorage();
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("hkt_emulated_persona_id");
      } catch {
        // Ignore storage errors
      }
    }
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      permissions: [],
      orgId: null,
      isAuthenticated: false,
      emulatedPersona: null,
    });
  },
}));
