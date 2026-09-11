import { useCallback } from "react";
import { useNotificationStore } from "@procurement/stores";
import { playSuccessChime, playActionChime } from "@procurement/utils";

/**
 * useAppToast — thin wrapper around notificationStore's toast system.
 *
 * Replaces native browser `alert()` calls throughout the application with
 * accessible, non-blocking toast notifications and subtle acoustic feedback.
 *
 * Usage:
 *   const { toast } = useAppToast();
 *   toast.error("Failed to delete item", "Please try again or contact support");
 *   toast.success("Saved successfully!");
 */
export function useAppToast() {
  const addToast = useNotificationStore((state) => state.addToast);

  const showToast = useCallback(
    (
      type: "success" | "error" | "info" | "warning",
      title: string,
      body?: string,
      durationMs = 5000,
    ) => {
      if (type === "success") {
        playSuccessChime();
      } else if (type === "warning" || type === "info") {
        playActionChime();
      }
      addToast({
        id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        body,
        type,
        durationMs,
      });
    },
    [addToast],
  );

  return {
    toast: {
      success: (title: string, body?: string) => showToast("success", title, body),
      error: (title: string, body?: string) => showToast("error", title, body, 8000),
      info: (title: string, body?: string) => showToast("info", title, body),
      warning: (title: string, body?: string) => showToast("warning", title, body, 6000),
    },
  };
}
