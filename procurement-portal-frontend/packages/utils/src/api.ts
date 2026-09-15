import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

declare const process: { env: Record<string, string | undefined> };

const isServer = typeof window === "undefined";
export function getEffectiveApiUrl(): string {
  if (!isServer) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const host = hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname;
    return `${protocol}//${host}:8000`;
  }
  return (
    (typeof process !== "undefined" &&
      (process.env?.INTERNAL_API_URL || process.env?.NEXT_PUBLIC_API_URL)) ||
    "http://localhost:8000"
  );
}

export const API_URL = getEffectiveApiUrl();

const SESSION_STORAGE_KEY = "hkt_auth_session";

function getInitialToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.accessToken) {
        return parsed.accessToken;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.refreshToken) {
        return parsed.refreshToken;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

let accessToken: string | null = getInitialToken();
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

type TokenListener = (token: string | null) => void;
const tokenListeners = new Set<TokenListener>();

export function subscribeTokenChange(listener: TokenListener): () => void {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
}

export function getPortalId(): string | null {
  if (typeof window === "undefined") return null;
  const port = window.location.port;
  if (port === "3001") return "supplier";
  if (port === "3002") return "admin";
  if (port === "3000") return "buyer";
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes("supplier")) return "supplier";
  if (hostname.includes("admin")) return "admin";
  if (hostname.includes("buyer")) return "buyer";
  return null;
}

function processQueue(error: Error | null, token: string | null): void {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else if (token) {
      resolve(token);
    }
  });
  failedQueue = [];
}

export function setAccessToken(token: string | null, refreshToken?: string | null): void {
  accessToken = token;
  if (typeof window !== "undefined") {
    try {
      if (token) {
        const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.accessToken = token;
        if (refreshToken !== undefined) {
          parsed.refreshToken = refreshToken;
        }
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }
  tokenListeners.forEach((fn) => {
    try {
      fn(token);
    } catch {
      // ignore
    }
  });
}

export function getAccessToken(): string | null {
  if (!accessToken && typeof window !== "undefined") {
    accessToken = getInitialToken();
  }
  return accessToken;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (!isServer) {
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      const host = hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname;
      const currentOrigin = `${protocol}//${host}:8000`;
      if (config.baseURL && !config.baseURL.startsWith(currentOrigin)) {
        config.baseURL = config.baseURL.replace(/^https?:\/\/[^/]+(:[0-9]+)?/, currentOrigin);
      }
    }
    const token = accessToken || getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const portal = getPortalId();
    if (portal && config.headers) {
      config.headers["X-Portal-Id"] = portal;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

function setAuthHeader(config: InternalAxiosRequestConfig, token: string): void {
  if (!config.headers) return;
  if (typeof (config.headers as any).set === "function") {
    (config.headers as any).set("Authorization", `Bearer ${token}`);
  } else {
    config.headers.Authorization = `Bearer ${token}`;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Do not intercept or refresh for auth endpoints (/auth/login, /auth/refresh, /auth/logout)
    if (originalRequest.url?.includes("/auth/")) {
      return Promise.reject(error);
    }

    // Prevent infinite loop if already retried
    if (originalRequest._retry) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        setAuthHeader(originalRequest, token);
        return apiClient(originalRequest);
      });
    }

    isRefreshing = true;

    try {
      const portal = getPortalId();
      const headers: Record<string, string> = {};
      if (portal) {
        headers["X-Portal-Id"] = portal;
      }
      const tabRefreshToken = getRefreshToken();
      if (tabRefreshToken) {
        headers["X-Refresh-Token"] = tabRefreshToken;
      }
      const refreshBaseUrl = !isServer
        ? `${window.location.protocol}//${window.location.hostname.includes(":") && !window.location.hostname.startsWith("[") ? `[${window.location.hostname}]` : window.location.hostname}:8000`
        : API_URL;
      const { data } = await axios.post<{ data: { access_token: string; refresh_token?: string } }>(
        `${refreshBaseUrl}/api/v1/auth/refresh`,
        tabRefreshToken ? { refresh_token: tabRefreshToken } : {},
        { withCredentials: true, headers },
      );
      const newToken = data.data.access_token;
      const newRefreshToken = data.data.refresh_token || tabRefreshToken;
      setAccessToken(newToken, newRefreshToken);
      processQueue(null, newToken);
      setAuthHeader(originalRequest, newToken);
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError instanceof Error ? refreshError : new Error(String(refreshError)), null);
      setAccessToken(null);
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
