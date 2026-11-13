"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import { useToastStore } from "@/stores/toast.store";
import { useAuthStore } from "@/stores/auth.store";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface CandidateScreeningItem {
  id: string;
  candidate_id?: string | null;
  candidate_name?: string | null;
  cv_file_url?: string;
  cv_drive_item_id?: string;
  source_channel?: string;
  uploaded_by_name?: string;
  created_at: string;
  ai_notes?: string | null;
  status: string;
  is_deleted_by_uploader?: boolean;
  extracted_json?: { nama?: string; [key: string]: unknown } | null;
}

export default function CandidatePendingReviewPage() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const isHR = user?.role === "hr";
  const canSeeAll = user?.role === "admin" || user?.role === "manager";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: items = [], isLoading, isError } = useQuery<CandidateScreeningItem[]>({
    queryKey: ["candidate-pending-reviews"],
    queryFn: async () => {
      const res = await api.get("/api/v1/candidates/pending-review");
      return res.data;
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => api.post("/api/v1/candidates/pending-review/retry-all-errors"),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["candidate-pending-reviews"] });
      showToast("success", res.data.message || "CV berhasil di-enqueue ulang.");
    },
    onError: () => showToast("error", "Gagal melakukan proses ulang."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/candidates/pending-review/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-pending-reviews"] });
      showToast("success", isHR ? "Item dihapus dari riwayat Anda." : "Log upload berhasil dihapus permanen.");
    },
    onError: () => showToast("error", "Gagal menghapus item."),
  });

  const successItems = items.filter((i) => i.status === "selesai");
  const duplicateItems = items.filter((i) => i.status === "duplikat");
  const errorItems = items.filter((i) => i.status === "error");
  const inProgressItems = items.filter((i) => i.status === "menunggu_ekstraksi" || i.status === "sedang_diproses");
  const blacklistItems = items.filter((i) => i.status === "blacklisted");

  const filteredItems = items.filter((item) => {
    if (statusFilter === "selesai" && item.status !== "selesai") return false;
    if (statusFilter === "duplikat" && item.status !== "duplikat") return false;
    if (statusFilter === "error" && item.status !== "error") return false;
    if (statusFilter === "in_progress" && item.status !== "menunggu_ekstraksi" && item.status !== "sedang_diproses") return false;
    if (statusFilter === "blacklisted" && item.status !== "blacklisted") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (item.candidate_name || item.extracted_json?.nama || "").toLowerCase();
      const filename = (item.cv_file_url ? decodeURIComponent(item.cv_file_url.split("/").pop()?.split("?")[0] ?? "") : "").toLowerCase();
      const uploader = (item.uploaded_by_name || "").toLowerCase();
      const notes = (item.ai_notes || "").toLowerCase();
      if (!name.includes(q) && !filename.includes(q) && !uploader.includes(q) && !notes.includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/candidates" className="hover:text-primary hover:underline">
              Database Kandidat
            </Link>
            <span>/</span>
            <span className="text-gray-700">Log Upload</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">Log Upload &amp; Review Ekstraksi CV</h1>
          <p className="mt-1 text-sm text-gray-600">
            {canSeeAll
              ? "Semua riwayat upload CV kandidat oleh tim recruiter & status ekstraksi AI."
              : "Riwayat upload CV kandidat Anda & status ekstraksi AI."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {errorItems.length > 0 && (
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              {retryMutation.isPending ? "Memproses..." : `Proses Ulang Gagal (${errorItems.length})`}
            </button>
          )}
          <Link
            href="/candidates/manual/new"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <span className="material-symbols-outlined text-sm">edit_note</span>
            Input Manual
          </Link>
        </div>
      </div>

      {/* ── Filter Tabs & Search ── */}
      {!isLoading && !isError && items.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === "all"
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              Semua ({items.length})
            </button>
            <button
              onClick={() => setStatusFilter("selesai")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === "selesai"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50"
              }`}
            >
              Berhasil ({successItems.length})
            </button>
            <button
              onClick={() => setStatusFilter("duplikat")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === "duplikat"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-white text-amber-800 border border-amber-200 hover:bg-amber-50"
              }`}
            >
              Duplikat ({duplicateItems.length})
            </button>
            <button
              onClick={() => setStatusFilter("error")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === "error"
                  ? "bg-red-600 text-white shadow-sm"
                  : "bg-white text-red-700 border border-red-200 hover:bg-red-50"
              }`}
            >
              Gagal ({errorItems.length})
            </button>
            {inProgressItems.length > 0 && (
              <button
                onClick={() => setStatusFilter("in_progress")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === "in_progress"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"
                }`}
              >
                Diproses ({inProgressItems.length})
              </button>
            )}
            {blacklistItems.length > 0 && (
              <button
                onClick={() => setStatusFilter("blacklisted")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === "blacklisted"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-white text-purple-700 border border-purple-200 hover:bg-purple-50"
                }`}
              >
                Blacklist ({blacklistItems.length})
              </button>
            )}
          </div>

          <div className="relative min-w-[220px]">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-sm text-gray-400">
              search
            </span>
            <input
              type="text"
              placeholder="Cari kandidat atau file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-800 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* ── State Loading / Error / Empty ── */}
      {isLoading && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500 shadow-sm">
          <span className="material-symbols-outlined animate-spin text-3xl text-gray-400 mb-2">progress_activity</span>
          <p>Memuat log upload CV...</p>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 shadow-sm">
          Gagal memuat log upload CV kandidat.
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <span className="material-symbols-outlined text-5xl text-gray-300 mb-3">folder_open</span>
          <h3 className="text-base font-semibold text-gray-900">Belum Ada Riwayat Upload CV</h3>
          <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
            {isHR
              ? "Anda belum mengunggah dokumen CV kandidat."
              : "Belum ada dokumen CV kandidat yang diunggah oleh tim recruiter."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/candidates"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Buka Database Kandidat
            </Link>
            <Link
              href="/candidates/new"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Upload CV Baru
            </Link>
          </div>
        </div>
      )}

      {/* ── Empty Filter State ── */}
      {!isLoading && !isError && items.length > 0 && filteredItems.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          <span className="material-symbols-outlined text-3xl text-gray-400 mb-1">filter_list_off</span>
          <p className="font-medium text-gray-700">Tidak ada log upload yang cocok</p>
          <p className="text-xs text-gray-400 mt-1">Coba ubah kata kunci pencarian atau ganti filter status.</p>
        </div>
      )}

      {/* ── List Items ── */}
      {!isLoading && !isError && filteredItems.length > 0 && (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isSuccess = item.status === "selesai";
            const isErrorStatus = item.status === "error";
            const isProcessing = item.status === "menunggu_ekstraksi" || item.status === "sedang_diproses";
            const isDuplicate = item.status === "duplikat";
            const isBlacklisted = item.status === "blacklisted";

            const rawFileName = item.cv_file_url
              ? decodeURIComponent(item.cv_file_url.split("/").pop()?.split("?")[0] ?? "")
              : "";
            const candidateName = item.candidate_name || item.extracted_json?.nama;
            const displayName = candidateName || rawFileName || "Nama tidak tersedia";

            return (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  {/* Candidate Name / File Name row */}
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {displayName}
                    </p>
                    {item.is_deleted_by_uploader && canSeeAll && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200">
                        Dihapus oleh HR (Arsip)
                      </span>
                    )}
                  </div>

                  {candidateName && rawFileName && (
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-gray-400">description</span>
                      {rawFileName}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isSuccess
                          ? "bg-emerald-100 text-emerald-800"
                          : isErrorStatus
                          ? "bg-red-100 text-red-700"
                          : isProcessing
                          ? "bg-blue-100 text-blue-700"
                          : isDuplicate
                          ? "bg-amber-100 text-amber-800"
                          : isBlacklisted
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">
                        {isSuccess
                          ? "check_circle"
                          : isErrorStatus
                          ? "error"
                          : isProcessing
                          ? "sync"
                          : isDuplicate
                          ? "content_copy"
                          : isBlacklisted
                          ? "block"
                          : "info"}
                      </span>
                      {isSuccess
                        ? "Berhasil Ekstrak"
                        : isErrorStatus
                        ? "Gagal Ekstrak"
                        : isProcessing
                        ? "Sedang Diproses"
                        : isDuplicate
                        ? "Duplikat Terdeteksi"
                        : isBlacklisted
                        ? "Blacklisted"
                        : item.status}
                    </span>

                    {item.uploaded_by_name && canSeeAll && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                        <span className="material-symbols-outlined text-xs">person</span>
                        {item.uploaded_by_name}
                      </span>
                    )}

                    {item.source_channel && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {item.source_channel}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {format(new Date(item.created_at), "dd MMM yyyy, HH:mm", { locale: idLocale })}
                    </span>
                  </div>

                  {item.ai_notes && (
                    <p
                      className={`text-sm p-2.5 rounded-lg border ${
                        isErrorStatus
                          ? "text-red-700 bg-red-50/70 border-red-200"
                          : isDuplicate
                          ? "text-amber-800 bg-amber-50/70 border-amber-200"
                          : "text-slate-700 bg-slate-50 border-slate-200"
                      }`}
                    >
                      <strong>Catatan AI:</strong> {item.ai_notes}
                    </p>
                  )}

                  {item.cv_file_url && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-600 pt-0.5">
                      <span className="material-symbols-outlined text-sm">attachment</span>
                      <a
                        href={item.cv_file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:underline"
                      >
                        Lihat / Unduh Dokumen CV
                      </a>
                    </div>
                  )}
                </div>

                {/* ── Action Buttons ── */}
                <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 pt-3 md:border-t-0 md:pt-0">
                  {item.candidate_id && (
                    <Link
                      href={`/candidates/${item.candidate_id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                    >
                      <span className="material-symbols-outlined text-sm">person</span>
                      Lihat Kandidat
                    </Link>
                  )}
                  {isErrorStatus && (
                    <Link
                      href={`/candidates/manual/new`}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      <span className="material-symbols-outlined text-sm">edit_note</span>
                      Input Manual
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      const confirmMsg = isHR
                        ? "Hapus item ini dari riwayat upload Anda?"
                        : "Apakah Anda yakin ingin menghapus permanen log upload ini?";
                      if (confirm(confirmMsg)) {
                        deleteMutation.mutate(item.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-red-600 transition"
                    title={isHR ? "Hapus dari riwayat Anda (Soft delete)" : "Hapus permanen (Hard delete)"}
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Hapus
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
