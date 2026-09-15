"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@procurement/stores";
import { playNotificationChime } from "@procurement/utils";
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

export function playGlassBellSound() {
  playNotificationChime();
}

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
  isContainerHovered?: boolean;
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

export function NotificationToast({
  toast,
  onDismiss,
  onClick,
  isContainerHovered = false,
}: NotificationToastProps) {
  const [isSelfHovered, setIsSelfHovered] = React.useState(false);
  const [dragX, setDragX] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [startX, setStartX] = React.useState(0);
  const [isDismissing, setIsDismissing] = React.useState(false);

  const isHovered = isSelfHovered || isContainerHovered;

  const triggerDismiss = React.useCallback((e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsDismissing(true);
    setDragX(350);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 180);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    playGlassBellSound();
  }, []);

  useEffect(() => {
    const duration = toast.durationMs ?? 6000;
    // When duration is 0, or user is dragging, dismissing, or cursor is hovering over them, stay indefinitely
    if (duration <= 0 || isDragging || isDismissing || isHovered) {
      return;
    }

    const timer = setTimeout(() => {
      triggerDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.durationMs, isDragging, isDismissing, isHovered, triggerDismiss]);

  // Pointer drag events
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) {
      return;
    }
    setIsDragging(true);
    setStartX(e.clientX);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const diff = e.clientX - startX;
    if (diff > 0) {
      setDragX(diff);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (dragX > 35) {
      triggerDismiss();
    } else {
      setDragX(0);
    }
  };

  // Two-finger trackpad swipe right
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaX > 25 || (e.shiftKey && e.deltaY > 25)) {
      triggerDismiss();
    }
  };

  // Cursor hover state tracking — stays indefinitely while cursor is hovering
  const handleMouseEnter = () => {
    setIsSelfHovered(true);
  };

  const handleMouseMove = () => {
    if (!isSelfHovered) {
      setIsSelfHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsSelfHovered(false);
  };

  const handleClick = () => {
    if (dragX < 5 && onClick) {
      onClick(toast);
    }
  };

  const handleDismissClick = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    triggerDismiss(e);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      style={{
        transform: `translateX(${dragX}px)`,
        opacity: isDismissing ? 0 : Math.max(0.2, 1 - dragX / 300),
        transition: isDragging ? "none" : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease",
      }}
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl bg-white/95 dark:bg-[#1C1C1F]/98 backdrop-blur-2xl border ${
        isHovered
          ? "border-blue-400 dark:border-blue-500 shadow-2xl scale-[1.01]"
          : "border-neutral-200/90 dark:border-neutral-700 shadow-xl dark:shadow-2xl"
      } text-neutral-900 dark:text-white max-w-sm w-full border-l-4 border-l-blue-500 cursor-grab active:cursor-grabbing select-none transition-all duration-200 ${
        isDismissing ? "pointer-events-none" : ""
      }`}
    >
      <div className="mt-0.5 p-1.5 rounded-xl bg-neutral-100 dark:bg-white/10 border border-neutral-200 dark:border-white/10 shadow-xs shrink-0">
        {getCategoryIcon(toast.notification_type, toast.type)}
      </div>

      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={handleClick}
      >
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-xs font-bold tracking-tight text-neutral-900 dark:text-white truncate">
            {toast.title}
          </h5>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono flex-shrink-0">
            {toast.created_at ? new Date(toast.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Now"}
          </span>
        </div>
        {toast.body && (
          <p className="text-[11px] text-neutral-600 dark:text-neutral-300 mt-1 line-clamp-2 leading-relaxed">
            {toast.body}
          </p>
        )}
        {toast.link && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-2 flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            <span>View details</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        )}
      </div>

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleDismissClick}
        className="relative z-30 p-1.5 -mr-1 -mt-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4 pointer-events-none" />
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
  const [isContainerHovered, setIsContainerHovered] = React.useState(false);

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      onMouseEnter={() => setIsContainerHovered(true)}
      onMouseLeave={() => setIsContainerHovered(false)}
      className="fixed top-20 right-6 z-[200] flex flex-col gap-2.5 max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => (
        <NotificationToast
          key={toast.id}
          toast={toast}
          isContainerHovered={isContainerHovered}
          onDismiss={onDismiss}
          onClick={onClick}
        />
      ))}
    </div>
  );
}

export function NotificationToaster() {
  const toasts = useNotificationStore((state) => state.toasts);
  const dismissToast = useNotificationStore((state) => state.dismissToast);
  const router = useRouter();

  const handleToastClick = (toast: NotificationToastItem) => {
    dismissToast(toast.id);
    if (toast.link) {
      router.push(toast.link);
      return;
    }
    if (toast.entity_type) {
      const type = toast.entity_type.toLowerCase();
      if (type.includes("req") || type === "pr") {
        router.push(toast.entity_id ? `/requisitions/${toast.entity_id}` : "/requisitions");
      } else if (type === "rfq" || type === "sourcing" || type === "bid") {
        router.push(toast.entity_id ? `/rfqs/${toast.entity_id}` : "/rfqs");
      } else if (type.includes("order") || type === "po") {
        router.push(toast.entity_id ? `/purchase-orders/${toast.entity_id}` : "/purchase-orders");
      } else if (type.includes("invoice") || type.includes("payment")) {
        router.push(toast.entity_id ? `/invoices/${toast.entity_id}` : "/invoices");
      } else if (type.includes("task") || type.includes("approval")) {
        router.push(toast.entity_id ? `/tasks/${toast.entity_id}` : "/tasks");
      } else if (type.includes("vendor")) {
        router.push(toast.entity_id ? `/vendors/${toast.entity_id}` : "/vendors");
      }
    }
  };

  return (
    <NotificationToastContainer
      toasts={toasts}
      onDismiss={dismissToast}
      onClick={handleToastClick}
    />
  );
}
