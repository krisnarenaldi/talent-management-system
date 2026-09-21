"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface PendingReviewData {
  id: string;
  cv_file_url: string;
  cv_drive_item_id: string;
  position_title: string;
  client_name?: string;
  uploaded_by_name?: string;
  created_at: string;
  ai_score?: number | null;
  ai_notes?: string | null;
  extracted_json?: Record<string, unknown> | null;
  status: string;
}

async function fetchPendingReviews() {
  const user = useAuthStore.getState().user;
  const params: Record<string, string | string[]> = {};

  // If user is HR (not manager), only show their uploads
  const role = user?.role;
  if (role === "hr" && user?.id) {
    params.uploaded_by = user.id;
  }

  // Include "error" so failed CVs also appear (not just silently hidden)
  const response = await api.get("/api/v1/applications/pending-review", {
    params: {
      ...params,
      status: ["siap_review", "menunggu_screening_ai", "sedang_diproses", "error"],
    },
    paramsSerializer: (p) =>
      Object.entries(p)
        .flatMap(([k, v]) =>
          Array.isArray(v) ? v.map((val) => `${k}=${encodeURIComponent(val)}`) : [`${k}=${encodeURIComponent(v as string)}`]
        )
        .join("&"),
  });
  return response.data as PendingReviewData[];
}

export default function PendingReviewPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);

  const { data: screenings = [], isLoading, isError } = useQuery({
    queryKey: ["pending-reviews", user?.id, user?.role],
    queryFn: fetchPendingReviews,
    // Auto-refresh setiap 10 detik selama masih ada CV yang sedang diproses
    refetchInterval: (query) => {
      const data = query.state.data as PendingReviewData[] | undefined;
      const hasPending = data?.some(
        (s) => s.status === "menunggu_screening_ai" || s.status === "sedang_diproses"
      );
      return hasPending ? 10_000 : false;
    },
  });

  const errorCount = screenings.filter((s) => s.status === "error").length;

  const retryOneMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/v1/applications/screening/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-reviews"] });
      showToast("success", "CV di-enqueue ulang untuk diproses.");
    },
    onError: () => showToast("error", "Gagal melakukan retry."),
  });

  const deleteOneMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/v1/applications/screening/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-reviews"] });
      showToast("success", "Data screening berhasil dihapus.");
    },
    onError: () => showToast("error", "Gagal menghapus data."),
  });

  function handleDeleteOne(id: string) {
    if (!window.confirm("Hapus data screening CV ini? Tindakan ini tidak dapat dibatalkan.")) return;
    deleteOneMutation.mutate(id);
  }

  const retryAllMutation = useMutation({
    mutationFn: () =>
      api.post("/api/v1/applications/screening/retry-all-errors"),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["pending-reviews"] });
      showToast("success", res.data.message);
    },
    onError: () => showToast("error", "Gagal melakukan retry semua."),
  });

  if (isLoading) return <div className="p-8 text-center">Memuat data...</div>;
  if (isError) return <div className="p-8 text-center text-red-500">Gagal memuat data</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">CV Siap Direview</h1>
        <div className="flex items-center gap-3">
          {errorCount > 0 && (
            <button
              onClick={() => retryAllMutation.mutate()}
              disabled={retryAllMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              {retryAllMutation.isPending
                ? "Memproses..."
                : `Proses Ulang Semua (${errorCount})`}
            </button>
          )}
          <button
            onClick={() => {
              api.patch("/api/v1/notifications/read-all", {}).catch(console.error);
            }}
            className="text-xs font-medium text-primary hover:text-primary-dark"
          >
            Tandai semua notifikasi sebagai dibaca
          </button>
        </div>
      </div>

      {screenings.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <p>Tidak ada CV yang siap direview</p>
        </div>
      ) : (
        <div className="space-y-4">
          {screenings.map((screening) => (
            <div key={screening.id} className="border border-outline-variant rounded-xl p-4">
              <div className="flex items-start gap-4">
                {/* CV Info */}
                <div className="flex-1 min-w-0">
                  <div className="mb-2">
                    <h2 className="text-lg font-semibold truncate">
                      {screening.cv_file_url
                        .split("/")
                        .pop()
                        ?.split("%2F")
                        .pop()
                        ?.replace(/_/g, " ") ||
                        "CV.pdf"}
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                      {screening.position_title} at{" "}
                      {screening.client_name || "-"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                      <p className="font-medium text-on-surface">Uploaded by</p>
                      <p className="text-on-surface-variant">
                        {screening.uploaded_by_name || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-on-surface">Tanggal upload</p>
                      <p className="text-on-surface-variant">
                        {format(
                          new Date(screening.created_at),
							"dd MMM yyyy HH:mm",
							{ locale: idLocale }
						)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-on-surface">AI Score</p>
                      <div className="flex items-center gap-2">
                        {screening.ai_score != null ? (
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            screening.ai_score >= 80
                              ? "bg-emerald-100 text-emerald-800"
                              : screening.ai_score >= 60
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {screening.ai_score}
                          </span>
                        ) : screening.status === "siap_review" ? (
                          <span className="text-on-surface-variant text-xs">Tidak tersedia</span>
                        ) : (
                          <span className="text-on-surface-variant text-xs">Menunggu...</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-on-surface">Status</p>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        screening.status === "siap_review"
                          ? "bg-blue-100 text-blue-800"
                          : screening.status === "sedang_diproses"
                          ? "bg-yellow-100 text-yellow-800"
                          : screening.status === "error"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {screening.status === "siap_review"
                          ? "Siap Review"
                          : screening.status === "sedang_diproses"
                          ? "Sedang Diproses"
                          : screening.status === "error"
                          ? "Gagal Diproses"
                          : "Menunggu Screening"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  {screening.status === "siap_review" ? (
                    <Link
                      href={`/applications/pending-review/${screening.id}`}
                      className="w-full flex items-center justify-between rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                    >
                      <span>Review</span>
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </Link>
                  ) : screening.status === "error" ? (
                    <button
                      onClick={() => retryOneMutation.mutate(screening.id)}
                      disabled={retryOneMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                      <span>Proses Ulang</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed">
                      <span>Menunggu...</span>
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteOne(screening.id)}
                    disabled={deleteOneMutation.isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-outline px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:bg-error/10 hover:border-error hover:text-error disabled:opacity-50 transition-colors"
                    title="Hapus data screening ini"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Hapus</span>
                  </button>
                </div>
              </div>

              {/* Error notes */}
              {screening.status === "error" && screening.ai_notes && (
                <div className="mt-3 pt-3 border-t border-red-100">
                  <p className="text-xs text-red-600 font-medium">Alasan kegagalan:</p>
                  <p className="mt-0.5 text-xs text-red-500 font-mono break-all">{screening.ai_notes}</p>
                </div>
              )}

              {/* Extracted Data Preview (collapsible) */}
              {screening.extracted_json && (
                <div className="mt-4 pt-3 border-t border-outline-variant">
                  <button
                    className="w-full text-left text-xs font-medium text-primary hover:text-primary-dark"
                    onClick={(e) => {
                      const button = e.currentTarget as HTMLButtonElement;
                      const content = button.nextElementSibling as HTMLElement;
                      if (content) {
                        content.classList.toggle("hidden");
                        button.textContent =
                          content.classList.contains("hidden")
                            ? "Lihat hasil ekstraksi"
                            : "Sembunyikan hasil ekstraksi";
                      }
                    }}
                  >
                    Lihat hasil ekstraksi
                  </button>
                  <div className="mt-2 space-y-2 hidden">
                    <div className="text-sm">
                      <strong>Data yang diekstrak:</strong>
                    </div>
                    <pre className="mt-1 bg-surface-container-highest p-3 rounded text-xs overflow-auto max-h-48">
                      {JSON.stringify(screening.extracted_json, null, 2)}
                    </pre>
                    {screening.ai_notes && (
                      <>
                        <div className="mt-2 text-sm">
                          <strong>Catatan AI:</strong>
                        </div>
                        <p className="mt-1 text-sm italic text-on-surface-variant">
                          {screening.ai_notes}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}