"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { startTokenRefreshTimer, stopTokenRefreshTimer } from "@/lib/tokenRefresh";

/**
 * Provider yang mengaktifkan timer refresh token proaktif.
 * Timer dimulai ketika user login dan dihentikan saat logout.
 */
export default function TokenRefreshProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(state => state.user);
  const isLoading = useAuthStore(state => state.isLoading);

  useEffect(() => {
    if (!isLoading && user) {
      startTokenRefreshTimer(30 * 60 * 1000); // 30 menit
    } else {
      stopTokenRefreshTimer();
    }

    return () => stopTokenRefreshTimer();
  }, [user, isLoading]);

  return <>{children}</>;
}