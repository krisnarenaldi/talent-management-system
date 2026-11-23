"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import type { Candidate, CandidateDocument, CVGenerateRequest, CVGenerateResponse, GeneratedCV } from "@/types";

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchCandidate(id: string): Promise<Candidate> {
  const res = await api.get(`/api/v1/candidates/${id}`);
  return res.data;
}

async function fetchCandidateDocuments(candidateId: string): Promise<CandidateDocument[]> {
  const res = await api.get(`/api/v1/candidates/${candidateId}/documents/`);
  return res.data;
}

async function fetchCVList(candidateId: string): Promise<GeneratedCV[]> {
  const res = await api.get(`/api/v1/candidates/${candidateId}/cv/`);
  return res.data;
}

async function generateCV(
  candidateId: string,
  payload: CVGenerateRequest
): Promise<CVGenerateResponse> {
  const res = await api.post(`/api/v1/candidates/${candidateId}/cv/generate`, payload);
  return res.data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOriginalFileName(doc: CandidateDocument): string {
  if (doc.label && doc.label.trim()) return doc.label.trim();
  if (doc.file_url) {
    const raw = doc.file_url.split("/").pop() || "CV_asli.pdf";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return "CV Asli";
}

function formatSafeDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return format(d, "d MMM yyyy, HH:mm", { locale: idLocale });
}

function SummarySourceBadge({ source }: { source: string | null | undefined }) {
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

export default function CandidateCVPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const trimmedId = id.trim();
  const searchParams = useSearchParams();
  const fromSource = searchParams?.get("from");
  const isFromTalentPool = fromSource === "talent-pool";

  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const showToast = useToastStore((s) => s.showToast);

  const [language, setLanguage] = useState<"ID" | "EN">("ID");
  const [manualSummary, setManualSummary] = useState("");
  const [forceRegenerate, setForceRegenerate] = useState(false);

  // ── Upload CV Template modal state ──
  const [showUploadCVModal, setShowUploadCVModal] = useState(false);
  const [uploadCVFile, setUploadCVFile] = useState<File | null>(null);
  const [isUploadingCV, setIsUploadingCV] = useState(false);
  const uploadCVInputRef = useRef<HTMLInputElement>(null);

  const closeUploadCVModal = () => {
    setShowUploadCVModal(false);
    setUploadCVFile(null);
    if (uploadCVInputRef.current) uploadCVInputRef.current.value = "";
  };

  const handleUploadCVTemplate = async () => {
    if (!uploadCVFile) return;
    setIsUploadingCV(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadCVFile);
      const res = await api.post(
        `/api/v1/candidates/${trimmedId}/upload-latest-data`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      showToast("success", res.data?.message || "Data kandidat berhasil diperbarui dari PDF.");
      closeUploadCVModal();
      queryClient.invalidateQueries({ queryKey: ["candidate", trimmedId] });
      queryClient.invalidateQueries({ queryKey: ["candidate-cv-list", trimmedId] });
    } catch (err) {
      showToast("error", getErrorMessage(err));
    } finally {
      setIsUploadingCV(false);
    }
  };

  const { data: candidate, isLoading: candidateLoading } = useQuery({
    queryKey: ["candidate", trimmedId],
    queryFn: () => fetchCandidate(trimmedId),
  });

  const {
    data: cvList = [],
    isLoading: cvLoading,
  } = useQuery({
    queryKey: ["candidate-cv-list", trimmedId],
    queryFn: () => fetchCVList(trimmedId),
  });

  const {
    data: documents = [],
    isLoading: documentsLoading,
  } = useQuery({
    queryKey: ["candidate-documents", trimmedId],
    queryFn: () => fetchCandidateDocuments(trimmedId),
  });

  const originalCV =
    documents
      .filter((doc) => doc.doc_type === "CV_asli")
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())[0] ?? null;

  const canEdit =
    currentUser?.role === "hr" ||
    currentUser?.role === "manager" ||
    currentUser?.role === "admin";

  const mutation = useMutation({
    mutationFn: (payload: CVGenerateRequest) => generateCV(trimmedId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["candidate-cv-list", trimmedId] });
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

  const verifyMutation = useMutation({
    mutationFn: async (docId: string) => {
      await api.patch(`/api/v1/candidates/${trimmedId}/documents/${docId}/verify`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-documents", trimmedId] });
      showToast("success", "Status verifikasi dokumen berhasil diperbarui.");
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

  if (candidateLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
        Memuat data kandidat...
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
        <p>Kandidat tidak ditemukan.</p>
        <Link href="/candidates" className="text-sm text-blue-600 underline">
          Kembali ke daftar kandidat
        </Link>
      </div>
    );
  }

  return (
    <>
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          href={isFromTalentPool ? "/talent-pool" : "/candidates"}
          className="hover:text-slate-700 hover:underline"
        >
          {isFromTalentPool ? "Talent Pool" : "Kandidat"}
        </Link>
        <span>/</span>
        <Link
          href={
            isFromTalentPool
              ? `/candidates/${trimmedId}?from=talent-pool`
              : `/candidates/${trimmedId}`
          }
          className="inline-flex items-center gap-1 hover:text-slate-700 hover:underline"
        >
          {candidate.full_name}
          {candidate.is_cv_altek_updated && (
            <span
              title="Data telah diperbarui via CV Altek"
              className="inline-flex items-center text-[#1D9BF0] flex-shrink-0 cursor-help"
            >
              <svg
                className="h-3.5 w-3.5 fill-current"
                viewBox="0 0 24 24"
                aria-label="Verified via CV Altek"
              >
                <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.97-.81-3.98s-2.59-1.27-3.98-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.98-.2-3.99.81s-1.27 2.59-.81 3.98C2.49 9.33 1.61 10.57 1.61 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.97.81 3.98s2.59 1.27 3.98.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.97.2 3.98-.81s1.27-2.59.81-3.98c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.3 11.96l1.41-1.41 2.83 2.83 6.36-6.36 1.41 1.41-7.77 7.77z" />
              </svg>
            </span>
          )}
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-800">CV Standar</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={
              isFromTalentPool
                ? `/candidates/${trimmedId}?from=talent-pool`
                : `/candidates/${trimmedId}`
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">CV Standar Altek</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {candidate.full_name}
              {candidate.domicile ? ` · ${candidate.domicile}` : ""}
              {candidate.skills && candidate.skills.length > 0
                ? ` · ${candidate.skills.slice(0, 3).join(", ")}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowUploadCVModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a3a7c] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#15306a] transition-colors"
            >
              <FileText className="h-4 w-4" />
              Upload CV Template
            </button>
          )}
          {originalCV?.file_url && (
            <>
              <a
                href={originalCV.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                title="Buka CV Asli di tab baru"
              >
                <ExternalLink className="h-4 w-4 text-slate-500" />
                Buka CV Asli
              </a>
              <a
                href={originalCV.file_url}
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                title="Download file CV Asli"
              >
                <Download className="h-4 w-4 text-slate-500" />
                Download CV Asli
              </a>
            </>
          )}
        </div>
      </div>

      {/* Stale warning */}
      {latestCV && isStale && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
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

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Original CV card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-slate-500" />
                CV Asli Kandidat
              </h3>
              {originalCV ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  Original
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Belum ada
                </span>
              )}
            </div>

            {documentsLoading ? (
              <div className="flex items-center justify-center py-4 text-xs text-slate-400">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Memuat CV asli…
              </div>
            ) : originalCV ? (
              <>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start justify-between gap-2">
                    <span className="shrink-0 text-slate-400">File</span>
                    <span
                      className="max-w-[180px] truncate font-medium text-right text-slate-700"
                      title={getOriginalFileName(originalCV)}
                    >
                      {getOriginalFileName(originalCV)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Diupload</span>
                    <span>{formatSafeDate(originalCV.uploaded_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status</span>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => verifyMutation.mutate(originalCV.id)}
                        disabled={verifyMutation.isPending}
                        title={
                          originalCV.is_verified
                            ? "Klik untuk membatalkan verifikasi"
                            : "Klik untuk memverifikasi dokumen ini"
                        }
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer transition-all hover:opacity-85 disabled:cursor-not-allowed ${
                          originalCV.is_verified
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {verifyMutation.isPending ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin" /> Mengubah…
                          </>
                        ) : originalCV.is_verified ? (
                          <>
                            <CheckCircle className="h-3 w-3" /> Terverifikasi
                          </>
                        ) : (
                          "Belum diverifikasi"
                        )}
                      </button>
                    ) : originalCV.is_verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle className="h-3 w-3" /> Terverifikasi
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Belum diverifikasi
                      </span>
                    )}
                  </div>
                </div>

                {originalCV.file_url && (
                  <div className="flex gap-2 pt-1">
                    <a
                      href={originalCV.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Buka
                    </a>
                    <a
                      href={originalCV.file_url}
                      download
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2 py-2 text-xs text-slate-500">
                <p>Belum ada file CV asli yang diunggah untuk kandidat ini.</p>
                <Link
                  href={`/candidates/${trimmedId}`}
                  className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                >
                  Upload di halaman kandidat &rarr;
                </Link>
              </div>
            )}
          </div>

          {/* CV Template card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-slate-500" />
                CV Template
              </h3>
              {candidate.is_cv_altek_updated ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Terupload
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Belum ada
                </span>
              )}
            </div>

            {candidate.is_cv_altek_updated ? (
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Diupload</span>
                  <span>{formatSafeDate(candidate.cv_altek_updated_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <CheckCircle className="h-3 w-3" /> Terverifikasi
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 py-2 text-xs text-slate-500">
                <p>Belum ada CV template yang diupload untuk kandidat ini.</p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setShowUploadCVModal(true)}
                    className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                  >
                    Upload CV Template &rarr;
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Generate CV panel */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-700">Generate CV</h2>

            {/* Language */}
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

            {latestCV && !isStale && (
              <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={forceRegenerate}
                  onChange={(e) => setForceRegenerate(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                Paksa generate ulang
              </label>
            )}

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

            {latestCV && !isStale && !forceRegenerate && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle className="h-3.5 w-3.5" />
                CV sudah up-to-date.
              </p>
            )}
          </div>

          {/* Latest CV card */}
          {latestCV && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">CV Terakhir</h3>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Bahasa</span>
                  <span className="font-medium">{latestCV.language ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Summary</span>
                  <SummarySourceBadge source={latestCV.summary_source} />
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
              {latestCV.file_url && (
                <div className="flex gap-2 pt-1">
                  <a
                    href={latestCV.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Buka
                  </a>
                  <a
                    href={latestCV.file_url}
                    download
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CV history */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-700">Riwayat CV Template</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {cvList.length} versi
              </span>
            </div>

            {cvLoading ? (
              <div className="flex h-40 items-center justify-center text-slate-400 text-sm">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Memuat…
              </div>
            ) : cvList.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
                <FileText className="h-8 w-8 opacity-40" />
                <p className="text-sm">Belum ada CV yang digenerate.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {cvList.map((cv, idx) => (
                  <li key={cv.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0 flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {cv.language ?? "ID"}
                          </span>
                          <SummarySourceBadge source={cv.summary_source} />
                          {idx === 0 && cv.is_stale && (
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
                          <p className="max-w-sm truncate text-xs italic text-slate-500">
                            "{cv.summary_text}"
                          </p>
                        )}
                      </div>
                    </div>
                    {cv.file_url && (
                      <div className="flex shrink-0 gap-1.5">
                        <a
                          href={cv.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Buka CV"
                          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
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

    {/* ── Modal Upload CV Template ── */}
    {showUploadCVModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Upload CV Template</h2>
                <p className="mt-0.5 text-sm text-gray-500">Upload PDF formulir data kandidat hasil interview</p>
              </div>
              <button
                type="button"
                onClick={closeUploadCVModal}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <span className="text-xl leading-none">&times;</span>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                <p className="font-medium mb-1">Cara kerja:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-xs text-blue-700">
                  <li>Sistem akan membaca teks dari PDF secara otomatis</li>
                  <li>AI akan mengekstrak data pengalaman kerja &amp; tools per perusahaan</li>
                  <li>Data kandidat akan diperbarui langsung</li>
                </ul>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Pilih file PDF
                </label>
                <input
                  ref={uploadCVInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setUploadCVFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                />
                {uploadCVFile && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-600">
                    <FileText className="h-3.5 w-3.5 text-green-600" />
                    {uploadCVFile.name} ({(uploadCVFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={closeUploadCVModal}
                disabled={isUploadingCV}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleUploadCVTemplate}
                disabled={!uploadCVFile || isUploadingCV}
                className="flex items-center gap-2 rounded-lg bg-[#1a3a7c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15306a] disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isUploadingCV ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Proses &amp; Update Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
    )}
    </>
  );
}
