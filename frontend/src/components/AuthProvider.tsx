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
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);

  const { data, isError, isFetching } = useQuery({
    queryKey: ["auth.me"],
    queryFn: fetchCurrentUser,
    staleTime: 0,
    retry: false,
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) {
      queryClient.removeQueries({ queryKey: ["auth.me"] });
      setLoading(false);
    }
  }, [user, queryClient, setLoading]);

  useEffect(() => {
    if (data) {
      setUser(data);
    }
  }, [data, setUser]);

  useEffect(() => {
    if (!isFetching && (data || user)) {
      setLoading(false);
    }
  }, [data, isFetching, setLoading, user]);

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
