/**
 * Error extraction utility for API responses and unexpected exceptions.
 */

export interface ApiErrorResponse {
  response?: {
    status?: number;
    data?: {
      error?: {
        message?: string;
        code?: string;
        details?: Record<string, unknown>;
      };
      detail?: string | Array<{ msg?: string; loc?: string[] }>;
      message?: string;
    };
  };
  message?: string;
}

/**
 * Extracts a human-friendly error message from an unknown error (Axios error, Error instance, or string).
 */
export function getErrorMessage(err: unknown, fallback = "An unexpected error occurred"): string {
  if (!err) return fallback;

  if (typeof err === "string") return err;

  const apiErr = err as ApiErrorResponse;

  // 1. Structured backend error: error.message
  if (apiErr.response?.data?.error?.message) {
    return apiErr.response.data.error.message;
  }

  // 2. FastAPI detail string
  if (typeof apiErr.response?.data?.detail === "string") {
    return apiErr.response.data.detail;
  }

  // 3. FastAPI validation error array: detail: [{ msg: "..." }]
  if (Array.isArray(apiErr.response?.data?.detail) && apiErr.response.data.detail.length > 0) {
    const first = apiErr.response.data.detail[0];
    if (first?.msg) return first.msg;
  }

  // 4. Response data message
  if (apiErr.response?.data?.message) {
    return apiErr.response.data.message;
  }

  // 5. Standard Error instance message
  if (apiErr.message) {
    return apiErr.message;
  }

  return fallback;
}
