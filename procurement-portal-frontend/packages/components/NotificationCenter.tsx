"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Check,
  Filter,
  Search,
  ShoppingCart,
  FileText,
  Package,
  Receipt,
  AlertTriangle,
  Info,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { useNotificationStore, type NotificationItem } from "@procurement/stores";
import {
  useNotificationsList,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@procurement/hooks";

type FilterTab = "ALL" | "UNREAD" | "SOURCING" | "PURCHASING" | "FINANCE" | "ALERTS";

function getNotificationIcon(type: string) {
  const norm = type.toLowerCase();
  if (norm.includes("pr") || norm.includes("requisition")) {
    return <ShoppingCart className="w-5 h-5 text-amber-500" />;
  }
  if (norm.includes("rfq") || norm.includes("bid") || norm.includes("tender")) {
    return <FileText className="w-5 h-5 text-blue-500" />;
  }
  if (norm.includes("po") || norm.includes("order")) {
    return <Package className="w-5 h-5 text-emerald-500" />;
  }
  if (norm.includes("invoice") || norm.includes("payment")) {
    return <Receipt className="w-5 h-5 text-indigo-500" />;
  }
  if (norm.includes("sla") || norm.includes("warning") || norm.includes("alert") || norm.includes("hold")) {
    return <AlertTriangle className="w-5 h-5 text-red-500" />;
  }
  return <Info className="w-5 h-5 text-neutral-400" />;
}

export function NotificationCenter() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: notifsData, isLoading } = useNotificationsList({
    page,
    page_size: pageSize,
    unread_only: activeTab === "UNREAD",
  });

  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const items = notifsData?.items || [];
  const meta = notifsData?.meta;

  const filteredItems = items.filter((item) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = item.title.toLowerCase().includes(q);
      const matchesBody = item.body.toLowerCase().includes(q);
      if (!matchesTitle && !matchesBody) return false;
    }

    // Category filter
    const norm = item.notification_type.toLowerCase();
    if (activeTab === "SOURCING") {
      return norm.includes("rfq") || norm.includes("bid") || norm.includes("award") || norm.includes("vendor");
    }
    if (activeTab === "PURCHASING") {
      return norm.includes("pr") || norm.includes("po") || norm.includes("order") || norm.includes("grn");
    }
    if (activeTab === "FINANCE") {
      return norm.includes("invoice") || norm.includes("payment") || norm.includes("dispute");
    }
    if (activeTab === "ALERTS") {
      return norm.includes("sla") || norm.includes("warning") || norm.includes("alert") || norm.includes("hold") || norm.includes("escalation");
    }
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Notification Center</span>
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Real-time updates, approval actions, and system alerts
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Control Bar: Filter Tabs + Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        {/* Tabs */}
        <div className="flex-1 flex items-center gap-1.5 p-1.5 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl border border-neutral-200/60 dark:border-neutral-800 overflow-x-auto scrollbar-none">
          {[
            { id: "ALL", label: "All" },
            { id: "UNREAD", label: `Unread (${unreadCount})` },
            { id: "SOURCING", label: "Sourcing & RFQ" },
            { id: "PURCHASING", label: "Purchasing" },
            { id: "FINANCE", label: "Invoices & Payments" },
            { id: "ALERTS", label: "Alerts & SLAs" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id as FilterTab);
                setPage(1);
              }}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-lg text-xs font-medium whitespace-nowrap text-center justify-center flex items-center transition-all ${
                activeTab === tab.id
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm font-semibold"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Notifications List Container */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl shadow-sm overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800/80">
        {isLoading ? (
          <div className="p-12 text-center text-neutral-400">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs">Loading notifications...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center text-neutral-400">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              No notifications found
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              You are all caught up for this filter category.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isUnread = !item.is_read && !item.read_at;
            return (
              <div
                key={item.id}
                className={`p-4 sm:p-5 flex items-start gap-4 transition-colors ${
                  isUnread
                    ? "bg-blue-50/30 dark:bg-blue-950/15"
                    : "hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30"
                }`}
              >
                {/* Channel / Type Icon */}
                <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex-shrink-0 mt-0.5">
                  {getNotificationIcon(item.notification_type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <h4
                      className={`text-sm ${
                        isUnread
                          ? "font-semibold text-neutral-900 dark:text-neutral-100"
                          : "font-medium text-neutral-700 dark:text-neutral-300"
                      }`}
                    >
                      {item.title}
                    </h4>
                    <span className="text-xs text-neutral-400">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-2">
                    {item.body}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                      {item.notification_type}
                    </span>
                    <span>Channel: {item.channel}</span>
                    {item.entity_type && (
                      <span className="capitalize">
                        Entity: {item.entity_type.replace("_", " ")}
                      </span>
                    )}
                    {item.entity_type && item.entity_id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!item.is_read && !item.read_at) {
                            markReadMutation.mutate(item.id);
                          }
                          const type = item.entity_type!.toLowerCase();
                          if (type.includes("req") || type === "pr") {
                            router.push(`/requisitions/${item.entity_id}`);
                          } else if (type === "rfq" || type === "sourcing" || type === "bid") {
                            router.push(`/rfqs/${item.entity_id}`);
                          } else if (type.includes("order") || type === "po") {
                            router.push(`/purchase-orders/${item.entity_id}`);
                          } else if (type.includes("invoice") || type.includes("payment")) {
                            router.push(`/invoices/${item.entity_id}`);
                          } else if (type.includes("task") || type.includes("approval")) {
                            router.push(`/tasks/${item.entity_id}`);
                          } else if (type.includes("vendor")) {
                            router.push(`/vendors/${item.entity_id}`);
                          }
                        }}
                        className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline ml-auto"
                      >
                        <span>View Document</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Mark as read button */}
                {isUnread && (
                  <button
                    type="button"
                    onClick={() => markReadMutation.mutate(item.id)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {meta && meta.total > pageSize && (
        <div className="flex items-center justify-between mt-4 px-2 text-xs text-neutral-500">
          <span>
            Page {meta.page} of {Math.ceil(meta.total / pageSize)} ({meta.total} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= Math.ceil(meta.total / pageSize)}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
