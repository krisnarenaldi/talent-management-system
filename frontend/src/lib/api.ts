/**
 * Axios instance untuk semua panggilan ke FastAPI backend.
 * - Base URL menggunakan Next.js rewrites (/api → backend)
 * - Credentials: true untuk mengirim/menerima httpOnly cookie
 * - Interceptor: auto-refresh token jika response 401
 */
import axios from "axios";

const api = axios.create({
  baseURL: "",  // Menggunakan relative URL via Next.js rewrites
  withCredentials: true,  // Penting untuk httpOnly cookie
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor: auto-refresh jika 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
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
