/**
 * Axios instance untuk semua panggilan ke FastAPI backend.
 * - Base URL menggunakan Next.js rewrites (/api → backend)
 * - Credentials: true untuk mengirim/menerima httpOnly cookie
 * - Interceptor: auto-refresh token jika response 401 (kecuali pada endpoint auth)
 */
import axios from "axios";

const AUTH_ENDPOINTS = ["/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/logout", "/api/v1/auth/me"];

const api = axios.create({
  baseURL: "",  // Menggunakan relative URL via Next.js rewrites
  withCredentials: true,  // Penting untuk httpOnly cookie
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor: auto-refresh jika 401 (skip untuk endpoint auth)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !AUTH_ENDPOINTS.some((ep) => originalRequest.url?.endsWith(ep))
    ) {
      originalRequest._retry = true;

      try {
        await axios.post("/api/v1/auth/refresh", {}, { withCredentials: true });
        return api(originalRequest);
      } catch {
        // Refresh gagal → redirect ke login
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
