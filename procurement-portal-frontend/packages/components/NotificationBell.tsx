"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Info,
  AlertTriangle,
  FileText,
  ShoppingCart,
  Receipt,
  Package,
} from "lucide-react";
import { useNotificationStore, type NotificationItem } from "@procurement/stores";
import {
  useNotificationsList,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@procurement/hooks";

function getNotificationIcon(type: string) {
  const norm = type.toLowerCase();
  if (norm.includes("pr") || norm.includes("requisition")) {
    return <ShoppingCart className="w-4 h-4 text-amber-500" />;
  }
  if (norm.includes("rfq") || norm.includes("bid") || norm.includes("tender")) {
    return <FileText className="w-4 h-4 text-blue-500" />;
  }
  if (norm.includes("po") || norm.includes("order")) {
    return <Package className="w-4 h-4 text-emerald-500" />;
  }
  if (norm.includes("invoice") || norm.includes("payment")) {
    return <Receipt className="w-4 h-4 text-indigo-500" />;
  }
  if (norm.includes("sla") || norm.includes("warning") || norm.includes("alert") || norm.includes("hold")) {
    return <AlertTriangle className="w-4 h-4 text-red-500" />;
  }
  return <Info className="w-4 h-4 text-neutral-400" />;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch initial notifications via query (which also populates the Zustand store)
  useNotificationsList({ page: 1, page_size: 15 });

  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const isConnected = useNotificationStore((state) => state.isConnected);

  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const recentNotifications = notifications.slice(0, 8);

  const router = useRouter();

  const handleItemClick = (n: NotificationItem) => {
    if (!n.is_read && !n.read_at) {
      markReadMutation.mutate(n.id);
    }
    setIsOpen(false);
    if (n.entity_type) {
      const type = n.entity_type.toLowerCase();
      if (type.includes("req") || type === "pr") {
        router.push(n.entity_id ? `/requisitions/${n.entity_id}` : "/requisitions");
      } else if (type === "rfq" || type === "sourcing" || type === "bid") {
        router.push(n.entity_id ? `/rfqs/${n.entity_id}` : "/rfqs");
      } else if (type.includes("order") || type === "po") {
        router.push(n.entity_id ? `/purchase-orders/${n.entity_id}` : "/purchase-orders");
      } else if (type.includes("invoice") || type.includes("payment")) {
        router.push(n.entity_id ? `/invoices/${n.entity_id}` : "/invoices");
      } else if (type.includes("task") || type.includes("approval")) {
        router.push(n.entity_id ? `/tasks/${n.entity_id}` : "/tasks");
      } else if (type.includes("vendor")) {
        router.push(n.entity_id ? `/vendors/${n.entity_id}` : "/vendors");
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        title="Notifications"
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-neutral-900 animate-in zoom-in">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-2xl shadow-black/10 dark:shadow-black/50 z-50 overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[11px] font-semibold rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60">
            {recentNotifications.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 dark:text-neutral-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No notifications right now</p>
              </div>
            ) : (
              recentNotifications.map((n) => {
                const isUnread = !n.is_read && !n.read_at;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`px-4 py-3 flex items-start gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer ${
                      isUnread
                        ? "bg-blue-50/40 dark:bg-blue-950/20"
                        : "opacity-85"
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0 p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                      {getNotificationIcon(n.notification_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1 mb-0.5">
                        <p
                          className={`text-xs truncate ${
                            isUnread
                              ? "font-semibold text-neutral-900 dark:text-neutral-100"
                              : "font-medium text-neutral-700 dark:text-neutral-300"
                          }`}
                        >
                          {n.title}
                        </p>
                        <span className="text-[10px] text-neutral-400 flex-shrink-0">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                        {n.body}
                      </p>
                    </div>
                    {isUnread && (
                      <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50/80 dark:bg-neutral-900/80 border-t border-neutral-100 dark:border-neutral-800 text-[11px]">
            <div className="flex items-center gap-1.5 text-neutral-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-emerald-500" : "bg-amber-400 animate-pulse"
                }`}
              />
              <span>{isConnected ? "Live connected" : "Connecting..."}</span>
            </div>
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>View all</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
