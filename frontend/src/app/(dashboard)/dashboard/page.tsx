"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchAnalyticsSummary, fetchRecentApplications, fetchContractsExpiring } from "@/lib/api/analytics";
import type { AnalyticsSummary, RecentApplication, ContractExpiring } from "@/types";

// ── Stage label helper ────────────────────────────────────────────────────────
const STAGE_LABELS: Record<string, string> = {
  Dijadwalkan_Interview: "Interview Terjadwal",
  Konfirmasi_Kehadiran: "Konfirmasi Kehadiran",
  Interview_HR: "Interview HR",
  Psikotest: "Psikotest",
  Interview_User: "Interview User",
  Offering: "Offering",
  Tanda_Tangan_Kontrak: "Tanda Tangan Kontrak",
  Onboarding: "Onboarding",
  Existing: "Existing",
};

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

function stageBadgeColor(stage: string): string {
  const c: Record<string, string> = {
    Dijadwalkan_Interview: "bg-blue-100 text-blue-800",
    Konfirmasi_Kehadiran: "bg-yellow-100 text-yellow-800",
    Interview_HR: "bg-purple-100 text-purple-800",
    Psikotest: "bg-green-100 text-green-800",
    Interview_User: "bg-indigo-100 text-indigo-800",
    Offering: "bg-orange-100 text-orange-800",
    Tanda_Tangan_Kontrak: "bg-teal-100 text-teal-800",
    Onboarding: "bg-pink-100 text-pink-800",
    Existing: "bg-gray-100 text-gray-800",
  };
  return c[stage] ?? "bg-gray-100 text-gray-800";
}

// ── Metric Card ────────────────────────────────────────────────────────────────
function MetricCard({
  title,
  value,
  icon,
  accent,
}: {
  title: string;
  value: number;
  icon: string;
  accent: string;
}) {
  return (
    <div
      className={`${accent} rounded-xl p-5 border border-outline-variant shadow-[0px_4px_12px_rgba(9,30,66,0.08)]`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
            {title}
          </p>
          <p className="text-display text-on-surface font-bold">{value}</p>
        </div>
        <span
          className={`material-symbols-outlined text-[28px] ${
            accent.includes("primary") ? "text-primary" : "text-secondary"
          }`}
          data-weight="fill"
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: fetchAnalyticsSummary,
  });

  const { data: recentApps = [], isLoading: loadingApps } = useQuery({
    queryKey: ["recent-applications"],
    queryFn: () => fetchRecentApplications(5),
  });

  const { data: expiring = [], isLoading: loadingContracts } = useQuery({
    queryKey: ["contracts-expiring"],
    queryFn: () => fetchContractsExpiring(5),
  });

  // Total candidates in pipeline (active applications)
  const totalPipeline =
    summary?.pipeline_breakdown?.reduce((s, b) => s + b.count, 0) ?? 0;

  return (
    <div className="p-container-padding">
      <div className="max-w-[1400px] mx-auto space-y-stack-md">
        {/* ── Metric Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
          <MetricCard
            title="Kandidat Aktif"
            value={loadingSummary ? 0 : (summary?.total_active_candidates ?? 0)}
            icon="person"
            accent="bg-primary/5 border-primary/10"
          />
          <MetricCard
            title="Karyawan Aktif"
            value={loadingSummary ? 0 : (summary?.total_active_employees ?? 0)}
            icon="work"
            accent="bg-primary/5 border-primary/10"
          />
          <MetricCard
            title="Kandidat di Pipeline"
            value={loadingSummary ? 0 : totalPipeline}
            icon="trending_up"
            accent="bg-secondary/5 border-secondary/10"
          />
          <MetricCard
            title="Kontrak Hampir Habis"
            value={loadingSummary ? 0 : (summary?.contracts_expiring_30d ?? 0)}
            icon="warning"
            accent="bg-error/5 border-error/10"
          />
        </div>

        {/* ── Layout: left = pipeline breakdown, right = two tables ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-gutter">
          {/* Pipeline Breakdown */}
          <div className="xl:col-span-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0px_4px_12px_rgba(9,30,66,0.08)] overflow-hidden flex flex-col">
            <div className="p-stack-md border-b border-outline-variant bg-surface-bright">
              <h3 className="text-headline-sm text-on-surface font-semibold">
                Pipeline Kandidat
              </h3>
            </div>
            <div className="p-4 space-y-3 flex-1">
              {loadingSummary ? (
                <p className="text-body-sm text-on-surface-variant">Memuat...</p>
              ) : summary?.pipeline_breakdown?.length ? (
                summary.pipeline_breakdown.map((b) => (
                  <div key={b.stage} className="flex items-center justify-between">
                    <span className="text-body-sm text-on-surface-variant">
                      {stageLabel(b.stage)}
                    </span>
                    <span className="text-body-sm font-semibold text-on-surface">
                      {b.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-body-sm text-on-surface-variant">Belum ada data</p>
              )}
            </div>
          </div>

          {/* Right column: two tables */}
          <div className="xl:col-span-2 space-y-gutter flex flex-col">
            {/* Lamaran Terbaru */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0px_4px_12px_rgba(9,30,66,0.08)] overflow-hidden flex flex-col">
              <div className="p-stack-md border-b border-outline-variant flex justify-between items-center bg-surface-bright">
                <h3 className="text-headline-sm text-on-surface font-semibold">
                  Lamaran Terbaru
                </h3>
                <Link
                  href="/applications"
                  className="text-body-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Lihat Semua →
                </Link>
              </div>
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-label-md text-on-surface-variant border-b border-outline-variant">
                      <th className="py-3 px-4 font-medium uppercase tracking-wider">
                        Kandidat
                      </th>
                      <th className="py-3 px-4 font-medium uppercase tracking-wider">
                        Posisi
                      </th>
                      <th className="py-3 px-4 font-medium uppercase tracking-wider">
                        Tahapan
                      </th>
                      <th className="py-3 px-4 font-medium uppercase tracking-wider">
                        Tanggal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-body-sm divide-y divide-outline-variant">
                    {loadingApps ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-on-surface-variant">
                          Memuat...
                        </td>
                      </tr>
                    ) : recentApps.length ? (
                      recentApps.map((app) => (
                        <tr key={app.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="py-3 px-4 font-medium text-on-surface">
                            {app.candidate_name ?? "-"}
                          </td>
                          <td className="py-3 px-4 text-on-surface-variant">
                            {app.position_title ?? "-"}
                            {app.client_name && (
                              <span className="ml-1 text-on-surface-variant/60 text-xs">
                                ({app.client_name})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${stageBadgeColor(app.current_stage)}`}
                            >
                              {stageLabel(app.current_stage)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-on-surface-variant">
                            {app.created_at
                              ? new Date(app.created_at).toLocaleDateString("id-ID", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "-"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-on-surface-variant">
                          Belum ada lamaran terbaru
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Kontrak Hampir Habis */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0px_4px_12px_rgba(9,30,66,0.08)] overflow-hidden flex flex-col">
              <div className="p-stack-md border-b border-outline-variant flex justify-between items-center bg-surface-bright">
                <h3 className="text-headline-sm text-on-surface font-semibold">
                  Kontrak Hampir Habis
                </h3>
                <Link
                  href="/employees?contract_expiry_within_days=30"
                  className="text-body-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Lihat Semua →
                </Link>
              </div>
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-label-md text-on-surface-variant border-b border-outline-variant">
                      <th className="py-3 px-4 font-medium uppercase tracking-wider">
                        Nama Karyawan
                      </th>
                      <th className="py-3 px-4 font-medium uppercase tracking-wider">
                        Penempatan
                      </th>
                      <th className="py-3 px-4 font-medium uppercase tracking-wider">
                        Tanggal Habis
                      </th>
                      <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">
                        Sisa Hari
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-body-sm divide-y divide-outline-variant">
                    {loadingContracts ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-on-surface-variant">
                          Memuat...
                        </td>
                      </tr>
                    ) : expiring.length ? (
                      expiring.map((c) => (
                        <tr key={c.contract_id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="py-3 px-4 font-medium text-on-surface">
                            {c.employee_name ?? "-"}
                          </td>
                          <td className="py-3 px-4 text-on-surface-variant">
                            {c.placement ?? "-"}
                          </td>
                          <td className="py-3 px-4 text-on-surface-variant">
                            {c.end_date
                              ? new Date(c.end_date).toLocaleDateString("id-ID", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "-"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-flex items-center justify-end px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                (c.days_remaining ?? 0) <= 7
                                  ? "bg-error/10 text-error"
                                  : (c.days_remaining ?? 0) <= 14
                                  ? "bg-warning/10 text-yellow-800"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {c.days_remaining != null ? `${c.days_remaining} hari` : "-"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-on-surface-variant">
                          Tidak ada kontrak yang akan habis dalam 30 hari
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
