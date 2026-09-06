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

let accessToken: string | null = null;
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

export function setAccessToken(token: string | null): void {
  accessToken = token;
  tokenListeners.forEach((fn) => {
    try {
      fn(token);
    } catch {
      // ignore
    }
  });
}

export function getAccessToken(): string | null {
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
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
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
      const refreshBaseUrl = !isServer
        ? `${window.location.protocol}//${window.location.hostname.includes(":") && !window.location.hostname.startsWith("[") ? `[${window.location.hostname}]` : window.location.hostname}:8000`
        : API_URL;
      const { data } = await axios.post<{ data: { access_token: string } }>(
        `${refreshBaseUrl}/api/v1/auth/refresh`,
        {},
        { withCredentials: true, headers },
      );
      const newToken = data.data.access_token;
      setAccessToken(newToken);
      processQueue(null, newToken);
      setAuthHeader(originalRequest, newToken);
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError instanceof Error ? refreshError : new Error(String(refreshError)), null);
      setAccessToken(null);
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
