"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import { settingsApi } from "@/lib/api/settings";
import { positionsApi } from "@/lib/api/positions";
import { useToastStore } from "@/stores/toast.store";
import { useAuthStore } from "@/stores/auth.store";
import { getErrorMessage } from "@/lib/errors";
import type {
  Candidate,
  CandidateSource,
  Position,
  RecommendCandidate,
  RecommendCandidatesResponse,
  SourceChannel,
} from "@/types";
import { useModalEscape } from "@/hooks/useModalEscape";

const formSchema = z.object({
  candidate_id: z.string().optional(),
  position_id: z.string().min(1, "Pilih posisi terlebih dahulu"),
  recruiter_id: z.string().optional(),
  client_user_name: z.string().optional(),
  current_stage: z.string().default("Dijadwalkan_Interview"),
});

type FormValues = z.infer<typeof formSchema>;

const POOL_STATUS_LABELS: Record<string, string> = {
  talent_pool: "Talent Pool",
  database: "Database",
  future_lead: "Future Lead",
};

export default function NewApplicationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const currentUser = useAuthStore((state) => state.user);

  const [candidateSearch, setCandidateSearch] = useState("");
  const [showCandidateDropdown, setShowCandidateDropdown] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  // Multi-kandidat untuk form manual
  const [selectedCandidates, setSelectedCandidates] = useState<Candidate[]>([]);
  const manualCandidateInputRef = useRef<HTMLInputElement>(null);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [showCooldownModal, setShowCooldownModal] = useState(false);
  const [cooldownMessage, setCooldownMessage] = useState<string>("");
  const [pendingFormValues, setPendingFormValues] = useState<FormValues | null>(null);

  const [positionSearch, setPositionSearch] = useState("");
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  // ── Pusat Sourcing (TASK-21.1) ────────────────────────────────────────────
  const [clientUserName, setClientUserName] = useState("");
  const [candidateSource, setCandidateSource] = useState<CandidateSource>("all");
  const [recommendations, setRecommendations] = useState<RecommendCandidate[]>([]);
  const [recommendMessage, setRecommendMessage] = useState("");

  // CV bulk upload state
  const [cvFiles, setCvFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadPositionSearch, setUploadPositionSearch] = useState("");
  const [showUploadPositionDropdown, setShowUploadPositionDropdown] = useState(false);
  const [selectedUploadPosition, setSelectedUploadPosition] = useState<Position | null>(null);
  const [uploadSourceChannel, setUploadSourceChannel] = useState("");
  const [sourceChannels, setSourceChannels] = useState<SourceChannel[]>([]);
  const cvFileInputRef = useRef<HTMLInputElement>(null);
  const [lastUploadResult, setLastUploadResult] = useState<{
    total_files: number;
    created_screening_result_ids: string[];
    position_title?: string;
    client_name?: string | null;
  } | null>(null);

  const candidateRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<HTMLDivElement>(null);
  const uploadPositionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (candidateRef.current && !candidateRef.current.contains(e.target as Node)) {
        setShowCandidateDropdown(false);
      }
      if (positionRef.current && !positionRef.current.contains(e.target as Node)) {
        setShowPositionDropdown(false);
      }
      if (uploadPositionRef.current && !uploadPositionRef.current.contains(e.target as Node)) {
        setShowUploadPositionDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    settingsApi.listSourceChannels({ is_active: true }).then(setSourceChannels).catch(() => {});
  }, []);

  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates-search", candidateSearch],
    queryFn: async () => {
      if (!candidateSearch.trim()) return [];
      const response = await api.get("/api/v1/candidates", {
        params: { search: candidateSearch, limit: 20 },
      });
      return response.data as Candidate[];
    },
    enabled: candidateSearch.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const { data: activePositions = [], isLoading: loadingPositions } = useQuery({
    queryKey: ["positions", "active"],
    queryFn: positionsApi.listActive,
    staleTime: 5 * 60 * 1000,
  });

  // Filter di sisi klien agar dropdown tetap terisi walau kolom pencarian kosong.
  const filteredPositions = useMemo(() => {
    const term = positionSearch.trim().toLowerCase();
    if (!term) return activePositions;
    return activePositions.filter(
      (pos) =>
        pos.title.toLowerCase().includes(term) ||
        (pos.client_name ?? "").toLowerCase().includes(term)
    );
  }, [activePositions, positionSearch]);

  // Daftar PIC User Klien mengikuti posisi yang dipilih (master data posisi).
  const clientUserOptions = selectedPosition?.client_user_names ?? [];
  const { data: uploadPositions = [] } = useQuery({
    queryKey: ["positions-upload-search", uploadPositionSearch],
    queryFn: async () => {
      if (!uploadPositionSearch.trim()) return [];
      const response = await api.get("/api/v1/positions", {
        params: { search: uploadPositionSearch, is_active: true },
      });
      return response.data as Position[];
    },
    enabled: uploadPositionSearch.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async ({ positionId, files, sourceChannel }: { positionId: string; files: File[]; sourceChannel?: string }) => {
      const formData = new FormData();
      formData.append("position_id", positionId);
      if (sourceChannel) formData.append("source_channel", sourceChannel);
      files.forEach((file) => formData.append("files", file));
      const response = await api.post("/api/v1/applications/bulk-upload-cv", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-active-positions"] });
      queryClient.invalidateQueries({ queryKey: ["pending-reviews"] });
      const msg = `${data.total_files} CV berhasil diupload. Proses AI screening berjalan di background — notifikasi akan muncul saat selesai.`;
      showToast("success", msg);
      setLastUploadResult(data);
      setCvFiles([]);
    },
    onError: (err) => {
      showToast("error", getErrorMessage(err, "Gagal upload CV."));
    },
  });

  const BULK_CV_MAX_FILES = 50;
  const BULK_CV_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const BULK_CV_ALLOWED_EXT = [".pdf", ".docx"];

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const all = Array.from(incoming);

    // Filter format
    const valid = all.filter((f) => {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      return BULK_CV_ALLOWED_EXT.includes(ext);
    });
    const invalidFormat = all.length - valid.length;
    if (invalidFormat > 0) {
      showToast("error", `${invalidFormat} file diabaikan — hanya PDF dan DOCX yang diizinkan.`);
    }

    // Filter ukuran
    const tooBig = valid.filter((f) => f.size > BULK_CV_MAX_FILE_SIZE);
    if (tooBig.length > 0) {
      showToast(
        "error",
        `${tooBig.length} file diabaikan karena melebihi batas ukuran 5 MB: ${tooBig.map((f) => f.name).join(", ")}`
      );
    }
    const sizeOk = valid.filter((f) => f.size <= BULK_CV_MAX_FILE_SIZE);

    setCvFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const deduped = sizeOk.filter((f) => !existing.has(f.name + f.size));
      const merged = [...prev, ...deduped];

      // Cek limit total
      if (merged.length > BULK_CV_MAX_FILES) {
        const allowed = BULK_CV_MAX_FILES - prev.length;
        if (allowed <= 0) {
          showToast("error", `Batas maksimal ${BULK_CV_MAX_FILES} file sudah tercapai.`);
          return prev;
        }
        showToast(
          "error",
          `Hanya ${allowed} file yang ditambahkan — batas maksimal ${BULK_CV_MAX_FILES} file per upload.`
        );
        return [...prev, ...deduped.slice(0, allowed)];
      }
      return merged;
    });
  }, [showToast]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleBulkUpload = () => {
    if (!selectedUploadPosition) {
      showToast("error", "Pilih posisi terlebih dahulu.");
      return;
    }
    if (cvFiles.length === 0) {
      showToast("error", "Pilih minimal satu file CV.");
      return;
    }
    if (cvFiles.length > BULK_CV_MAX_FILES) {
      showToast("error", `Maksimal ${BULK_CV_MAX_FILES} file per upload. Hapus beberapa file terlebih dahulu.`);
      return;
    }
    bulkUploadMutation.mutate({ positionId: selectedUploadPosition.id, files: cvFiles, sourceChannel: uploadSourceChannel });
  };

  const createMutation = useMutation({
    mutationFn: (payload: FormValues & { force_blacklisted?: boolean; force_cooldown?: boolean }) =>
      api.post("/api/v1/applications", payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-active-positions"] });
      showToast("success", "Lamaran berhasil dibuat.");
      router.push(`/applications/${response.data.id}`);
    },
    onError: (err) => {
      const msg = getErrorMessage(err, "Gagal membuat lamaran.");
      if ((err as any)?.response?.status === 400) {
        // Cooldown error → tampilkan modal konfirmasi agar HR bisa force-bypass
        if (msg.includes("pernah ditolak")) {
          setCooldownMessage(msg);
          setShowCooldownModal(true);
          return;
        }
        // Blacklist error dari backend (fallback jika pre-check di onSubmit tidak menangkap)
        // → tampilkan modal konfirmasi yang sama dengan alur blacklist normal
        if (msg.includes("blacklist")) {
          setShowBlacklistModal(true);
          return;
        }
      }
      showToast("error", msg);
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recruiter_id: currentUser?.id,
      current_stage: "Dijadwalkan_Interview",
    },
  });

  const handleSelectCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setValue("candidate_id", candidate.id);
    setCandidateSearch(candidate.full_name);
    setShowCandidateDropdown(false);
    // Tambahkan ke multi-kandidat jika belum ada
    setSelectedCandidates((prev) => {
      if (prev.find((c) => c.id === candidate.id)) return prev;
      return [...prev, candidate];
    });
    // Reset input agar siap untuk kandidat berikutnya
    setCandidateSearch("");
    setTimeout(() => manualCandidateInputRef.current?.focus(), 0);
  };

  const handleSelectPosition = (position: Position) => {
    setSelectedPosition(position);
    setValue("position_id", position.id);
    setPositionSearch(position.title);
    setShowPositionDropdown(false);
    // PIC User Klien sudah ditentukan pada posisi — PIC pertama langsung dipakai
    // bila posisi hanya punya satu PIC.
    const pics = position.client_user_names ?? [];
    const nextPic = pics.length === 1 ? pics[0] : "";
    setClientUserName(nextPic);
    setValue("client_user_name", nextPic);
    // Rekomendasi lama tidak lagi relevan untuk posisi baru.
    setRecommendations([]);
    setRecommendMessage("");
  };

  // ── AI Sourcing: Two-Stage Matching (TASK-21.1) ───────────────────────────
  const recommendMutation = useMutation({
    mutationFn: async ({ positionId, source, pic }: { positionId: string; source: CandidateSource; pic?: string }) => {
      const response = await api.post(`/api/v1/positions/${positionId}/recommend-candidates`, {
        source,
        client_user_name: pic || undefined,
      });
      return response.data as RecommendCandidatesResponse;
    },
    onSuccess: (data) => {
      setRecommendations(data.candidates ?? []);
      setRecommendMessage(data.message ?? "");
    },
    onError: (err) => {
      setRecommendations([]);
      setRecommendMessage("");
      showToast("error", getErrorMessage(err, "Gagal mencari rekomendasi kandidat."));
    },
  });

  const handleRecommend = () => {
    if (!selectedPosition) {
      showToast("error", "Pilih posisi terlebih dahulu.");
      return;
    }
    recommendMutation.mutate({
      positionId: selectedPosition.id,
      source: candidateSource,
      pic: clientUserName || undefined,
    });
  };

  // ── Hasil Rekomendasi AI & Bulk Pipeline Insert (TASK-21.2) ────────────────
  const [selectedRecommendIds, setSelectedRecommendIds] = useState<Set<string>>(new Set());
  const [runAIScreening, setRunAIScreening] = useState(false);

  // Toggle AI Screening hanya boleh dilihat/diatur oleh Admin & Manager (FR-03.10).
  const canToggleAIScreening = currentUser
    ? ["admin", "manager"].includes(currentUser.role?.split(".").pop()?.toLowerCase() ?? "")
    : false;

  // Reset pilihan setiap kali rekomendasi baru dimuat.
  useEffect(() => {
    setSelectedRecommendIds(new Set());
  }, [recommendations]);

  const toggleRecommend = (candidateId: string) => {
    setSelectedRecommendIds((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
  };

  const allRecommendationsSelected =
    recommendations.length > 0 && selectedRecommendIds.size === recommendations.length;

  const toggleSelectAllRecommendations = () => {
    setSelectedRecommendIds((prev) =>
      prev.size === recommendations.length ? new Set() : new Set(recommendations.map((c) => c.candidate_id))
    );
  };

  const bulkAssignMutation = useMutation({
    mutationFn: async (payload: {
      candidate_ids: string[];
      position_id: string;
      client_user_name?: string;
      run_ai_screening: boolean;
    }) => {
      const response = await api.post("/api/v1/candidates/bulk-assign", payload);
      return response.data as {
        success_count: number;
        skipped_count: number;
        skipped_details: { candidate_id: string; reason: string }[];
        message: string;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-active-positions"] });

      const skipped = data.skipped_details ?? [];
      if (skipped.length > 0) {
        showToast(
          "warning",
          `${data.success_count} kandidat masuk pipeline, ${skipped.length} dilewati: ${skipped
            .map((s) => s.reason)
            .join("; ")}`
        );
      } else {
        showToast(
          "success",
          `${data.success_count} kandidat berhasil dimasukkan ke pipeline lamaran.`
        );
      }
      router.push("/applications");
    },
    onError: (err: unknown) => {
      showToast("error", getErrorMessage(err, "Gagal memasukkan kandidat ke pipeline lamaran."));
    },
  });

  const handleInsertToPipeline = () => {
    if (!selectedPosition) {
      showToast("error", "Pilih posisi terlebih dahulu.");
      return;
    }
    if (selectedRecommendIds.size === 0) {
      showToast("error", "Pilih minimal satu kandidat rekomendasi.");
      return;
    }
    bulkAssignMutation.mutate({
      candidate_ids: Array.from(selectedRecommendIds),
      position_id: selectedPosition.id,
      client_user_name: clientUserName || undefined,
      // Role HR tidak boleh memicu AI screening (dijamin backend juga).
      run_ai_screening: canToggleAIScreening && runAIScreening,
    });
  };

  const onSubmit = (values: FormValues) => {
    // Validasi manual: harus ada setidaknya 1 kandidat
    if (selectedCandidates.length === 0) {
      showToast("error", "Pilih minimal satu kandidat.");
      return;
    }
    // Multi-kandidat: gunakan bulk-assign
    if (selectedCandidates.length > 1) {
      if (!selectedPosition) {
        showToast("error", "Pilih posisi terlebih dahulu.");
        return;
      }
      bulkAssignMutation.mutate({
        candidate_ids: selectedCandidates.map((c) => c.id),
        position_id: selectedPosition.id,
        client_user_name: clientUserName || undefined,
        run_ai_screening: false,
      });
      return;
    }
    // Single kandidat: alur lama dengan blacklist/cooldown check
    if (selectedCandidate?.is_blacklisted) {
      setPendingFormValues(values);
      setShowBlacklistModal(true);
      showToast("warning", `Peringatan: Kandidat ${selectedCandidate.full_name} sedang dalam daftar blacklist.`);
      return;
    }
    setPendingFormValues(values);
    createMutation.mutate({ ...values, candidate_id: selectedCandidates[0].id });
  };

  const handleConfirmBlacklisted = () => {
    if (!pendingFormValues) return;
    setShowBlacklistModal(false);
    createMutation.mutate({ ...pendingFormValues, candidate_id: selectedCandidates[0]?.id ?? pendingFormValues.candidate_id, force_blacklisted: true });
    setPendingFormValues(null);
  };

  const handleCancelBlacklisted = () => {
    setShowBlacklistModal(false);
    setPendingFormValues(null);
  };

  const handleConfirmCooldown = () => {
    if (!pendingFormValues) return;
    setShowCooldownModal(false);
    createMutation.mutate({ ...pendingFormValues, candidate_id: selectedCandidates[0]?.id ?? pendingFormValues.candidate_id, force_cooldown: true });
    setPendingFormValues(null);
  };

  const handleCancelCooldown = () => {
    setShowCooldownModal(false);
    setCooldownMessage("");
  };

  useModalEscape(handleCancelBlacklisted, showBlacklistModal && !createMutation.isPending);
  useModalEscape(handleCancelCooldown, showCooldownModal && !createMutation.isPending);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/applications" className="text-sm font-medium text-primary hover:underline">
          ← Kembali ke pipeline
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Tambah Lamaran & Rekomendasi AI</h1>
        <p className="mt-1 text-sm text-gray-500">
          Pusat sourcing: pilih posisi, tentukan PIC pewawancara dari sisi klien, lalu gunakan AI untuk
          merekomendasikan kandidat yang paling cocok.
        </p>
      </div>

      {/* ── Pusat Sourcing & Rekomendasi AI (TASK-21.1) ──────────────────── */}
      <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900">Pusat Sourcing</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Posisi yang Dilamar — Autocomplete */}
          <div className="relative" ref={positionRef}>
            <label htmlFor="sourcing_position_id" className="mb-1 block text-sm font-medium text-gray-700">
              Posisi yang Dilamar <span className="text-red-500">*</span>
            </label>
            <input
              id="sourcing_position_id"
              type="text"
              value={positionSearch}
              onChange={(e) => {
                setPositionSearch(e.target.value);
                setShowPositionDropdown(true);
                if (e.target.value.length < 2) {
                  setSelectedPosition(null);
                  setValue("position_id", "");
                  setClientUserName("");
                  setValue("client_user_name", "");
                }
              }}
              onFocus={() => setShowPositionDropdown(true)}
              placeholder="Cari posisi yang dilamar..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {showPositionDropdown && filteredPositions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                {filteredPositions.map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => handleSelectPosition(pos)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <p className="font-medium text-gray-900">{pos.title}</p>
                    <p className="text-xs text-gray-500">{pos.client_name || "-"}</p>
                  </button>
                ))}
              </div>
            )}
            {showPositionDropdown && filteredPositions.length === 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-3 text-center text-sm text-gray-500">
                {loadingPositions ? "Memuat posisi..." : "Tidak ditemukan"}
              </div>
            )}
          </div>

          {/* Sumber Kandidat */}
          <div>
            <label htmlFor="sourcing_candidate_source" className="mb-1 block text-sm font-medium text-gray-700">
              Sumber Kandidat
            </label>
            <select
              id="sourcing_candidate_source"
              value={candidateSource}
              onChange={(e) => setCandidateSource(e.target.value as CandidateSource)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="all">Semua (Talent Pool + Database)</option>
              <option value="talent_pool">Talent Pool</option>
              <option value="database">Database</option>
            </select>
          </div>
        </div>

        {selectedPosition && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm">
            <p className="font-medium text-blue-900">{selectedPosition.title}</p>
            <p className="text-blue-700 text-xs mt-1">
              Client: {selectedPosition.client_name || "-"}
              {selectedPosition.location ? ` • Lokasi: ${selectedPosition.location}` : ""}
              {selectedPosition.salary_budget != null
                ? ` • Budget: Rp ${Number(selectedPosition.salary_budget).toLocaleString("id-ID")}`
                : ""}
            </p>
            {clientUserOptions.length > 0 && (
              <p className="text-blue-700 text-xs mt-1">
                PIC Klien: {clientUserOptions.join(", ")}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleRecommend}
            disabled={!selectedPosition || recommendMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
          >
            {recommendMutation.isPending ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Mencari Rekomendasi...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Cari & Rekomendasikan Kandidat
              </>
            )}
          </button>
        </div>

        {/* Hasil Rekomendasi AI — tabel interaktif (TASK-21.2) */}
        {(recommendations.length > 0 || recommendMessage) && (
          <div className="space-y-4 border-t border-gray-200 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900">
                Hasil Rekomendasi AI
                {recommendations.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({recommendations.length} kandidat)
                  </span>
                )}
              </h3>
              {recommendMessage && <p className="text-sm text-gray-500">{recommendMessage}</p>}
            </div>

            {recommendations.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                Tidak ada kandidat yang direkomendasikan. Coba ubah filter sumber kandidat atau posisi.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                      <tr>
                        <th className="w-10 px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={allRecommendationsSelected}
                            onChange={toggleSelectAllRecommendations}
                            aria-label="Pilih Semua Rekomendasi"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                        <th className="px-3 py-2.5 text-left font-medium">Kandidat</th>
                        <th className="px-3 py-2.5 text-left font-medium">
                          <span title="Skor kecocokan profil awal berdasarkan skill, pengalaman, domisili, dan ekspektasi gaji">
                            Skor Kecocokan
                          </span>
                        </th>
                        <th className="px-3 py-2.5 text-left font-medium">Ringkasan Kecocokan AI</th>
                        <th className="px-3 py-2.5 text-left font-medium">Status Pool Asal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recommendations.map((rec) => (
                        <tr key={rec.candidate_id} className="hover:bg-gray-50">
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedRecommendIds.has(rec.candidate_id)}
                              onChange={() => toggleRecommend(rec.candidate_id)}
                              aria-label={`Pilih ${rec.full_name}`}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-gray-900">{rec.full_name}</p>
                            <p className="text-xs text-gray-500">
                              {rec.domicile ?? "Domisili belum diisi"} • {rec.experience_years ?? 0} tahun
                              • {rec.skills?.length ? rec.skills.slice(0, 4).join(", ") : "Skill belum diisi"}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            {rec.ai_score == null ? (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                                —
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  rec.ai_score >= 80
                                    ? "bg-green-100 text-green-700"
                                    : rec.ai_score >= 60
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-red-100 text-red-700"
                                }`}
                              >
                                {rec.ai_score}%
                              </span>
                            )}
                          </td>
                          <td className="max-w-md px-3 py-3 text-gray-600">
                            {rec.ai_notes || "Tidak ada ringkasan dari AI."}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                rec.pool_status === "talent_pool"
                                  ? "bg-violet-100 text-violet-700"
                                  : rec.pool_status === "future_lead"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {POOL_STATUS_LABELS[rec.pool_status] ?? rec.pool_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-600">
                    {selectedRecommendIds.size} dari {recommendations.length} kandidat dipilih
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    {canToggleAIScreening && (
                      <label className="flex items-start gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={runAIScreening}
                          onChange={(e) => setRunAIScreening(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span>
                          <span className="font-medium text-gray-900">Jalankan AI Screening</span>
                          <span className="block text-xs text-gray-500">
                            Hitung skor kecocokan CV di latar belakang.
                          </span>
                        </span>
                      </label>
                    )}

                    <button
                      type="button"
                      onClick={handleInsertToPipeline}
                      disabled={selectedRecommendIds.size === 0 || bulkAssignMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
                    >
                      {bulkAssignMutation.isPending ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Memproses...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          Masukkan Kandidat Terpilih ke Pipeline Lamaran
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Upload CV untuk AI Screening ────────────────────────────── */}
      {false && canToggleAIScreening && (
      <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
          </svg>
          <h3 className="text-lg font-semibold text-violet-900">Upload CV untuk AI Screening</h3>
        </div>
        <p className="text-sm text-gray-600">
          Sebagai tambahan dari form lamaran di atas, silakan upload CV (PDF) untuk screening otomatis oleh AI.
          Hasil screening akan muncul di halaman{" "}
          <Link href="/applications/pending-review" className="text-blue-600 hover:underline font-medium">
            Pending Review
          </Link>
          . Upload bisa membantu mempercepat proses rekrutmen dan memberikan insight awal tentang kecocokan kandidat.
        </p>
        {/* Pilih posisi untuk upload */}
        <div className="relative" ref={uploadPositionRef}>
          <label htmlFor="upload_position_id" className="mb-1 block text-sm font-medium text-gray-700">
            Posisi untuk Screening CV <span className="text-red-500">*</span>
          </label>
          <input
            id="upload_position_id"
            type="text"
            value={uploadPositionSearch}
            onChange={(e) => {
              setUploadPositionSearch(e.target.value);
              setShowUploadPositionDropdown(true);
              if (e.target.value.length < 2) setSelectedUploadPosition(null);
            }}
            onFocus={() => setShowUploadPositionDropdown(true)}
            placeholder="Ketik nama posisi..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          />
          {showUploadPositionDropdown && uploadPositions.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
              {uploadPositions.map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => {
                    setSelectedUploadPosition(pos);
                    setUploadPositionSearch(pos.title);
                    setShowUploadPositionDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  <p className="font-medium text-gray-900">{pos.title}</p>
                  <p className="text-xs text-gray-500">{pos.client_name || "-"}</p>
                </button>
              ))}
            </div>
          )}
          {showUploadPositionDropdown && uploadPositions.length === 0 && uploadPositionSearch.length >= 2 && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-3 text-center text-sm text-gray-500">
              Tidak ditemukan
            </div>
          )}
        </div>

        {selectedUploadPosition && (
          <div className="rounded-lg bg-violet-50 border border-violet-200 px-4 py-3 text-sm">
            <p className="font-medium text-violet-900">{selectedUploadPosition?.title}</p>
            <p className="text-violet-700 text-xs mt-1">Client: {selectedUploadPosition?.client_name || "-"}</p>
          </div>
        )}

        {/* Pilih sumber */}
        <div className="relative">
          <label className="mb-1 block text-sm font-medium text-gray-700">Sumber</label>
          <select
            value={uploadSourceChannel}
            onChange={(e) => setUploadSourceChannel(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          >
            <option value="">Pilih sumber</option>
            {sourceChannels.map((ch) => (
              <option key={ch.id} value={ch.label}>{ch.label}</option>
            ))}
          </select>
        </div>

        {/* Upload Success Result Card */}
        {lastUploadResult && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="font-semibold text-green-900">Upload Berhasil!</h4>
            </div>
            <div className="text-sm text-green-800 space-y-1">
              <p>
                <span className="font-medium">{lastUploadResult?.total_files} CV</span> untuk posisi{" "}
                <span className="font-medium">{lastUploadResult?.position_title || (lastUploadResult?.created_screening_result_ids?.length ?? 0) + " kandidat"}</span>
                {lastUploadResult?.client_name && ` (Client: ${lastUploadResult?.client_name})`}
              </p>
              <p className="text-xs text-green-700">
                ✅ CV berhasil diproses. Silakan buka <strong>Pending Review</strong> untuk melihat hasil screening AI.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <Link
                href="/applications/pending-review"
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Lihat Pending Review
              </Link>
              <button
                type="button"
                onClick={() => {
                  setLastUploadResult(null);
                  setSelectedUploadPosition(null);
                  setUploadPositionSearch("");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Upload CV Lain
              </button>
            </div>
          </div>
        )}

        {/* Drag & drop zone */}
        {!lastUploadResult && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => cvFileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                isDragging
                  ? "border-violet-500 bg-violet-50"
                  : "border-gray-300 bg-gray-50 hover:border-violet-400 hover:bg-violet-50"
              }`}
            >
              <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3M3 17a4 4 0 008 0h1a5 5 0 000-10h-.5A5.5 5.5 0 003 12v5z" />
              </svg>
              <p className="mt-3 text-sm font-medium text-gray-700">
                Drag & drop file CV di sini, atau klik untuk memilih
              </p>
              <p className="mt-1 text-xs text-gray-500">PDF atau DOCX • Maks. 50 file • Maks. 5 MB per file</p>
              <input
                ref={cvFileInputRef}
                type="file"
                accept=".pdf,.docx"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>

            {/* File list */}
            {cvFiles.length > 0 && (
              <ul className="space-y-2">
                {cvFiles.map((file, idx) => (
                  <li key={`${file.name}-${idx}`} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <svg
                        className={`h-4 w-4 shrink-0 ${file.name.toLowerCase().endsWith(".docx") ? "text-blue-500" : "text-red-500"}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                      <span className="truncate font-medium text-gray-800">{file.name}</span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCvFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="ml-3 shrink-0 text-gray-400 hover:text-red-500"
                      title="Hapus"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-sm text-gray-500">
                {cvFiles.length > 0
                  ? `${cvFiles.length} / ${BULK_CV_MAX_FILES} file dipilih`
                  : "Belum ada file dipilih"}
              </span>
              <button
                type="button"
                onClick={handleBulkUpload}
                disabled={bulkUploadMutation.isPending || cvFiles.length === 0 || !selectedUploadPosition}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                {bulkUploadMutation.isPending ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Mengupload...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload & Kirim ke AI
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
      )}

      {/* ── Divider: Tambah Lamaran Manual ───────────────────────────────── */}
      <div className="relative flex items-center gap-4">
        <div className="flex-1 border-t border-gray-200" />
        <span className="shrink-0 rounded-full border border-gray-200 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Atau tambah lamaran manual
        </span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-16">
        {/* Candidate Selection */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Pilih Kandidat</h2>
          <p className="text-xs text-gray-500">
            Ketik nama kandidat lalu pilih dari daftar untuk menambahkan. Bisa pilih banyak kandidat sekaligus — semua akan didaftarkan ke posisi yang sama.
          </p>

          <div className="relative" ref={candidateRef}>
            {/* Tag chips + input */}
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nama Kandidat <span className="text-red-500">*</span>
            </label>
            <div
              className="flex min-h-[42px] flex-wrap gap-2 rounded-lg border border-gray-300 px-3 py-2 cursor-text focus-within:border-primary"
              onClick={() => manualCandidateInputRef.current?.focus()}
            >
              {selectedCandidates.map((candidate) => (
                <span
                  key={candidate.id}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    candidate.is_blacklisted
                      ? "bg-amber-100 text-amber-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {candidate.is_blacklisted && <span title="Blacklist">⚠</span>}
                  {candidate.full_name}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
                      // Sync candidate_id ke kandidat pertama yang tersisa
                      const remaining = selectedCandidates.filter((c) => c.id !== candidate.id);
                      if (remaining.length > 0) {
                        setSelectedCandidate(remaining[0]);
                        setValue("candidate_id", remaining[0].id);
                      } else {
                        setSelectedCandidate(null);
                        setValue("candidate_id", "");
                      }
                    }}
                    className="ml-0.5 text-blue-600 hover:text-blue-900"
                    aria-label={`Hapus ${candidate.full_name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                ref={manualCandidateInputRef}
                type="text"
                value={candidateSearch}
                onChange={(e) => {
                  setCandidateSearch(e.target.value);
                  setShowCandidateDropdown(true);
                  if (e.target.value.length < 2) setShowCandidateDropdown(false);
                }}
                onFocus={() => { if (candidateSearch.length >= 2) setShowCandidateDropdown(true); }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && candidateSearch === "" && selectedCandidates.length > 0) {
                    // Hapus kandidat terakhir
                    setSelectedCandidates((prev) => prev.slice(0, -1));
                    const remaining = selectedCandidates.slice(0, -1);
                    if (remaining.length > 0) {
                      setSelectedCandidate(remaining[remaining.length - 1]);
                      setValue("candidate_id", remaining[remaining.length - 1].id);
                    } else {
                      setSelectedCandidate(null);
                      setValue("candidate_id", "");
                    }
                  }
                }}
                placeholder={selectedCandidates.length === 0 ? "Ketik nama kandidat..." : "Tambah kandidat lain..."}
                className="flex-1 min-w-[150px] border-none bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
            </div>
            {errors.candidate_id && (
              <p className="mt-1 text-xs text-red-600">{errors.candidate_id.message}</p>
            )}

            {showCandidateDropdown && candidates.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                {candidates.map((candidate) => {
                  const alreadyAdded = selectedCandidates.some((c) => c.id === candidate.id);
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => !alreadyAdded && handleSelectCandidate(candidate)}
                      disabled={alreadyAdded}
                      className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 last:border-0 flex items-center gap-3 ${
                        alreadyAdded
                          ? "bg-gray-50 cursor-default opacity-60"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{candidate.full_name}</p>
                        <p className="text-xs text-gray-500">
                          {candidate.email || candidate.phone || "-"}
                        </p>
                      </div>
                      {alreadyAdded && (
                        <span className="shrink-0 text-xs text-green-600 font-medium">✓ Ditambahkan</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {showCandidateDropdown && candidates.length === 0 && candidateSearch.length >= 2 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-3 text-center text-sm text-gray-500">
                Tidak ditemukan
              </div>
            )}
          </div>

          {/* Info summary kandidat terpilih */}
          {selectedCandidates.length > 0 && (
            <div className="space-y-2">
              {selectedCandidates.length === 1 && (
                <div className={`rounded-lg px-4 py-3 text-sm border ${selectedCandidates[0].is_blacklisted ? "bg-amber-50 border-amber-300" : "bg-blue-50 border-blue-200"}`}>
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${selectedCandidates[0].is_blacklisted ? "text-amber-900" : "text-blue-900"}`}>
                      {selectedCandidates[0].full_name}
                    </p>
                    {selectedCandidates[0].is_blacklisted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        ⚠ Blacklist
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${selectedCandidates[0].is_blacklisted ? "text-amber-700" : "text-blue-700"}`}>
                    {selectedCandidates[0].email && `Email: ${selectedCandidates[0].email}  •  `}
                    {selectedCandidates[0].phone && `HP: ${selectedCandidates[0].phone}`}
                  </p>
                  {selectedCandidates[0].is_blacklisted && (
                    <p className="mt-1.5 text-xs text-amber-800 font-medium">
                      Kandidat ini terdaftar dalam blacklist. Anda masih dapat melanjutkan, namun konfirmasi diperlukan.
                    </p>
                  )}
                </div>
              )}
              {selectedCandidates.length > 1 && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm">
                  <p className="font-medium text-blue-900">
                    {selectedCandidates.length} kandidat dipilih
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Semua kandidat akan didaftarkan ke posisi yang sama sekaligus.
                    {selectedCandidates.some((c) => c.is_blacklisted) && (
                      <span className="ml-1 font-medium text-amber-700">
                        ⚠ Beberapa kandidat dalam blacklist — akan diproses dengan force.
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Posisi Lamaran — memakai pilihan dari Pusat Sourcing di atas */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Posisi Lamaran</h2>

          {selectedPosition ? (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm">
              <p className="font-medium text-blue-900">{selectedPosition.title}</p>
              <p className="text-blue-700 text-xs mt-1">
                Client: {selectedPosition.client_name || "-"}  •  {selectedPosition.employment_type || "Full-time"}
              </p>
              {clientUserOptions.length > 0 && (
                <p className="text-blue-700 text-xs mt-1">
                  PIC Klien: {clientUserOptions.join(", ")}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
              Belum ada posisi dipilih. Tentukan &quot;Posisi yang Dilamar&quot; pada Pusat Sourcing di atas.
            </p>
          )}
          {errors.position_id && (
            <p className="mt-1 text-xs text-red-600">{errors.position_id.message}</p>
          )}
        </div>

        {/* Recruiter */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Recruiter</h2>
          <p className="text-sm text-gray-500">
            Recruiter akan diisi otomatis dengan user saat ini.
          </p>
          <input type="hidden" {...register("recruiter_id")} />
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
            {currentUser?.name || "-"} ({currentUser?.email || "-"})
          </div>
        </div>

        {/* Stage (hidden, default value) */}
        <input type="hidden" {...register("current_stage")} />

        <div className="flex justify-end gap-3">
          <Link
            href="/applications"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending || bulkAssignMutation.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isSubmitting || createMutation.isPending || bulkAssignMutation.isPending ? "Menyimpan..." : selectedCandidates.length > 1 ? `Simpan ${selectedCandidates.length} Lamaran` : "Simpan Lamaran"}
          </button>
        </div>
      </form>

      {/* ── Blacklist Confirmation Modal ──────────────────────────────────────── */}
      {showBlacklistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-amber-200 p-6 space-y-4 mx-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 rounded-full bg-amber-100 p-2">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Kandidat Dalam Blacklist</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Kandidat <span className="font-semibold text-amber-800">{selectedCandidate?.full_name}</span> saat ini terdaftar dalam daftar blacklist.
                </p>
                <p className="mt-2 text-sm text-gray-700">
                  Apakah Anda yakin ingin tetap melanjutkan proses Application untuk kandidat ini?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelBlacklisted}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBlacklisted}
                disabled={createMutation.isPending}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {createMutation.isPending ? "Menyimpan..." : "Ya, Lanjutkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cooldown Confirmation Modal ──────────────────────────────────────── */}
      {showCooldownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-orange-200 p-6 space-y-4 mx-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 rounded-full bg-orange-100 p-2">
                <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Masa Tunggu (Cooldown) Belum Selesai</h3>
                <p className="mt-1 text-sm text-gray-600">{cooldownMessage}</p>
                <p className="mt-2 text-sm text-gray-700">
                  Apakah Anda yakin ingin tetap melanjutkan dan mengabaikan masa tunggu ini?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelCooldown}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmCooldown}
                disabled={createMutation.isPending}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {createMutation.isPending ? "Menyimpan..." : "Ya, Tetap Proses"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
