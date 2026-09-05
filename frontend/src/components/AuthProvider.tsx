"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AuthUser } from "@/types";
import { useAuthStore } from "@/stores/auth.store";

async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await api.get("/api/v1/auth/me");
  return response.data;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  const isLoading = useAuthStore((state) => state.isLoading);

  const { data, isError } = useQuery({
    queryKey: ["auth.me"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    setLoading(true);
  }, []);

  useEffect(() => {
    if (data) {
      setUser(data);
      setLoading(false);
    }
  }, [data, setUser, setLoading]);

  useEffect(() => {
    if (isError) {
      setUser(null);
      setLoading(false);
      // Refresh halaman agar middleware bisa redirect ke login
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }, [isError, setUser, setLoading]);

  if (isLoading) {
    return null;
  }

  return <>{children}</>;
}
