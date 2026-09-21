"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";

export interface NotificationData {
  id: string;
  user_id: string;
  type: string;
  message: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

async function fetchNotifications() {
  const response = await api.get("/api/v1/notifications/");
  return response.data as NotificationData[];
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30000,
    retry: 1,
    throwOnError: false,
  });

  const user = useAuthStore((s) => s.user);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Tutup dropdown kalau klik di luar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (isLoading) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary-container transition-colors"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-xs font-medium text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown — hanya tampil saat open */}
      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-surface border border-outline-variant rounded-xl shadow-lg z-50">
          <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
            <p className="text-body-sm text-on-surface font-medium">
              Notifikasi {unreadCount > 0 && <span className="text-red-600">({unreadCount})</span>}
            </p>
            {unreadCount > 0 && (
              <button
                onClick={async () => {
                  await api.patch("/api/v1/notifications/read-all", {}).catch(() => {});
                  queryClient.invalidateQueries({ queryKey: ["notifications"] });
                }}
                className="text-xs text-primary hover:underline"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-caption text-on-surface-variant">
                Tidak ada notifikasi
              </div>
            ) : (
              <div className="divide-y divide-outline-variant">
                {notifications.slice(0, 10).map((notif) => (
                  <div
                    key={notif.id}
                    title={notif.message}
                    onClick={() => {
                      setOpen(false);
                      if (!notif.is_read) {
                        api.patch(`/api/v1/notifications/${notif.id}/read`, {})
                          .then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))
                          .catch(() => {});
                      }
                      if (notif.link && notif.link !== "#") {
                        window.location.href = notif.link;
                      }
                    }}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-surface-container-highest transition-colors cursor-pointer ${
                      notif.is_read ? "opacity-60" : ""
                    }`}
                  >
                    <span className="material-symbols-outlined text-primary text-base mt-0.5 shrink-0">
                      {getNotificationIcon(notif.type)}
                    </span>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {!notif.is_read && (
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1 align-middle" />
                      )}
                      <p className="text-body-sm text-on-surface truncate">{notif.message}</p>
                      <p className="text-caption text-on-surface-variant">
                        {new Date(notif.created_at).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case "ai_screening_done":
      return "psychology";
    case "contract_expiring":
      return "fact_check";
    case "application_status":
      return "task_alt";
    case "system_alert":
      return "warning";
    default:
      return "notifications";
  }
}