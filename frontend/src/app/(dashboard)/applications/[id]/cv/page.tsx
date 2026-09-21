"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Globe,
  RefreshCw,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";
import { getErrorMessage } from "@/lib/errors";
import type { Application, CVGenerateRequest, CVGenerateResponse, GeneratedCV } from "@/types";

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchApplication(id: string): Promise<Application> {
  const res = await api.get(`/api/v1/applications/${id}`);
  return res.data;
}

async function fetchCVList(applicationId: string): Promise<GeneratedCV[]> {
  const res = await api.get(`/api/v1/applications/${applicationId}/cv/`);
  return res.data;
}

async function generateCV(
  applicationId: string,
  payload: CVGenerateRequest
): Promise<CVGenerateResponse> {
  const res = await api.post(`/api/v1/applications/${applicationId}/cv/generate`, payload);
  return res.data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSafeDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return format(d, "d MMM yyyy, HH:mm", { locale: idLocale });
}

function summarySourceBadge(source: string | null | undefined) {
  if (source === "HR")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        Manual
      </span>
    );
  if (source === "AI")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        AI
      </span>
    );
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ApplicationCVPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const trimmedId = id.trim();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const showToast = useToastStore((s) => s.showToast);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [language, setLanguage] = useState<"ID" | "EN">("ID");
  const [manualSummary, setManualSummary] = useState("");
  const [forceRegenerate, setForceRegenerate] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: application, isLoading: appLoading } = useQuery({
    queryKey: ["application", trimmedId],
    queryFn: () => fetchApplication(trimmedId),
  });

  const {
    data: cvList = [],
    isLoading: cvLoading,
    refetch: refetchCVList,
  } = useQuery({
    queryKey: ["cv-list", trimmedId],
    queryFn: () => fetchCVList(trimmedId),
  });

  // ── Mutation ─────────────────────────────────────────────────────────────────
  const canEdit =
    currentUser?.role === "hr" ||
    currentUser?.role === "manager" ||
    currentUser?.role === "admin";

  const mutation = useMutation({
    mutationFn: (payload: CVGenerateRequest) => generateCV(trimmedId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cv-list", trimmedId] });
      if (data.was_cached) {
        showToast("info", "CV masih fresh — tidak perlu digenerate ulang.");
      } else {
        showToast("success", "CV berhasil digenerate!");
      }
      // Reset force flag after use
      setForceRegenerate(false);
    },
    onError: (err) => {
      showToast("error", getErrorMessage(err));
    },
  });

  const handleGenerate = () => {
    const payload: CVGenerateRequest = {
      language,
      summary_text: manualSummary.trim() || null,
      force_regenerate: forceRegenerate,
    };
    mutation.mutate(payload);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (appLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
        Memuat data lamaran...
      </div>
    );
  }

  if (!application) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
        <p>Lamaran tidak ditemukan.</p>
        <Link href="/applications" className="text-sm text-blue-600 underline">
          Kembali ke daftar lamaran
        </Link>
      </div>
    );
  }

  const latestCV = cvList[0] ?? null;
  const isStale = latestCV?.is_stale ?? true;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          href="/applications"
          className="hover:text-slate-700 hover:underline"
        >
          Lamaran
        </Link>
        <span>/</span>
        <Link
          href={`/applications/${trimmedId}`}
          className="hover:text-slate-700 hover:underline"
        >
          {application.candidate_name ?? trimmedId}
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">CV Standar</span>
      </div>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            CV Standar Altek
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {application.candidate_name} ·{" "}
            {application.position_title ?? "-"} ·{" "}
            {application.client_name ?? "-"}
          </p>
        </div>
        <Link
          href={`/applications/${trimmedId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
      </div>

      {/* ── Stale warning banner ── */}
      {latestCV && isStale && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>
            Data kandidat telah diperbarui sejak CV ini digenerate. CV
            mungkin tidak mencerminkan informasi terbaru —{" "}
            <button
              className="font-medium underline"
              onClick={() => {
                setForceRegenerate(true);
                setTimeout(handleGenerate, 0);
              }}
            >
              generate ulang sekarang
            </button>
            .
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ══ LEFT: Generate panel (2/5) ══ */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-700">
              Generate CV
            </h2>

            {/* Language selector */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Bahasa Summary
              </label>
              <div className="flex gap-2">
                {(["ID", "EN"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      language === lang
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {lang === "ID" ? "Indonesia" : "English"}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary override (opsional) */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Summary <span className="text-slate-400 font-normal">(opsional — dikerjakan AI jika kosong)</span>
              </label>
              <textarea
                value={manualSummary}
                onChange={(e) => setManualSummary(e.target.value)}
                rows={4}
                placeholder="Kosongkan agar summary digenerate otomatis oleh AI…"
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              {manualSummary.trim() && (
                <p className="mt-1 text-xs text-blue-600">
                  Summary ini akan dipakai dan tidak akan ditimpa oleh AI saat regenerate.
                </p>
              )}
            </div>

            {/* Force regenerate checkbox */}
            {latestCV && !isStale && (
              <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={forceRegenerate}
                  onChange={(e) => setForceRegenerate(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                Paksa generate ulang (meskipun sudah fresh)
              </label>
            )}

            {/* Generate button */}
            {canEdit && (
              <button
                onClick={handleGenerate}
                disabled={mutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Sedang generate…
                  </>
                ) : latestCV ? (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    {forceRegenerate ? "Regenerate CV" : "Cek & Generate"}
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Generate CV
                  </>
                )}
              </button>
            )}

            {/* Info jika CV fresh */}
            {latestCV && !isStale && !forceRegenerate && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle className="h-3.5 w-3.5" />
                CV sudah up-to-date. Klik "Cek & Generate" untuk verifikasi
                atau centang "Paksa regenerate" untuk memperbarui.
              </p>
            )}
          </div>

          {/* Latest CV metadata card */}
          {latestCV && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">
                CV Terakhir
              </h3>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Bahasa</span>
                  <span className="font-medium">{latestCV.language ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Summary</span>
                  {summarySourceBadge(latestCV.summary_source)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Digenerate</span>
                  <span>{formatSafeDate(latestCV.generated_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status</span>
                  {isStale ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      <AlertTriangle className="h-3 w-3" /> Outdated
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      <CheckCircle className="h-3 w-3" /> Fresh
                    </span>
                  )}
                </div>
              </div>

              {/* Download / view buttons */}
              {latestCV.file_url && (
                <div className="flex gap-2 pt-1">
                  <a
                    href={latestCV.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Buka
                  </a>
                  <a
                    href={latestCV.file_url}
                    download
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══ RIGHT: CV history list (3/5) ══ */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-700">
                Riwayat CV
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {cvList.length} versi
              </span>
            </div>

            {cvLoading ? (
              <div className="flex h-40 items-center justify-center text-slate-400 text-sm">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Memuat riwayat CV…
              </div>
            ) : cvList.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
                <FileText className="h-8 w-8 opacity-40" />
                <p className="text-sm">Belum ada CV yang digenerate.</p>
                {canEdit && (
                  <p className="text-xs">
                    Klik "Generate CV" untuk membuat CV standar pertama.
                  </p>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {cvList.map((cv, idx) => (
                  <li
                    key={cv.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="flex items-start gap-3">
                      {/* Index badge */}
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                        {idx + 1}
                      </span>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Language badge */}
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {cv.language ?? "ID"}
                          </span>
                          {/* Summary source badge */}
                          {summarySourceBadge(cv.summary_source)}
                          {/* Stale badge */}
                          {cv.is_stale && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              <AlertTriangle className="h-3 w-3" /> Outdated
                            </span>
                          )}
                          {idx === 0 && !cv.is_stale && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              <CheckCircle className="h-3 w-3" /> Terbaru
                            </span>
                          )}
                        </div>
                        <p className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="h-3 w-3" />
                          {formatSafeDate(cv.generated_at)}
                        </p>
                        {cv.summary_text && (
                          <p className="max-w-sm truncate text-xs text-slate-500 italic">
                            "{cv.summary_text}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {cv.file_url && (
                      <div className="flex shrink-0 gap-1.5">
                        <a
                          href={cv.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Buka CV"
                          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <a
                          href={cv.file_url}
                          download
                          title="Download CV"
                          className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-blue-500 hover:bg-blue-100"
                        >
                          <Download className="h-3.5 w-3.5" />
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
