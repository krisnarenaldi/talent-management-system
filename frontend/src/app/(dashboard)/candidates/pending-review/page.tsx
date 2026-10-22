"use client";

import Link from "next/link";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import { useToastStore } from "@/stores/toast.store";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface CandidateScreeningItem {
  id: string;
  cv_file_url?: string;
  cv_drive_item_id?: string;
  source_channel?: string;
  uploaded_by_name?: string;
  created_at: string;
  ai_notes?: string | null;
  status: string;
  extracted_json?: { nama?: string; [key: string]: unknown } | null;
}

export default function CandidatePendingReviewPage() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);

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
      showToast("success", "Item berhasil dihapus.");
    },
    onError: () => showToast("error", "Gagal menghapus item."),
  });

  const errorItems = items.filter((i) => i.status === "error");
  const inProgressItems = items.filter((i) => i.status === "menunggu_ekstraksi" || i.status === "sedang_diproses");

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
            <span className="text-gray-700">Review Ekstraksi CV</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">Review Ekstraksi CV Kandidat</h1>
          <p className="mt-1 text-sm text-gray-600">
            Daftar CV yang mengalami kendala pembacaan teks otomatis atau sedang dalam antrean ekstraksi AI.
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
              {retryMutation.isPending ? "Memproses..." : `Proses Ulang Semua (${errorItems.length})`}
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

      {/* ── State Loading / Error / Empty ── */}
      {isLoading && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500 shadow-sm">
          <span className="material-symbols-outlined animate-spin text-3xl text-gray-400 mb-2">progress_activity</span>
          <p>Memuat daftar review CV...</p>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 shadow-sm">
          Gagal memuat data review CV kandidat.
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <span className="material-symbols-outlined text-5xl text-emerald-500 mb-3">check_circle</span>
          <h3 className="text-base font-semibold text-gray-900">Semua CV Berhasil Diproses!</h3>
          <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
            Tidak ada CV yang gagal diekstrak atau tertunda. Seluruh kandidat telah otomatis masuk ke Database Kandidat.
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

      {/* ── List Items ── */}
      {!isLoading && !isError && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const isErrorStatus = item.status === "error";
            const isProcessing = item.status === "menunggu_ekstraksi" || item.status === "sedang_diproses";

            return (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  {/* Candidate name row */}
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {item.extracted_json?.nama || (
                      <span className="text-gray-600">
                        {item.cv_file_url
                          ? decodeURIComponent(item.cv_file_url.split("/").pop()?.split("?")[0] ?? "")
                          : <span className="italic text-gray-400">Nama tidak tersedia</span>}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isErrorStatus
                          ? "bg-red-100 text-red-700"
                          : isProcessing
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">
                        {isErrorStatus ? "error" : "sync"}
                      </span>
                      {isErrorStatus ? "Gagal Ekstrak" : isProcessing ? "Sedang Diproses" : item.status}
                    </span>
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
                    <p className="text-sm text-red-600 bg-red-50/60 p-2.5 rounded-lg border border-red-100">
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
                  <Link
                    href={`/candidates/manual/new`}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    <span className="material-symbols-outlined text-sm">edit_note</span>
                    Input Manual
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm("Apakah Anda yakin ingin menghapus CV ini dari antrean review?")) {
                        deleteMutation.mutate(item.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-red-600"
                    title="Hapus"
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
