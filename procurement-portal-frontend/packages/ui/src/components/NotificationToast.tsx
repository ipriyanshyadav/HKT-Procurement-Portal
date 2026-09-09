"use client";

import React, { useEffect } from "react";
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  ExternalLink,
  ShoppingCart,
  FileText,
  Package,
  Receipt,
  ShieldAlert,
} from "lucide-react";

export type NotificationToastType = "info" | "success" | "warning" | "error";

export interface NotificationToastItem {
  id: string;
  title: string;
  body?: string;
  type?: NotificationToastType;
  notification_type?: string;
  entity_type?: string | null;
  entity_id?: string | null;
  created_at?: string;
  link?: string;
  durationMs?: number;
}

export interface NotificationToastProps {
  toast: NotificationToastItem;
  onDismiss: (id: string) => void;
  onClick?: (toast: NotificationToastItem) => void;
}

function getCategoryIcon(notificationType?: string, type?: NotificationToastType) {
  const norm = (notificationType || "").toLowerCase();
  if (norm.includes("pr") || norm.includes("requisition")) {
    return <ShoppingCart className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  }
  if (norm.includes("rfq") || norm.includes("bid") || norm.includes("tender")) {
    return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  }
  if (norm.includes("po") || norm.includes("order")) {
    return <Package className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
  }
  if (norm.includes("invoice") || norm.includes("payment")) {
    return <Receipt className="w-4 h-4 text-indigo-500 flex-shrink-0" />;
  }
  if (norm.includes("security") || norm.includes("crypto") || norm.includes("tamper")) {
    return <ShieldAlert className="w-4 h-4 text-purple-500 flex-shrink-0" />;
  }
  if (type === "error" || norm.includes("sla") || norm.includes("alert")) {
    return <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />;
  }
  if (type === "warning") {
    return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  }
  if (type === "success") {
    return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
  }
  return <Bell className="w-4 h-4 text-blue-400 flex-shrink-0" />;
}

export function NotificationToast({ toast, onDismiss, onClick }: NotificationToastProps) {
  useEffect(() => {
    const duration = toast.durationMs ?? 6000;
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.durationMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl bg-neutral-900/90 dark:bg-[#1C1C1F]/95 backdrop-blur-xl border border-neutral-700/40 dark:border-white/10 shadow-2xl text-white transition-all duration-300 transform hover:scale-[1.01] max-w-sm w-full"
    >
      <div className="mt-0.5 p-1 rounded-lg bg-white/5 border border-white/10">
        {getCategoryIcon(toast.notification_type, toast.type)}
      </div>

      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onClick && onClick(toast)}
      >
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-xs font-semibold tracking-tight text-neutral-100 truncate">
            {toast.title}
          </h5>
          <span className="text-[10px] text-neutral-400 font-mono flex-shrink-0">
            {toast.created_at ? new Date(toast.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Now"}
          </span>
        </div>
        {toast.body && (
          <p className="text-[11px] text-neutral-300 mt-1 line-clamp-2 leading-relaxed">
            {toast.body}
          </p>
        )}
        {toast.link && (
          <div className="mt-2 flex items-center gap-1 text-[11px] text-blue-400 font-medium hover:underline">
            <span>View details</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Dismiss toast"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export interface NotificationToastContainerProps {
  toasts: NotificationToastItem[];
  onDismiss: (id: string) => void;
  onClick?: (toast: NotificationToastItem) => void;
}

export function NotificationToastContainer({
  toasts,
  onDismiss,
  onClick,
}: NotificationToastContainerProps) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-2.5 max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => (
        <NotificationToast
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onClick={onClick}
        />
      ))}
    </div>
  );
}
