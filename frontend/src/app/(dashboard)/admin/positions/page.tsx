"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import Link from "next/link";
import api from "@/lib/api";
import type { PositionByClient } from "@/types";
import { useAuthStore } from "@/stores/auth.store";

async function fetchPositionsByClient(): Promise<PositionByClient[]> {
  const response = await api.get("/api/v1/positions/by-client");
  return response.data;
}

export default function AdminPositionsPage() {
  const router = useRouter();
  const isRole = useAuthStore((state) => state.isRole);
  const { user } = useAuthStore();

  const authorized = !!user && isRole("admin", "hr", "manager");

  const {
    data: rows = [],
    isLoading,
    isError,
    error,
  } = useQuery<PositionByClient[]>({
    queryKey: ["positions-by-client"],
    queryFn: fetchPositionsByClient,
    enabled: authorized,
  });

  useEffect(() => {
    if (user && !isRole("admin", "hr", "manager")) {
      router.replace("/dashboard");
    }
  }, [user, isRole, router]);

  if (!authorized) {
    return (
      <div className="p-container-padding">
        <div className="max-w-2xl mx-auto">
          <div className="bg-error-container border border-error/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-on-error-container">lock</span>
              <p className="text-body-sm text-on-error-container">
                Akses ditolak. Hanya Admin yang dapat mengelola posisi.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 403) {
      return (
        <div className="p-container-padding">
          <div className="max-w-2xl mx-auto">
            <div className="bg-error-container border border-error/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-on-error-container">lock</span>
                <p className="text-body-sm text-on-error-container">
                  Akses ditolak. Hanya Admin yang dapat mengelola posisi.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="p-container-padding">
      <div className="max-w-[1400px] mx-auto space-y-stack-md">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-headline-lg font-bold text-on-surface">Kelola Posisi</h1>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Daftar klien dan jumlah posisi
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0px_4px_12px_rgba(9,30,66,0.08)] overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-2xl mb-2 block">
                progress_activity
              </span>
              <p>Memuat data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-label-md text-on-surface-variant">
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">Klien</th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">Jumlah Posisi</th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">Terakhir Dibuat</th>
                  </tr>
                </thead>
                <tbody className="text-body-sm divide-y divide-outline-variant">
                  {rows.map((row) => (
                    <tr
                      key={row.client_id}
                      className="hover:bg-surface-container-low/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/positions/${row.client_id}`}
                          className="text-primary font-semibold hover:underline"
                        >
                          {row.client_name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {row.total_positions} Posisi
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {row.last_created_at
                          ? format(new Date(row.last_created_at), "dd MMM yyyy", { locale: idLocale })
                          : "-"}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-3xl mb-2 block">
                          search_off
                        </span>
                        <p>Tidak ada data klien ditemukan.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="p-4 border-t border-outline-variant text-body-sm text-on-surface-variant flex justify-between items-center bg-surface-bright">
            <span>Total: {rows.length} klien</span>
          </div>
        </div>
      </div>
    </div>
  );
}
