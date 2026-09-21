"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import type { GeneratedCV } from "@/types";

// ── Extended type for admin view (includes candidate name via join) ──────────
interface GeneratedCVAdmin extends GeneratedCV {
  candidate_name?: string | null;
  position_title?: string | null;
  client_name?: string | null;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchAllGeneratedCVs(params: {
  language?: string;
  summary_source?: string;
  is_stale?: boolean | null;
  skip?: number;
  limit?: number;
}): Promise<GeneratedCVAdmin[]> {
  const query: Record<string, string | number | boolean> = {
    skip: params.skip ?? 0,
    limit: params.limit ?? 50,
  };
  if (params.language) query.language = params.language;
  if (params.summary_source) query.summary_source = params.summary_source;

  const res = await api.get("/api/v1/admin/generated-cvs", { params: query });
  return res.data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSafeDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return format(d, "d MMM yyyy, HH:mm", { locale: idLocale });
}

function SummaryBadge({ source }: { source: string | null | undefined }) {
  if (source === "HR")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        <User className="h-3 w-3" /> HR
      </span>
    );
  if (source === "AI")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
        <Sparkles className="h-3 w-3" /> AI
      </span>
    );
  return <span className="text-xs text-slate-400">-</span>;
}

function StaleBadge({ isStale }: { isStale: boolean }) {
  if (isStale)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        <AlertTriangle className="h-3 w-3" /> Outdated
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <CheckCircle className="h-3 w-3" /> Fresh
    </span>
  );
}

// ── Page component ─────────────────────────────────────────────────────────────

export default function CVTemplatesAdminPage() {
  const router = useRouter();
  const { user, isRole } = useAuthStore();

  // Redirect non-admin
  useEffect(() => {
    if (user && !isRole("admin")) {
      router.replace("/dashboard");
    }
  }, [user, isRole, router]);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [langFilter, setLangFilter] = useState<"" | "ID" | "EN">("");
  const [sourceFilter, setSourceFilter] = useState<"" | "AI" | "HR">("");
  const [search, setSearch] = useState("");

  const authorized = !!user && isRole("admin");

  const {
    data: cvs = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-generated-cvs", langFilter, sourceFilter],
    queryFn: () =>
      fetchAllGeneratedCVs({
        language: langFilter || undefined,
        summary_source: sourceFilter || undefined,
        limit: 100,
      }),
    enabled: authorized,
  });

  // Client-side search filter on candidate name
  const filtered = search.trim()
    ? cvs.filter((cv) =>
        (cv.candidate_name ?? "")
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      )
    : cvs;

  // ── Stats ──────────────────────────────────────────────────────────────
  const totalStale = cvs.filter((cv) => cv.is_stale).length;
  const totalAI = cvs.filter((cv) => cv.summary_source === "AI").length;
  const totalHR = cvs.filter((cv) => cv.summary_source === "HR").length;

  if (!authorized) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400 text-sm">
        Memeriksa akses…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            CV Templates — Overview
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Pantau semua CV standar Altek yang telah digenerate di seluruh
            kandidat.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Info box: template config ── */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
          <FileText className="h-4 w-4" />
          Konfigurasi Template Saat Ini
        </h2>
        <div className="grid gap-3 text-xs text-blue-800 sm:grid-cols-3">
          <div>
            <p className="font-medium text-blue-500 uppercase tracking-wide mb-0.5">
              Template aktif
            </p>
            <p className="font-mono bg-white/60 rounded px-2 py-1">
              altek_standard
            </p>
          </div>
          <div>
            <p className="font-medium text-blue-500 uppercase tracking-wide mb-0.5">
              File HTML
            </p>
            <p className="font-mono bg-white/60 rounded px-2 py-1 truncate">
              app/templates/cv/altek_standard.html
            </p>
          </div>
          <div>
            <p className="font-medium text-blue-500 uppercase tracking-wide mb-0.5">
              PDF Engine
            </p>
            <p className="font-mono bg-white/60 rounded px-2 py-1">
              WeasyPrint
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-blue-600">
          Untuk mengubah desain template, edit file{" "}
          <code className="rounded bg-white/60 px-1">
            backend/app/templates/cv/altek_standard.html
          </code>{" "}
          dan pastikan logo tersedia di{" "}
          <code className="rounded bg-white/60 px-1">
            backend/app/assets/altek_logo.png
          </code>
          . Setelah edit template, CV lama tidak otomatis berubah — HR perlu
          klik "Regenerate" di halaman CV lamaran.
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          {
            label: "Total CV",
            value: cvs.length,
            color: "text-slate-700",
            bg: "bg-slate-50",
            border: "border-slate-200",
          },
          {
            label: "Outdated",
            value: totalStale,
            color: "text-amber-700",
            bg: "bg-amber-50",
            border: "border-amber-200",
          },
          {
            label: "Summary AI",
            value: totalAI,
            color: "text-violet-700",
            bg: "bg-violet-50",
            border: "border-violet-200",
          },
          {
            label: "Summary HR",
            value: totalHR,
            color: "text-blue-700",
            bg: "bg-blue-50",
            border: "border-blue-200",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border ${stat.border} ${stat.bg} p-4`}
          >
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className={`mt-1 text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama kandidat…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Language filter */}
        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value as "" | "ID" | "EN")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
        >
          <option value="">Semua Bahasa</option>
          <option value="ID">Indonesia</option>
          <option value="EN">English</option>
        </select>

        {/* Summary source filter */}
        <select
          value={sourceFilter}
          onChange={(e) =>
            setSourceFilter(e.target.value as "" | "AI" | "HR")
          }
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
        >
          <option value="">Semua Sumber</option>
          <option value="AI">AI Generated</option>
          <option value="HR">Manual HR</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-slate-400 text-sm">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Memuat data CV…
          </div>
        ) : isError ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-red-500 text-sm">
            <AlertTriangle className="h-6 w-6" />
            <p>Gagal memuat data. Pastikan endpoint admin sudah tersedia.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
            <FileText className="h-8 w-8 opacity-40" />
            <p className="text-sm">Belum ada CV yang digenerate.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Kandidat</th>
                  <th className="px-4 py-3 text-left font-medium">Posisi / Client</th>
                  <th className="px-4 py-3 text-center font-medium">Bahasa</th>
                  <th className="px-4 py-3 text-center font-medium">Summary</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">
                    <Clock className="inline h-3.5 w-3.5 mr-1" />
                    Digenerate
                  </th>
                  <th className="px-4 py-3 text-center font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((cv) => (
                  <tr
                    key={cv.id}
                    className={`transition-colors hover:bg-slate-50 ${
                      cv.is_stale ? "bg-amber-50/30" : ""
                    }`}
                  >
                    {/* Candidate */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {cv.candidate_name ?? (
                          <span className="text-slate-400 italic text-xs">
                            ID: {cv.candidate_id.slice(0, 8)}…
                          </span>
                        )}
                      </div>
                      {cv.application_id && (
                        <Link
                          href={`/applications/${cv.application_id}/cv`}
                          className="text-xs text-blue-500 hover:underline"
                        >
                          Lihat halaman CV →
                        </Link>
                      )}
                    </td>

                    {/* Position / Client */}
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div>{cv.position_title ?? "-"}</div>
                      <div className="text-slate-400">{cv.client_name ?? "-"}</div>
                    </td>

                    {/* Language */}
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {cv.language ?? "-"}
                      </span>
                    </td>

                    {/* Summary source */}
                    <td className="px-4 py-3 text-center">
                      <SummaryBadge source={cv.summary_source} />
                    </td>

                    {/* Stale status */}
                    <td className="px-4 py-3 text-center">
                      <StaleBadge isStale={cv.is_stale} />
                    </td>

                    {/* Generated at */}
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatSafeDate(cv.generated_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {cv.file_url && (
                          <>
                            <a
                              href={cv.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Buka PDF"
                              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <a
                              href={cv.file_url}
                              download
                              title="Download PDF"
                              className="rounded-lg border border-blue-100 bg-blue-50 p-1.5 text-blue-500 hover:bg-blue-100"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </>
                        )}
                        {cv.application_id && (
                          <Link
                            href={`/applications/${cv.application_id}/cv`}
                            title="Kelola CV"
                            className="rounded-lg border border-violet-100 bg-violet-50 p-1.5 text-violet-500 hover:bg-violet-100"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        {!isLoading && !isError && filtered.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
            Menampilkan {filtered.length} dari {cvs.length} record
            {totalStale > 0 && (
              <span className="ml-2 text-amber-600">
                · {totalStale} CV outdated (data kandidat telah diperbarui)
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Note about admin endpoint ── */}
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Catatan teknis:</span>{" "}
        Halaman ini membutuhkan endpoint{" "}
        <code className="rounded bg-white px-1 py-0.5">
          GET /api/v1/admin/generated-cvs
        </code>{" "}
        yang belum diimplementasi. Data akan muncul setelah endpoint tersebut
        ditambahkan ke <code className="rounded bg-white px-1 py-0.5">routers/admin.py</code>.
        Untuk sementara, gunakan halaman{" "}
        <Link href="/applications" className="text-blue-500 underline">
          Lamaran
        </Link>{" "}
        → detail lamaran → tombol "CV Standar" untuk mengelola CV per kandidat.
      </div>
    </div>
  );
}
