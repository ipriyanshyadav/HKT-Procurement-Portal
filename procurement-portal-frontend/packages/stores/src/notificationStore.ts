import { create } from "zustand";

export interface NotificationItem {
  id: string;
  org_id: string;
  user_id: string;
  notification_type: string;
  channel: "EMAIL" | "SMS" | "IN_APP" | "WHATSAPP" | "DIGEST";
  title: string;
  body: string;
  entity_type?: string | null;
  entity_id?: string | null;
  status: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "BOUNCED";
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  error_message?: string | null;
  retry_count: number;
  created_at: string;
  is_read: boolean;
}

export interface NotificationPreference {
  notification_type: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  inapp_enabled: boolean;
  digest_mode: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

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

export interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  isConnected: boolean;
  toasts: NotificationToastItem[];
  setConnected: (connected: boolean) => void;
  setNotifications: (items: NotificationItem[], unread?: number) => void;
  addNotification: (item: NotificationItem) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  addToast: (toast: NotificationToastItem) => void;
  dismissToast: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isConnected: false,
  toasts: [],

  setConnected: (connected: boolean) => set({ isConnected: connected }),

  setNotifications: (items: NotificationItem[], unread?: number) =>
    set(() => {
      const calculatedUnread =
        typeof unread === "number"
          ? unread
          : items.filter((n) => !n.is_read && !n.read_at).length;
      return {
        notifications: items,
        unreadCount: calculatedUnread,
      };
    }),

  addNotification: (item: NotificationItem) =>
    set((state) => {
      // Deduplicate by ID if already present
      const exists = state.notifications.some((n) => n.id === item.id);
      if (exists) {
        return state;
      }
      const newItems = [item, ...state.notifications];
      const isUnread = !item.is_read && !item.read_at;
      return {
        notifications: newItems,
        unreadCount: state.unreadCount + (isUnread ? 1 : 0),
      };
    }),

  markAsRead: (id: string) =>
    set((state) => {
      let wasUnread = false;
      const updated = state.notifications.map((n) => {
        if (n.id === id) {
          if (!n.is_read && !n.read_at) {
            wasUnread = true;
          }
          return { ...n, is_read: true, read_at: new Date().toISOString() };
        }
        return n;
      });
      return {
        notifications: updated,
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    }),

  markAllAsRead: () =>
    set((state) => {
      const now = new Date().toISOString();
      const updated = state.notifications.map((n) => ({
        ...n,
        is_read: true,
        read_at: n.read_at || now,
      }));
      return {
        notifications: updated,
        unreadCount: 0,
      };
    }),

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

  addToast: (toast: NotificationToastItem) =>
    set((state) => ({
      toasts: [...state.toasts.filter((t) => t.id !== toast.id), toast],
    })),

  dismissToast: (id: string) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
