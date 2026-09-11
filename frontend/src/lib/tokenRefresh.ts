/**
 * Token refresh manager — proactive refresh sebelum token expired.
 * - Menyimpan flag isRefreshing agar tidak ada refresh ganda.
 * - Menunda request yang terjadi saat refresh berlangsung (queue).
 * - Timer otomatis refresh setiap intervalMs (default 30 menit).
 */
import axios from "axios";

const AUTH_ENDPOINTS = ["/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/logout", "/api/v1/auth/me"];

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

/**
 * Refresh token secara eksplisit.
 * Dipanggil oleh timer atau oleh interceptor ketika terjadi 401.
 */
export async function refreshToken(): Promise<void> {
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    await axios.post("/api/v1/auth/refresh", {}, { withCredentials: true });
    processQueue(null);
  } catch (error) {
    processQueue(error);
    // Refresh gagal → redirect ke login
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  } finally {
    isRefreshing = false;
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Mulai timer refresh berkala.
 * @param intervalMs interval dalam milidetik (default 30 menit).
 */
export function startTokenRefreshTimer(intervalMs = 30 * 60 * 1000): void {
  if (typeof window === "undefined") return;
  stopTokenRefreshTimer();

  const schedule = () => {
    refreshTimer = setTimeout(async () => {
      await refreshToken();
      schedule();
    }, intervalMs);
  };

  schedule();
}

/**
 * Hentikan timer refresh.
 */
export function stopTokenRefreshTimer(): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Cek apakah URL termasuk endpoint auth (tidak perlu di-refresh).
 */
export function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_ENDPOINTS.some(ep => url.endsWith(ep));
}