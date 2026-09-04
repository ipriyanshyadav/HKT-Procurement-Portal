import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

declare const process: { env: Record<string, string | undefined> };

const API_URL = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) || "http://localhost:8000";

let accessToken: string | null = null;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

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
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
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
      const { data } = await axios.post<{ data: { access_token: string } }>(
        `${API_URL}/api/v1/auth/refresh`,
        {},
        { withCredentials: true },
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
