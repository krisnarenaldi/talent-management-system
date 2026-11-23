"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";
import type { Application, Position, Client } from "@/types";
import { useExport } from "@/hooks/useExport";
import ExportButton from "@/components/ExportButton";
import { fetchActivePositions } from "@/lib/api/analytics";
import type { ActivePositionSummary } from "@/types";
import Pagination from "@/components/ui/Pagination";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

interface ApplicationsResult {
  items: Application[];
  total: number;
}

async function fetchApplications(params?: Record<string, string | undefined>): Promise<ApplicationsResult> {
  const response = await api.get("/api/v1/applications", { params });
  const total = parseInt(response.headers["x-total-count"] ?? "0", 10);
  return { items: response.data as Application[], total };
}

async function fetchAllPositions(): Promise<Position[]> {
  const response = await api.get("/api/v1/positions", { params: { limit: 200 } });
  const data = response.data;
  return Array.isArray(data) ? data : (data?.data ?? []);
}

async function fetchAllClients(): Promise<Client[]> {
  const response = await api.get("/api/v1/clients", { params: { is_active: true } });
  const data = response.data;
  return Array.isArray(data) ? data : (data?.data ?? []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions (shared by both views)
// ─────────────────────────────────────────────────────────────────────────────

const stageOptions = [
  "Dijadwalkan_Interview",
  "Konfirmasi_Kehadiran",
  "Interview_HR",
  "Psikotest",
  "Interview_User",
  "Offering",
  "Tanda_Tangan_Kontrak",
  "Onboarding",
  "Existing",
  "Rejected",
  "Withdrawn",
];

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "border border-emerald-200 bg-emerald-100 text-emerald-800";
    case "rejected":
      return "border border-red-200 bg-red-100 text-red-800";
    case "hired":
      return "border border-blue-200 bg-blue-100 text-blue-800";
    case "withdrawn":
      return "border border-slate-300 bg-slate-200 text-slate-800";
    default:
      return "border border-slate-200 bg-slate-100 text-slate-800";
  }
}

function stageBadgeClass(stage: string | null | undefined) {
  const normalizedStage = stage ?? "";
  if (normalizedStage.includes("Interview")) return "border border-violet-200 bg-violet-100 text-violet-800";
  if (normalizedStage.includes("Offering") || normalizedStage.includes("Kontrak") || normalizedStage.includes("Onboarding") || normalizedStage === "Existing") {
    return "border border-blue-200 bg-blue-100 text-blue-800";
  }
  if (normalizedStage.includes("Rejected") || normalizedStage.includes("Withdrawn")) return "border border-red-200 bg-red-100 text-red-800";
  return "border border-amber-200 bg-amber-100 text-amber-800";
}

const FAIL_RESULTS = new Set(["fail", "tidak_lolos"]);

function resultBadgeClass(result: string) {
  if (FAIL_RESULTS.has(result)) return "border border-red-200 bg-red-100 text-red-700";
  return "border border-emerald-200 bg-emerald-100 text-emerald-700";
}

function formatResultLabel(result: string) {
  const map: Record<string, string> = {
    pass: "Pass",
    fail: "Fail",
    lolos: "Lolos",
    tidak_lolos: "Tidak Lolos",
    ok: "OK",
    reschedule: "Reschedule",
    lolos_kontrak: "Lolos Kontrak",
    negosiasi: "Negosiasi",
    signed: "Signed",
    pending: "Pending",
  };
  return map[result] ?? result;
}

function formatStageLabel(stage: string | null | undefined) {
  const normalizedStage = stage ?? "";
  return normalizedStage
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "-";
}

function aiScoreBadgeClass(score: number | null | undefined) {
  if (score === null || score === undefined) return "border border-slate-200 bg-slate-100 text-slate-600";
  if (score >= 80) return "border border-emerald-200 bg-emerald-100 text-emerald-800";
  if (score >= 60) return "border border-amber-200 bg-amber-100 text-amber-800";
  return "border border-red-200 bg-red-100 text-red-800";
}

function aiStatusIcon(status: string | null | undefined) {
  if (!status) return "⏳";
  if (status === "sudah_direview") return "✅";
  if (status === "siap_review") return "🔍";
  return "⏳";
}

function normalizeRole(role: string | undefined): string {
  if (!role) return "";
  return role.split(".").pop()?.toLowerCase() || role;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY VIEW — landing page when no position_id is selected
// ─────────────────────────────────────────────────────────────────────────────

function ApplicationsSummary() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const canCreateApplication = user ? ["admin", "hr", "manager"].includes(normalizeRole(user.role)) : false;

  // Fetch all positions (for created_at + is_active)
  const { data: allPositions = [], isLoading: loadingPositions } = useQuery<Position[]>({
    queryKey: ["all-positions-summary"],
    queryFn: fetchAllPositions,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch active-positions analytics (for total_applications counts)
  const { data: activePositionStats = [], isLoading: loadingStats } = useQuery<ActivePositionSummary[]>({
    queryKey: ["analytics-active-positions", 200],
    queryFn: () => fetchActivePositions(200),
    staleTime: 2 * 60 * 1000,
  });

  const isLoading = loadingPositions || loadingStats;

  // Merge: positions list + applicant counts
  const statsMap = new Map<string, number>(
    activePositionStats.map((s) => [s.position_id, s.total_applications])
  );

  // Sort: active first, then by created_at desc
  const sortedPositions = [...allPositions].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const [search, setSearch] = useState("");
  const filtered = sortedPositions.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.client_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">Rekrutmen</p>
          <h1 className="text-2xl font-bold text-gray-900">Lamaran per Posisi</h1>
        </div>
        <div className="flex items-center gap-3">
          {canCreateApplication && (
            <Link
              href="/applications/new"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
            >
              + Tambah Lamaran
            </Link>
          )}
          <Link
            href="/applications?view=all"
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50"
          >
            <span className="material-symbols-outlined text-[16px] mr-1.5">table_rows</span>
            Semua Lamaran
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <span className="material-symbols-outlined text-gray-400 text-[20px]">search</span>
        <input
          type="text"
          placeholder="Cari posisi atau client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600 transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3.5">Posisi &amp; Client</th>
                <th className="px-5 py-3.5 text-center">Pelamar</th>
                <th className="px-5 py-3.5">Tgl Dibuat</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-blue-500 text-[28px]">progress_activity</span>
                      <span>Memuat data lowongan...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                    {search ? `Tidak ada posisi yang cocok dengan "${search}"` : "Belum ada lowongan."}
                  </td>
                </tr>
              ) : (
                filtered.map((position) => {
                  const applicantCount = statsMap.get(position.id) ?? 0;
                  return (
                    <tr
                      key={position.id}
                      className="border-t border-gray-100 hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/applications?position_id=${position.id}`)}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                          {position.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{position.client_name}</p>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          {applicantCount} Pelamar
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 text-xs">
                        {format(new Date(position.created_at), "dd MMM yyyy", { locale: idLocale })}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {position.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block"></span>
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400 inline-block"></span>
                            Non-aktif
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/applications?position_id=${position.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700"
                        >
                          Lihat Pelamar
                          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
            Menampilkan {filtered.length} posisi
            {search ? ` dari pencarian "${search}"` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE VIEW — full applications table (with filters), shown when
// position_id or view=all param is present
// ─────────────────────────────────────────────────────────────────────────────

function ApplicationsPipeline() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStage = searchParams.get("stage") || searchParams.get("current_stage") || "";
  const initialStatus = searchParams.get("status") || searchParams.get("status_filter") || "";
  const initialPositionId = searchParams.get("position_id") || "";

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
    initialStatus ? initialStatus.split(",").map((s) => s.trim()).filter(Boolean) : []
  );
  const [selectedStages, setSelectedStages] = useState<string[]>(
    initialStage ? initialStage.split(",").map((s) => s.trim()).filter(Boolean) : []
  );
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [positionIdFilter, setPositionIdFilter] = useState(initialPositionId);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<string | null>(initialPositionId ? "candidate" : null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Selection state for batch CV download
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [isDownloadingCVZip, setIsDownloadingCVZip] = useState(false);

  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const canCreateApplication = user ? ["admin", "hr", "manager"].includes(normalizeRole(user.role)) : false;
  const canExport = user ? ["admin", "manager"].includes(normalizeRole(user.role)) : false;
  const canDelete = user ? ["admin", "hr", "manager"].includes(normalizeRole(user.role)) : false;

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/applications/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      await queryClient.invalidateQueries({ queryKey: ["applications"] });
    } catch (error) {
      console.error("Gagal menghapus lamaran:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        setSortBy(null);
        setSortOrder("asc");
      }
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  useEffect(() => {
    const s = searchParams.get("stage") || searchParams.get("current_stage");
    if (s !== null) {
      setSelectedStages(s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);
    }
    const st = searchParams.get("status") || searchParams.get("status_filter");
    if (st !== null) {
      setSelectedStatuses(st ? st.split(",").map((x) => x.trim()).filter(Boolean) : []);
    }
    const pid = searchParams.get("position_id");
    if (pid !== null) setPositionIdFilter(pid);
    setCurrentPage(1);
  }, [searchParams]);

  const { exportPipeline } = useExport();

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  // Fetch list of positions and clients for multi-select dropdown filters
  const { data: allPositionsData = [] } = useQuery<Position[]>({
    queryKey: ["all-positions-filter"],
    queryFn: fetchAllPositions,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allClientsData = [] } = useQuery<Client[]>({
    queryKey: ["all-clients-filter"],
    queryFn: fetchAllClients,
    staleTime: 5 * 60 * 1000,
  });

  const positionOptions = Array.from(
    new Set(allPositionsData.map((p) => p.title).filter(Boolean))
  ).sort();

  const clientOptions = Array.from(
    new Set(allClientsData.map((c) => c.name).filter(Boolean))
  ).sort();

  const statusOptions = [
    { value: "active", label: "Aktif" },
    { value: "rejected", label: "Ditolak" },
    { value: "hired", label: "Diterima" },
    { value: "withdrawn", label: "Ditarik" },
  ];

  const stageDropdownOptions = stageOptions.map((st) => ({
    value: st,
    label: formatStageLabel(st),
  }));

  const { data, isLoading } = useQuery({
    queryKey: [
      "applications",
      {
        searchTerm,
        selectedStatuses,
        selectedStages,
        selectedPositions,
        selectedClients,
        positionIdFilter,
        startDate,
        endDate,
        sortBy,
        sortOrder,
        currentPage,
        itemsPerPage,
      },
    ],
    queryFn: () => {
      const params: Record<string, string | undefined> = {
        search: searchTerm.trim() || undefined,
        position_id: positionIdFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        sort_by: sortBy || undefined,
        sort_order: sortOrder,
        skip: ((currentPage - 1) * itemsPerPage).toString(),
        limit: itemsPerPage.toString(),
      };

      if (selectedStatuses.length > 0) {
        params.status_filter = selectedStatuses.join(",");
      }
      if (selectedStages.length > 0) {
        params.current_stage = selectedStages.join(",");
      }
      if (selectedPositions.length > 0) {
        params.positions = selectedPositions.join(",");
      }
      if (selectedClients.length > 0) {
        params.clients = selectedClients.join(",");
      }

      return fetchApplications(params);
    },
  });

  // Fetch position title for the breadcrumb when filtered by position
  const { data: positionMeta } = useQuery<Position | null>({
    queryKey: ["position-meta", positionIdFilter],
    queryFn: async () => {
      if (!positionIdFilter) return null;
      const res = await api.get(`/api/v1/positions/${positionIdFilter}`);
      return res.data as Position;
    },
    enabled: !!positionIdFilter,
    staleTime: 5 * 60 * 1000,
  });

  const applications = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const firstItem = total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const lastItem = Math.min(currentPage * itemsPerPage, total);

  // Checkbox helpers
  const isAllCurrentPageSelected =
    applications.length > 0 &&
    applications.every((app) => selectedAppIds.includes(app.id));

  const toggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      const pageIds = new Set(applications.map((a) => a.id));
      setSelectedAppIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const newSelected = new Set(selectedAppIds);
      applications.forEach((a) => newSelected.add(a.id));
      if (newSelected.size > 50) {
        showToast("error", "Maksimal 50 CV per download. Silakan pilih maksimal 50 kandidat.");
        return;
      }
      setSelectedAppIds(Array.from(newSelected));
    }
  };

  const toggleSelectApp = (appId: string) => {
    if (selectedAppIds.includes(appId)) {
      setSelectedAppIds((prev) => prev.filter((id) => id !== appId));
    } else {
      if (selectedAppIds.length >= 50) {
        showToast("error", "Maksimal 50 CV yang dapat dipilih sekaligus untuk download ZIP.");
        return;
      }
      setSelectedAppIds((prev) => [...prev, appId]);
    }
  };

  const handleBatchDownloadCVZip = async () => {
    if (selectedAppIds.length === 0) {
      showToast("error", "Pilih minimal 1 kandidat untuk mengunduh CV Altek.");
      return;
    }

    if (selectedAppIds.length > 50) {
      showToast("error", "Maksimal 50 kandidat per batch download.");
      return;
    }

    setIsDownloadingCVZip(true);
    showToast("info", `Sedang memproses & mengumpulkan ${selectedAppIds.length} CV Altek...`);

    try {
      const res = await api.post(
        "/api/v1/applications/batch-cv-zip",
        {
          application_ids: selectedAppIds,
          language: "ID",
        },
        { responseType: "blob" }
      );

      const blob = new Blob([res.data], { type: "application/zip" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `CV_Altek_Batch_${format(new Date(), "yyyyMMdd_HHmmss")}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      showToast("success", `Berhasil mengunduh ZIP untuk ${selectedAppIds.length} kandidat!`);
    } catch (err: any) {
      console.error("Gagal download batch CV zip:", err);
      showToast(
        "error",
        err?.response?.data?.detail ||
          "Gagal mengunduh file ZIP CV Altek. Silakan coba beberapa saat lagi."
      );
    } finally {
      setIsDownloadingCVZip(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportPipeline({
        status_filter: selectedStatuses.length > 0 ? selectedStatuses.join(",") : undefined,
        current_stage: selectedStages.length > 0 ? selectedStages.join(",") : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
    } catch (error) {
      console.error("Export gagal:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/applications")}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Semua Posisi
          </button>
          <div>
            <p className="text-sm font-medium text-gray-500">Pipeline Rekrutmen</p>
            <h1 className="text-2xl font-bold text-gray-900">
              {positionIdFilter && positionMeta
                ? `${positionMeta.title} – ${positionMeta.client_name}`
                : "Semua Lamaran"}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Batch Download CV Altek Button */}
          <button
            type="button"
            onClick={handleBatchDownloadCVZip}
            disabled={isDownloadingCVZip || selectedAppIds.length === 0}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-all ${
              selectedAppIds.length > 0
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
                : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
            }`}
            title={
              selectedAppIds.length === 0
                ? "Centang kandidat pada tabel untuk download ZIP CV Altek"
                : `Download ${selectedAppIds.length} CV Standar Altek (ZIP)`
            }
          >
            {isDownloadingCVZip ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">
                  progress_activity
                </span>
                <span>Mengunduh...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">folder_zip</span>
                <span>Download CV Altek ({selectedAppIds.length})</span>
              </>
            )}
          </button>

          {canCreateApplication && (
            <Link
              href="/applications/new"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
            >
              + Tambah Lamaran
            </Link>
          )}

          {canExport && (
            <ExportButton
              onExport={handleExport}
              filters={
                <div className="space-y-3 border-t border-gray-200 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
                      <select
                        value={selectedStatuses[0] || ""}
                        onChange={(e) =>
                          setSelectedStatuses(e.target.value ? [e.target.value] : [])
                        }
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      >
                        <option value="">Semua</option>
                        <option value="active">Aktif</option>
                        <option value="rejected">Ditolak</option>
                        <option value="hired">Diterima</option>
                        <option value="withdrawn">Ditarik</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Tahap</label>
                      <select
                        value={selectedStages[0] || ""}
                        onChange={(e) =>
                          setSelectedStages(e.target.value ? [e.target.value] : [])
                        }
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      >
                        <option value="">Semua</option>
                        {stageOptions.map((stage) => (
                          <option key={stage} value={stage}>
                            {formatStageLabel(stage)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Tanggal mulai</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Tanggal akhir</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              }
            />
          )}
        </div>
      </div>

      {/* Active position filter banner */}
      {positionIdFilter && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-2.5 rounded-xl shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-blue-600">filter_alt</span>
            <span>Memfilter kandidat untuk lowongan terpilih</span>
          </div>
          <button
            onClick={() => {
              setPositionIdFilter("");
              setCurrentPage(1);
              router.push("/applications?view=all");
            }}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-2.5 py-1 rounded-md shadow-sm transition-colors"
          >
            Hapus Filter Posisi ✕
          </button>
        </div>
      )}

      {/* Filter bar with Multiple Choice */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* Search */}
          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Cari</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={handleFilterChange(setSearchTerm)}
                placeholder="Cari kandidat, email, posisi..."
                className="w-full rounded-lg border border-gray-300 pl-9 pr-8 py-2 text-sm outline-none focus:border-primary"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
          </div>

          {/* Posisi (Multiple Choice) */}
          <div>
            <MultiSelectDropdown
              label="Posisi"
              options={positionOptions}
              selected={selectedPositions}
              onChange={(vals) => {
                setSelectedPositions(vals);
                setCurrentPage(1);
              }}
              placeholder="Semua Posisi"
              allLabel="Semua Posisi"
              itemTypeLabel="posisi"
            />
          </div>

          {/* Client (Multiple Choice) */}
          <div>
            <MultiSelectDropdown
              label="Client"
              options={clientOptions}
              selected={selectedClients}
              onChange={(vals) => {
                setSelectedClients(vals);
                setCurrentPage(1);
              }}
              placeholder="Semua Client"
              allLabel="Semua Client"
              itemTypeLabel="client"
            />
          </div>

          {/* Status (Multiple Choice) */}
          <div>
            <MultiSelectDropdown
              label="Status"
              options={statusOptions}
              selected={selectedStatuses}
              onChange={(vals) => {
                setSelectedStatuses(vals);
                setCurrentPage(1);
              }}
              placeholder="Semua Status"
              allLabel="Semua Status"
              itemTypeLabel="status"
            />
          </div>

          {/* Tahap (Multiple Choice) */}
          <div>
            <MultiSelectDropdown
              label="Tahap"
              options={stageDropdownOptions}
              selected={selectedStages}
              onChange={(vals) => {
                setSelectedStages(vals);
                setCurrentPage(1);
              }}
              placeholder="Semua Tahap"
              allLabel="Semua Tahap"
              itemTypeLabel="tahap"
            />
          </div>
        </div>

        {/* Date Filters Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">Tanggal Mulai:</label>
            <input
              type="date"
              value={startDate}
              onChange={handleFilterChange(setStartDate)}
              className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">Tanggal Akhir:</label>
            <input
              type="date"
              value={endDate}
              onChange={handleFilterChange(setEndDate)}
              className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            />
          </div>

          {/* Active selection info */}
          {selectedAppIds.length > 0 && (
            <div className="ml-auto flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg text-xs font-medium text-indigo-700">
              <span>{selectedAppIds.length} kandidat dicentang</span>
              <button
                type="button"
                onClick={() => setSelectedAppIds([])}
                className="text-indigo-600 hover:text-indigo-900 font-bold ml-1"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Applications table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                {/* Select All Checkbox */}
                <th className="w-10 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={toggleSelectAllCurrentPage}
                    disabled={applications.length === 0}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    title="Pilih semua di halaman ini (maks 50)"
                  />
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort("candidate")}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <span>Kandidat</span>
                    <span className="material-symbols-outlined text-[16px]">
                      {sortBy === "candidate"
                        ? sortOrder === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort("position")}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <span>Posisi</span>
                    <span className="material-symbols-outlined text-[16px]">
                      {sortBy === "position"
                        ? sortOrder === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort("client")}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <span>Client</span>
                    <span className="material-symbols-outlined text-[16px]">
                      {sortBy === "client"
                        ? sortOrder === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">Tahap</th>
                <th className="px-4 py-3">
                  <span title="Skor hasil screening CV mendalam oleh AI">Screening Score</span>
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort("update")}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <span>Update</span>
                    <span className="material-symbols-outlined text-[16px]">
                      {sortBy === "update"
                        ? sortOrder === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort("recruiter")}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <span>Recruiter</span>
                    <span className="material-symbols-outlined text-[16px]">
                      {sortBy === "recruiter"
                        ? sortOrder === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                {canDelete && <th className="px-4 py-3 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                    Memuat data lamaran...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                    Belum ada lamaran.
                  </td>
                </tr>
              ) : (
                applications.map((application) => {
                  const isChecked = selectedAppIds.includes(application.id);
                  return (
                    <tr
                      key={application.id}
                      className={`border-t border-gray-200 transition-colors ${
                        isChecked ? "bg-indigo-50/50 hover:bg-indigo-50" : "hover:bg-gray-50"
                      }`}
                    >
                      {/* Checkbox per row */}
                      <td className="w-10 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectApp(application.id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/applications/${application.id}`} className="group block">
                          <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{application.candidate_name || "-"}</p>
                          <p className="text-xs text-gray-500">{application.candidate_email || "-"}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{application.position_title || "-"}</td>
                      <td className="px-4 py-3 text-gray-700">{application.client_name || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${stageBadgeClass(application.current_stage)}`}>
                            {formatStageLabel(application.current_stage)}
                          </span>
                          {application.last_result && (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${resultBadgeClass(application.last_result)}`}>
                              {formatResultLabel(application.last_result)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {application.ai_score !== undefined && application.ai_score !== null ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${aiScoreBadgeClass(application.ai_score)}`}>
                              {aiStatusIcon(application.ai_screening_status)} {application.ai_score}
                            </span>
                            <span className="text-xs text-gray-400">{application.ai_screening_status === "sudah_direview" ? "Done_review" : application.ai_screening_status === "siap_review" ? "Siap review" : "Menunggu"}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(application.status)}`}>
                            {application.status}
                          </span>
                          {application.is_blacklisted && (
                            <span className="inline-flex items-center rounded-full bg-red-200 px-2 py-0.5 text-xs font-medium text-red-800">
                              <span className="material-symbols-outlined text-xs mr-0.5">block</span>
                              Blacklist
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {application.updated_at ? format(new Date(application.updated_at), "dd MMM yyyy", { locale: idLocale }) : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{application.recruiter_name || "-"}</td>
                      {canDelete && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(application.id, application.candidate_name || "-")}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 hover:border-red-300"
                            title="Hapus lamaran"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                            Hapus
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between py-4 px-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            {total === 0
              ? "Tidak ada lamaran"
              : `Menampilkan ${firstItem}–${lastItem} dari ${total} lamaran`}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            disabled={isLoading}
          />
        </div>
      </div>
      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <span className="material-symbols-outlined text-red-600 text-[20px]">delete_forever</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Hapus Lamaran?</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Lamaran <span className="font-medium text-gray-800">{deleteConfirm.name}</span> akan dihapus secara permanen dan tidak dapat dipulihkan.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>}
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ApplicationsContent() {
  const searchParams = useSearchParams();
  const positionId = searchParams.get("position_id");
  const viewAll = searchParams.get("view") === "all";
  const stage = searchParams.get("stage") || searchParams.get("current_stage");
  const status = searchParams.get("status") || searchParams.get("status_filter");

  // Show pipeline table when: position_id is set, view=all, or stage/status filters present
  const showPipeline = !!positionId || viewAll || !!stage || !!status;

  if (showPipeline) {
    return <ApplicationsPipeline />;
  }

  return <ApplicationsSummary />;
}

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Memuat data lamaran...</div>}>
      <ApplicationsContent />
    </Suspense>
  );
}
