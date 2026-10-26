"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Filter, Pencil, X, Users, Briefcase, UserMinus } from "lucide-react";
import api from "@/lib/api";
import { settingsApi } from "@/lib/api/settings";
import type { Candidate } from "@/types";
import { useExport } from "@/hooks/useExport";
import ExportButton from "@/components/ExportButton";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";
import { useModalEscape } from "@/hooks/useModalEscape";
import TalentPoolModal from "@/components/candidates/TalentPoolModal";
import BulkAssignModal from "@/components/candidates/BulkAssignModal";

function normalizeRole(role: string | undefined): string {
  if (!role) return "";
  return role.split(".").pop()?.toLowerCase() || role;
}

function isCandidateInTalentPool(candidate: Candidate): boolean {
  return (
    candidate.pool_status === "talent_pool" ||
    (candidate as any).talent_pool === 1 ||
    (candidate as any).talent_pool === true ||
    (candidate as any).talent_pool === "1" ||
    (candidate as any).is_talent_pool === true ||
    (candidate as any).is_talent_pool === 1
  );
}

function buildWhatsAppLink(phone?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  }
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

function WhatsAppIcon({
  className = "h-4 w-4",
  disabled = false,
}: {
  className?: string;
  disabled?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/whatsapp.png"
      alt="WhatsApp"
      className={`${className} ${disabled ? "opacity-40 grayscale" : ""}`}
    />
  );
}

type SalaryRange = { min: number | null; max: number | null };

const SALARY_RANGES: { value: string; label: string; range: SalaryRange }[] = [
  { value: "", label: "Semua", range: { min: null, max: null } },
  { value: "lt_5m", label: "< 5 juta", range: { min: null, max: 5000000 } },
  { value: "5_10m", label: "5 - 10 juta", range: { min: 5000000, max: 10000000 } },
  { value: "10_15m", label: "10 - 15 juta", range: { min: 10000000, max: 15000000 } },
  { value: "15_20m", label: "15 - 20 juta", range: { min: 15000000, max: 20000000 } },
  { value: "gt_20m", label: "> 20 juta", range: { min: 20000000, max: null } },
];

function getSalaryRange(value: string): SalaryRange {
  return SALARY_RANGES.find((r) => r.value === value)?.range ?? { min: null, max: null };
}

async function fetchCandidates(params?: Record<string, string | undefined>) {
  const response = await api.get("/api/v1/candidates", { params });
  return response.data as Candidate[];
}

export interface CandidatesTableProps {
  /** Default pool_status filter. Omit to show all candidates (database view). */
  poolStatus?: "database" | "talent_pool" | "future_lead";
  eyebrow?: string;
  title?: string;
  showExport?: boolean;
}

export default function CandidatesTable({
  poolStatus,
  eyebrow = "Talent pool",
  title = "Kandidat",
  showExport = true,
}: CandidatesTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("");
  const [educationFilter, setEducationFilter] = useState("");
  const [currentSalaryFilter, setCurrentSalaryFilter] = useState("");
  const [expectedSalaryFilter, setExpectedSalaryFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Multi-select state
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [showTalentPoolModal, setShowTalentPoolModal] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [talentPoolReason, setTalentPoolReason] = useState<"gaji_tidak_sesuai" | "kebutuhan_masa_depan" | "lainnya">("gaji_tidak_sesuai");
  const [talentPoolNotes, setTalentPoolNotes] = useState("");

  const user = useAuthStore((state) => state.user);
  const canExport = user ? ["admin", "manager"].includes(normalizeRole(user.role)) : false;
  const canMoveTalentPool = user
    ? ["admin", "hr", "manager"].includes(normalizeRole(user.role))
    : false;
  const queryClient = useQueryClient();
  const { showToast } = useToastStore();

  // Per-row talent pool modal state
  const [rowTalentPoolCandidate, setRowTalentPoolCandidate] = useState<Candidate | null>(null);
  const [candidateToRemove, setCandidateToRemove] = useState<Candidate | null>(null);
  const [isRemovingTalentPool, setIsRemovingTalentPool] = useState(false);
  const [showBulkRemoveModal, setShowBulkRemoveModal] = useState(false);

  const { exportCandidates } = useExport();

  // Selection helpers
  const handleSelectAll = (candidates: Candidate[]) => {
    if (selectedCandidateIds.size === candidates.length && candidates.length > 0) {
      setSelectedCandidateIds(new Set());
    } else {
      setSelectedCandidateIds(new Set(candidates.map((c) => c.id)));
    }
  };

  const handleSelectOne = (candidateId: string) => {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedCandidateIds(new Set());

  // Talent Pool bulk mutation state
  const [isUpdatingTalentPool, setIsUpdatingTalentPool] = useState(false);

  // Close bulk modal on Escape
  useModalEscape(() => setShowTalentPoolModal(false), showTalentPoolModal && !isUpdatingTalentPool);

  const handleBulkTalentPool = () => {
    if (selectedCandidateIds.size === 0) return;
    setShowTalentPoolModal(true);
  };

  const handleConfirmTalentPool = async () => {
    if (selectedCandidateIds.size === 0) return;
    setIsUpdatingTalentPool(true);
    const count = selectedCandidateIds.size;
    try {
      await Promise.all(
        Array.from(selectedCandidateIds).map((id) =>
          api.patch(`/api/v1/candidates/${id}/talent-pool`, {
            pool_status: "talent_pool",
            talent_pool_reason: talentPoolReason,
            talent_pool_notes: talentPoolNotes || undefined,
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      showToast("success", `${count} kandidat berhasil dipindahkan ke Talent Pool`);
      setShowTalentPoolModal(false);
      clearSelection();
    } catch (error: any) {
      showToast("error", error?.response?.data?.detail || "Gagal memindahkan ke Talent Pool");
    } finally {
      setIsUpdatingTalentPool(false);
      setTalentPoolReason("gaji_tidak_sesuai");
      setTalentPoolNotes("");
    }
  };

  const handleConfirmRemoveSingle = async () => {
    if (!candidateToRemove) return;
    setIsRemovingTalentPool(true);
    try {
      await api.patch(`/api/v1/candidates/${candidateToRemove.id}/talent-pool`, {
        pool_status: "database",
        talent_pool_reason: null,
        talent_pool_notes: null,
      });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateToRemove.id] });
      showToast("success", `${candidateToRemove.full_name} berhasil dikeluarkan dari Talent Pool`);
      setCandidateToRemove(null);
    } catch (error: any) {
      showToast("error", error?.response?.data?.detail || "Gagal mengeluarkan kandidat dari Talent Pool");
    } finally {
      setIsRemovingTalentPool(false);
    }
  };

  const handleConfirmBulkRemove = async () => {
    if (selectedCandidateIds.size === 0) return;
    setIsRemovingTalentPool(true);
    const count = selectedCandidateIds.size;
    try {
      await Promise.all(
        Array.from(selectedCandidateIds).map((id) =>
          api.patch(`/api/v1/candidates/${id}/talent-pool`, {
            pool_status: "database",
            talent_pool_reason: null,
            talent_pool_notes: null,
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      showToast("success", `${count} kandidat berhasil dikeluarkan dari Talent Pool`);
      setShowBulkRemoveModal(false);
      clearSelection();
    } catch (error: any) {
      showToast("error", error?.response?.data?.detail || "Gagal mengeluarkan kandidat dari Talent Pool");
    } finally {
      setIsRemovingTalentPool(false);
    }
  };

  // Bulk Assign modal handlers
  const handleBulkAssignJob = () => {
    if (selectedCandidateIds.size === 0) return;
    setShowBulkAssignModal(true);
  };

  const handleBulkAssignSuccess = () => {
    setShowBulkAssignModal(false);
    clearSelection();
  };

  const { data: sourceChannels = [] } = useQuery({
    queryKey: ["source-channels"],
    queryFn: () => settingsApi.listSourceChannels({ is_active: true }),
  });

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: [
      "candidates",
      {
        poolStatus,
        searchTerm,
        sourceFilter,
        statusFilter,
        positionFilter,
        startDate,
        endDate,
        cityFilter,
        experienceFilter,
        educationFilter,
        currentSalaryFilter,
        expectedSalaryFilter,
        currentPage,
        itemsPerPage,
      },
    ],
    queryFn: () =>
      fetchCandidates({
        pool_status: poolStatus || undefined,
        search: searchTerm || undefined,
        source_channel: sourceFilter || undefined,
        completeness_status: statusFilter || undefined,
        position_id: positionFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        city: cityFilter || undefined,
        experience_level: experienceFilter || undefined,
        education: educationFilter || undefined,
        min_current_salary: getSalaryRange(currentSalaryFilter).min?.toString() || undefined,
        max_current_salary: getSalaryRange(currentSalaryFilter).max?.toString() || undefined,
        min_expected_salary: getSalaryRange(expectedSalaryFilter).min?.toString() || undefined,
        max_expected_salary: getSalaryRange(expectedSalaryFilter).max?.toString() || undefined,
        skip: ((currentPage - 1) * itemsPerPage).toString(),
        limit: itemsPerPage.toString(),
      }),
  });

  // Derived: names of selected candidates for modal
  const selectedCandidateNames = Array.from(selectedCandidateIds)
    .map((id) => candidates.find((c) => c.id === id)?.full_name)
    .filter((name): name is string => !!name);

  const handleExport = async () => {
    try {
      await exportCandidates({
        search: searchTerm || undefined,
        source_channel: sourceFilter || undefined,
        completeness_status: statusFilter || undefined,
        position_id: positionFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        city: cityFilter || undefined,
        experience_level: experienceFilter || undefined,
        education: educationFilter || undefined,
        min_current_salary: getSalaryRange(currentSalaryFilter).min?.toString() || undefined,
        max_current_salary: getSalaryRange(currentSalaryFilter).max?.toString() || undefined,
        min_expected_salary: getSalaryRange(expectedSalaryFilter).min?.toString() || undefined,
        max_expected_salary: getSalaryRange(expectedSalaryFilter).max?.toString() || undefined,
      });
    } catch (error) {
      console.error("Export gagal:", error);
    }
  };

  const isAllSelected = candidates.length > 0 && selectedCandidateIds.size === candidates.length;
  const isIndeterminate = selectedCandidateIds.size > 0 && selectedCandidateIds.size < candidates.length;

  const hasSelectedInTalentPool = Array.from(selectedCandidateIds).some((id) => {
    const c = candidates.find((cand) => cand.id === id);
    return c ? isCandidateInTalentPool(c) : false;
  });

  return (
    <div className="space-y-6">
      {/* Floating Bulk Action Bar */}
      {selectedCandidateIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-2xl ring-1 ring-black/5">
            <span className="text-sm font-semibold text-gray-700">
              {selectedCandidateIds.size} kandidat dipilih
            </span>
            <div className="h-4 w-px bg-gray-300" />
            {canMoveTalentPool && (
              poolStatus === "talent_pool" ? (
                <button
                  onClick={() => setShowBulkRemoveModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700"
                >
                  <UserMinus className="h-4 w-4" />
                  Keluarkan dari Talent Pool
                </button>
              ) : (
                <>
                  <button
                    onClick={handleBulkTalentPool}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
                  >
                    <Users className="h-4 w-4" />
                    Pindahkan ke Talent Pool
                  </button>
                  {hasSelectedInTalentPool && (
                    <button
                      onClick={() => setShowBulkRemoveModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700"
                    >
                      <UserMinus className="h-4 w-4" />
                      Keluarkan dari Talent Pool
                    </button>
                  )}
                </>
              )
            )}
            <button
              onClick={handleBulkAssignJob}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700"
            >
              <Briefcase className="h-4 w-4" />
              Assign ke Lowongan
            </button>
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Batal Pilihan
            </button>
          </div>
        </div>
      )}

      {/* Talent Pool Modal */}
      {showTalentPoolModal && (
        <div 
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowTalentPoolModal(false)}
        >
          <div 
            className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-on-surface">Pindahkan ke Talent Pool</h2>
                <p className="text-sm text-on-surface-variant">{selectedCandidateIds.size} kandidat akan dipindahkan ke Talent Pool.</p>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-label-md text-on-surface mb-1.5">
                Alasan <span className="text-error">*</span>
              </label>
              <select
                value={talentPoolReason}
                onChange={(e) =>
                  setTalentPoolReason(
                    e.target.value as "gaji_tidak_sesuai" | "kebutuhan_masa_depan" | "lainnya"
                  )
                }
                className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              >
                <option value="gaji_tidak_sesuai">Gaji tidak sesuai</option>
                <option value="kebutuhan_masa_depan">Kebutuhan masa depan</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </div>
            
            <div className="mb-6">
              <label className="block text-label-md text-on-surface mb-1.5">
                Catatan (opsional)
              </label>
              <textarea
                value={talentPoolNotes}
                onChange={(e) => setTalentPoolNotes(e.target.value)}
                rows={3}
                placeholder="Tambahkan catatan..."
                className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowTalentPoolModal(false)}
                disabled={isUpdatingTalentPool}
                className="flex-1 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface rounded-lg font-medium hover:bg-surface-container-highest transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmTalentPool}
                disabled={isUpdatingTalentPool}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-wait"
              >
                {isUpdatingTalentPool ? "Memproses..." : "Konfirmasi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkAssignModal && (
        <BulkAssignModal
          candidateIds={Array.from(selectedCandidateIds)}
          candidateNames={selectedCandidateNames}
          isOpen={showBulkAssignModal}
          onClose={() => setShowBulkAssignModal(false)}
          onSuccess={handleBulkAssignSuccess}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{eyebrow}</p>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/candidates/new"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
          >
            + Tambah Kandidat
          </Link>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-200"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
          {canExport && showExport && (
            <ExportButton
              onExport={handleExport}
              className="hidden md:inline-flex"
            />
          )}
        </div>
      </div>

      {showFilters && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm space-y-3">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Posisi</label>
              <input
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                placeholder="Judul posisi"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Tanggal mulai</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Tanggal akhir</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Pendidikan</label>
              <input
                value={educationFilter}
                onChange={(e) => setEducationFilter(e.target.value)}
                placeholder="S1, SMA, dll"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Kota</label>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Semua</option>
                <option value="jabotabek">Jabodetabek</option>
                <option value="non_jabotabek">Non-Jabodetabek</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Pengalaman Kerja</label>
              <select
                value={experienceFilter}
                onChange={(e) => setExperienceFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Semua</option>
                <option value="junior">Junior (0-3 thn)</option>
                <option value="intermediate">Intermediate (3-5 thn)</option>
                <option value="senior">Senior (&gt; 5 thn)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Gaji Saat Ini</label>
              <select
                value={currentSalaryFilter}
                onChange={(e) => setCurrentSalaryFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {SALARY_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Gaji Ekspektasi</label>
              <select
                value={expectedSalaryFilter}
                onChange={(e) => setExpectedSalaryFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {SALARY_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setPositionFilter("");
                  setStartDate("");
                  setEndDate("");
                  setCityFilter("");
                  setExperienceFilter("");
                  setEducationFilter("");
                  setCurrentSalaryFilter("");
                  setExpectedSalaryFilter("");
                }}
                className="w-full rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                Reset Filter
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Cari
            </label>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama, kota, skill, institusi..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Pendidikan
            </label>
            <input
              value={educationFilter}
              onChange={(e) => setEducationFilter(e.target.value)}
              placeholder="S1, SMA..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Kota
            </label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Semua</option>
              <option value="jabotabek">Jabodetabek</option>
              <option value="non_jabotabek">Non-Jabodetabek</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Pengalaman
            </label>
            <select
              value={experienceFilter}
              onChange={(e) => setExperienceFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Semua</option>
              <option value="junior">Junior (0-3 thn)</option>
              <option value="intermediate">Intermediate (3-5 thn)</option>
              <option value="senior">Senior (&gt; 5 thn)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Sumber
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Semua</option>
              {sourceChannels.map((sc) => (
                <option key={sc.id} value={sc.label}>{sc.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6 mt-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Kelengkapan
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Semua</option>
              <option value="lengkap">Lengkap</option>
              <option value="belum_lengkap">Belum lengkap</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Gaji Saat Ini
            </label>
            <select
              value={currentSalaryFilter}
              onChange={(e) => setCurrentSalaryFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {SALARY_RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Gaji Ekspektasi
            </label>
            <select
              value={expectedSalaryFilter}
              onChange={(e) => setExpectedSalaryFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {SALARY_RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                {/* Select All checkbox */}
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                    onChange={() => handleSelectAll(candidates)}
                    aria-label="Pilih semua kandidat di halaman ini"
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 accent-blue-600"
                  />
                </th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">WA</th>
                <th className="px-4 py-3">Pendidikan</th>
                <th className="px-4 py-3">Posisi yang Dilamar</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Gaji Ekspektasi</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                    Memuat data kandidat...
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                    Belum ada kandidat.
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => {
                  const isSelected = selectedCandidateIds.has(candidate.id);
                  return (
                    <tr
                      key={candidate.id}
                      className={`border-t border-gray-200 transition-colors ${
                        isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50"
                      }`}
                    >
                      {/* Row checkbox */}
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(candidate.id)}
                          aria-label={`Pilih ${candidate.full_name}`}
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Link href={`/candidates/${candidate.id}`} className="flex-shrink-0">
                            {candidate.photo_url ? (
                              <img
                                src={candidate.photo_url}
                                alt={candidate.full_name}
                                className="h-8 w-8 rounded-full object-cover transition-opacity hover:opacity-80"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium transition-colors hover:bg-gray-300">
                                ?
                              </div>
                            )}
                          </Link>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/candidates/${candidate.id}`}
                                className="font-semibold text-gray-900 transition-colors hover:text-blue-600 hover:underline"
                              >
                                {candidate.full_name}
                              </Link>
                              {candidate.is_blacklisted && (
                                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 border border-red-200">
                                  Blacklist
                                </span>
                              )}
                              {isCandidateInTalentPool(candidate) && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200"
                                  title="Kandidat berstatus Talent Pool"
                                >
                                  <Users className="h-3 w-3" />
                                  Talent Pool
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{candidate.identity_no || "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p>{candidate.email || "-"}</p>
                          <p>{candidate.phone || "-"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const waLink = buildWhatsAppLink(candidate.phone);
                          return waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 transition-colors hover:bg-[#25D366]/25"
                              title={`Chat WhatsApp ke ${candidate.full_name}`}
                            >
                              <WhatsAppIcon className="h-5 w-5" />
                            </a>
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                              <WhatsAppIcon className="h-5 w-5" disabled />
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {candidate.last_education ? (
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium text-gray-900">
                              {candidate.last_education.major || "-"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {[
                                candidate.last_education.institution,
                                candidate.last_education.graduation_year,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "-"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {candidate.applied_positions && candidate.applied_positions.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-sm text-gray-900">
                              {candidate.applied_positions[0]}
                            </span>
                            {candidate.applied_positions.length > 1 && (
                              <span
                                className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700"
                                title={candidate.applied_positions.slice(1).join(", ")}
                              >
                                +{candidate.applied_positions.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {candidate.experience_level ? (
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              candidate.experience_level === "senior"
                                ? "border-purple-200 bg-purple-100 text-purple-800"
                                : candidate.experience_level === "intermediate"
                                ? "border-sky-200 bg-sky-100 text-sky-800"
                                : "border-emerald-200 bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {candidate.experience_level === "senior"
                              ? "Senior"
                              : candidate.experience_level === "intermediate"
                              ? "Intermediate"
                              : "Junior"}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {candidate.expected_salary ? (
                          <span className="text-sm font-medium text-gray-900">
                            Rp {Number(candidate.expected_salary).toLocaleString("id-ID")}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/candidates/${candidate.id}/cv`}
                            className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 shadow-sm transition-all hover:bg-violet-100"
                            title="Generate CV Standar Altek"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            CV
                          </Link>
                          {canMoveTalentPool && (
                            isCandidateInTalentPool(candidate) ? (
                              <button
                                type="button"
                                onClick={() => setCandidateToRemove(candidate)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition-all hover:bg-rose-100"
                                title="Keluarkan dari Talent Pool"
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                                Keluarkan
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setRowTalentPoolCandidate(candidate)}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100"
                                title="Pindahkan ke Talent Pool"
                              >
                                <Users className="h-3.5 w-3.5" />
                                Talent Pool
                              </button>
                            )
                          )}
                          <Link
                            href={`/candidates/${candidate.id}/edit`}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50"
                            title="Edit Data Kandidat"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between py-4 px-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Menampilkan {candidates.length} kandidat
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="text-sm font-medium text-gray-700">Halaman {currentPage}</span>
            <button
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={candidates.length < itemsPerPage}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* Per-row Talent Pool Modal */}
      {rowTalentPoolCandidate && (
        <TalentPoolModal
          candidateId={rowTalentPoolCandidate.id}
          candidateName={rowTalentPoolCandidate.full_name}
          isOpen={rowTalentPoolCandidate !== null}
          onClose={() => setRowTalentPoolCandidate(null)}
          onSuccess={() => setRowTalentPoolCandidate(null)}
        />
      )}

      {/* Single Remove from Talent Pool Modal */}
      {candidateToRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setCandidateToRemove(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <UserMinus className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Keluarkan dari Talent Pool</h2>
                <p className="text-sm text-gray-500">{candidateToRemove.full_name}</p>
              </div>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              Apakah Anda yakin ingin mengeluarkan <strong>{candidateToRemove.full_name}</strong> dari Talent Pool? Status kandidat akan dikembalikan menjadi Database kandidat biasa.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCandidateToRemove(null)}
                disabled={isRemovingTalentPool}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveSingle}
                disabled={isRemovingTalentPool}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isRemovingTalentPool ? "Mengeluarkan..." : "Keluarkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Remove from Talent Pool Modal */}
      {showBulkRemoveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowBulkRemoveModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <UserMinus className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Keluarkan dari Talent Pool</h2>
                <p className="text-sm text-gray-500">{selectedCandidateIds.size} kandidat dipilih</p>
              </div>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              Apakah Anda yakin ingin mengeluarkan <strong>{selectedCandidateIds.size} kandidat</strong> terpilih dari Talent Pool? Status mereka akan dikembalikan menjadi Database kandidat biasa.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowBulkRemoveModal(false)}
                disabled={isRemovingTalentPool}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkRemove}
                disabled={isRemovingTalentPool}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isRemovingTalentPool ? "Mengeluarkan..." : "Keluarkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
