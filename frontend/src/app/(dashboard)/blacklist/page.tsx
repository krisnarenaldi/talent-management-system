"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";
import api from "@/lib/api";
import { blacklistApi } from "@/lib/api/blacklist";
import type { Blacklist, BlacklistStatusType } from "@/types";

function getErrorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;
}

export default function BlacklistPage() {
  const queryClient = useQueryClient();
  const isRole = useAuthStore((state) => state.isRole);
  const showToast = useToastStore((state) => state.showToast);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusTypeFilter, setStatusTypeFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");

  const { data: statusTypes = [] } = useQuery({
    queryKey: ["blacklist-status-types"],
    queryFn: async () => {
      const response = await api.get("/api/v1/admin/blacklist-status-types");
      return response.data as BlacklistStatusType[];
    },
  });

  const { data: blacklistItems = [], isLoading } = useQuery<Blacklist[]>({
    queryKey: ["blacklist", { searchTerm, statusTypeFilter, approvalFilter }],
    queryFn: () =>
      blacklistApi.list({
        search: searchTerm || undefined,
        status_type_id: statusTypeFilter || undefined,
        approval_status: (approvalFilter || "all") as "pending" | "approved" | "all",
      }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => blacklistApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
      showToast("success", "Blacklist berhasil disetujui.");
    },
    onError: (err) => showToast("error", getErrorMessage(err, "Gagal menyetujui blacklist.")),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => blacklistApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
      showToast("success", "Blacklist berhasil dicabut.");
    },
    onError: (err) => showToast("error", getErrorMessage(err, "Gagal mencabut blacklist.")),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Manajemen</p>
          <h1 className="text-2xl font-bold text-gray-900">Blacklist</h1>
        </div>
        <Link
          href="/blacklist/new"
          className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          + Tambah Blacklist
        </Link>
      </div>

      {/* Filter */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Cari
            </label>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nama target"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Status Type
            </label>
            <select
              value={statusTypeFilter}
              onChange={(e) => setStatusTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">Semua</option>
              {statusTypes.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Status Approval
            </label>
            <select
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="all">Semua</option>
              <option value="pending">Pending</option>
              <option value="approved">Disetujui</option>
            </select>
          </div>
        </div>
      </div>

      {/* DataTable */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Nama Target</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status Type</th>
                <th className="px-4 py-3">Alasan</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">PIC</th>
                <th className="px-4 py-3">Approval</th>
                {isRole("manager", "admin") && (
                  <th className="px-4 py-3 text-right">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                    Memuat data blacklist...
                  </td>
                </tr>
              ) : blacklistItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                    Belum ada data blacklist.
                  </td>
                </tr>
              ) : (
                blacklistItems.map((item) => (
                  <tr key={item.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {item.target_name}
                      <span className="ml-2 text-xs rounded bg-gray-200 px-1.5 py-0.5">
                        {item.target_type === "candidate" ? "Kandidat" : "Karyawan"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.target_email || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {item.status_type_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-600">{item.reason || "-"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {item.blacklisted_date ? new Date(item.blacklisted_date).toLocaleDateString("id-ID") : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.pic_name || "-"}</td>
                    <td className="px-4 py-3">
                      {item.is_approved ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Disetujui
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          Pending
                        </span>
                      )}
                    </td>
                    {isRole("manager", "admin") && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {!item.is_approved && (
                            <button
                              onClick={() => approveMutation.mutate(item.id)}
                              disabled={approveMutation.isPending}
                              className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm mr-1">check</span>
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => revokeMutation.mutate(item.id)}
                            disabled={revokeMutation.isPending}
                            className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm mr-1">delete</span>
                            Cabut
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500 bg-gray-50">
          Total: {blacklistItems.length} entri
        </div>
      </div>
    </div>
  );
}
