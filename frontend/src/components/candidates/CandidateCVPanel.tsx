"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";
import { getErrorMessage } from "@/lib/errors";
import type { CVGenerateRequest, CVGenerateResponse, GeneratedCV } from "@/types";

async function fetchCVList(candidateId: string): Promise<GeneratedCV[]> {
  const res = await api.get(`/api/v1/candidates/${candidateId}/cv/`);
  return res.data;
}

async function generateCV(
  candidateId: string,
  payload: CVGenerateRequest,
): Promise<CVGenerateResponse> {
  const res = await api.post(`/api/v1/candidates/${candidateId}/cv/generate`, payload);
  return res.data;
}

function formatSafeDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return format(d, "d MMM yyyy, HH:mm", { locale: idLocale });
}

export default function CandidateCVPanel({ candidateId }: { candidateId: string }) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const showToast = useToastStore((s) => s.showToast);

  const [language, setLanguage] = useState<"ID" | "EN">("ID");
  const [manualSummary, setManualSummary] = useState("");
  const [forceRegenerate, setForceRegenerate] = useState(false);

  const { data: cvList = [], isLoading: cvLoading } = useQuery({
    queryKey: ["candidate-cv-list", candidateId],
    queryFn: () => fetchCVList(candidateId),
    enabled: !!candidateId,
  });

  const canEdit =
    currentUser?.role === "hr" ||
    currentUser?.role === "manager" ||
    currentUser?.role === "admin";

  const mutation = useMutation({
    mutationFn: (payload: CVGenerateRequest) => generateCV(candidateId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["candidate-cv-list", candidateId] });
      if (data.was_cached) {
        showToast("info", "CV masih fresh — data kandidat belum berubah.");
      } else {
        showToast("success", "CV berhasil digenerate!");
      }
      setForceRegenerate(false);
    },
    onError: (err) => {
      showToast("error", getErrorMessage(err));
    },
  });

  const handleGenerate = () => {
    mutation.mutate({
      language,
      summary_text: manualSummary.trim() || null,
      force_regenerate: forceRegenerate,
    });
  };

  const latestCV = cvList[0] ?? null;
  const isStale = latestCV?.is_stale ?? true;

  return (
    <div className="space-y-5">
      {/* Stale warning */}
      {latestCV && isStale && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="material-symbols-outlined mt-0.5 text-base text-amber-500">warning</span>
          <span>
            Data kandidat telah diperbarui sejak CV ini digenerate.{" "}
            <button
              className="font-medium underline"
              onClick={() => {
                setForceRegenerate(true);
                setTimeout(handleGenerate, 0);
              }}
            >
              Generate ulang sekarang
            </button>
            .
          </span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        {/* ── Generate panel ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            {/* Language toggle */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Bahasa Summary
              </label>
              <div className="flex gap-2">
                {(["ID", "EN"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      language === lang
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">language</span>
                    {lang === "ID" ? "Indonesia" : "English"}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary override */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Summary{" "}
                <span className="normal-case font-normal text-gray-400">
                  (opsional — AI generate jika kosong)
                </span>
              </label>
              <textarea
                value={manualSummary}
                onChange={(e) => setManualSummary(e.target.value)}
                rows={3}
                placeholder="Kosongkan agar digenerate otomatis oleh AI…"
                className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
              />
              {manualSummary.trim() && (
                <p className="mt-1 text-xs text-blue-600">
                  Summary ini akan dipakai dan tidak ditimpa AI saat regenerate.
                </p>
              )}
            </div>

            {/* Force regenerate checkbox — hanya tampil jika sudah ada CV fresh */}
            {latestCV && !isStale && (
              <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={forceRegenerate}
                  onChange={(e) => setForceRegenerate(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                />
                Paksa generate ulang
              </label>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={mutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mutation.isPending ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-base">autorenew</span>
                    Sedang generate…
                  </>
                ) : latestCV ? (
                  <>
                    <span className="material-symbols-outlined text-base">refresh</span>
                    {forceRegenerate ? "Regenerate CV" : "Cek & Generate"}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">description</span>
                    Generate CV
                  </>
                )}
              </button>
            )}

            {latestCV && !isStale && !forceRegenerate && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                <span className="material-symbols-outlined text-base">check_circle</span>
                CV sudah up-to-date.
              </p>
            )}
          </div>
        </div>

        {/* ── CV history ── */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-700">Riwayat CV</h3>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {cvList.length} versi
              </span>
            </div>

            {cvLoading ? (
              <div className="flex h-32 items-center justify-center text-sm text-gray-400">
                <span className="material-symbols-outlined animate-spin mr-2 text-base">autorenew</span>
                Memuat…
              </div>
            ) : cvList.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-gray-400">
                <span className="material-symbols-outlined text-3xl opacity-40">description</span>
                <p className="text-sm">Belum ada CV yang digenerate.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {cvList.map((cv, idx) => (
                  <li key={cv.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {cv.language ?? "ID"}
                        </span>
                        {cv.summary_source === "HR" && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            Manual
                          </span>
                        )}
                        {cv.summary_source === "AI" && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            AI
                          </span>
                        )}
                        {cv.is_stale && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Outdated
                          </span>
                        )}
                        {idx === 0 && !cv.is_stale && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            ✓ Terbaru
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{formatSafeDate(cv.generated_at)}</p>
                      {cv.summary_text && (
                        <p className="max-w-xs truncate text-xs italic text-gray-500">
                          "{cv.summary_text}"
                        </p>
                      )}
                    </div>
                    {cv.file_url && (
                      <div className="flex shrink-0 gap-1.5">
                        <a
                          href={cv.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Buka CV"
                          className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
                        >
                          <span className="material-symbols-outlined text-base">open_in_new</span>
                        </a>
                        <a
                          href={cv.file_url}
                          download
                          title="Download CV"
                          className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-blue-500 hover:bg-blue-100"
                        >
                          <span className="material-symbols-outlined text-base">download</span>
                        </a>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
