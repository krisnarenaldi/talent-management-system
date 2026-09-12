"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AuthUser } from "@/types";
import { useAuthStore } from "@/stores/auth.store";

async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await api.get("/api/v1/auth/me");
  return response.data;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Selalu fetch /auth/me saat mount — tidak bergantung pada Zustand user
  // sehingga hard refresh (store kosong) tetap bisa hydrate user dari cookie
  const { data, isError, isFetching } = useQuery({
    queryKey: ["auth.me"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000, // cache 5 menit
    retry: false,
  });

  useEffect(() => {
    if (data) {
      setUser(data);
      setLoading(false);
    }
  }, [data, setUser, setLoading]);

  useEffect(() => {
    if (!isFetching && !data) {
      // fetch selesai tapi tidak ada data → tidak ada sesi aktif
      setLoading(false);
    }
  }, [isFetching, data, setLoading]);

  useEffect(() => {
    if (isError) {
      setUser(null);
      queryClient.removeQueries({ queryKey: ["auth.me"] });
      setLoading(false);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }, [isError, setUser, queryClient, setLoading]);

  if (isLoading) {
    return null;
  }

  return <>{children}</>;
}
