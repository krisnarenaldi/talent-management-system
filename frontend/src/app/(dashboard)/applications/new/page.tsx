"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import { settingsApi } from "@/lib/api/settings";
import { useToastStore } from "@/stores/toast.store";
import { useAuthStore } from "@/stores/auth.store";
import { getErrorMessage } from "@/lib/errors";
import type { Candidate, Position, SourceChannel } from "@/types";

const formSchema = z.object({
  candidate_id: z.string().min(1, "Pilih kandidat terlebih dahulu"),
  position_id: z.string().min(1, "Pilih posisi terlebih dahulu"),
  recruiter_id: z.string().optional(),
  current_stage: z.string().default("Dijadwalkan_Interview"),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewApplicationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const currentUser = useAuthStore((state) => state.user);

  const [candidateSearch, setCandidateSearch] = useState("");
  const [showCandidateDropdown, setShowCandidateDropdown] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [pendingFormValues, setPendingFormValues] = useState<FormValues | null>(null);

  const [positionSearch, setPositionSearch] = useState("");
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

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

  const { data: positions = [] } = useQuery({
    queryKey: ["positions-search", positionSearch],
    queryFn: async () => {
      if (!positionSearch.trim()) return [];
      const response = await api.get("/api/v1/positions", {
        params: { search: positionSearch, is_active: true },
      });
      return response.data as Position[];
    },
    enabled: positionSearch.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

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
      queryClient.invalidateQueries({ queryKey: ["pending-review"] });
      const msg = `${data.total_files} CV berhasil diupload. Proses AI screening berjalan di background — notifikasi akan muncul saat selesai.`;
      showToast("success", msg);
      setLastUploadResult(data);
      setCvFiles([]);
    },
    onError: (err) => {
      showToast("error", getErrorMessage(err, "Gagal upload CV."));
    },
  });

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const pdfs = Array.from(incoming).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    const skipped = Array.from(incoming).length - pdfs.length;
    if (skipped > 0) showToast("error", `${skipped} file diabaikan — hanya PDF yang diizinkan.`);
    setCvFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...pdfs.filter((f) => !existing.has(f.name + f.size))];
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
    bulkUploadMutation.mutate({ positionId: selectedUploadPosition.id, files: cvFiles, sourceChannel: uploadSourceChannel });
  };

  const createMutation = useMutation({
    mutationFn: (payload: FormValues & { force_blacklisted?: boolean }) =>
      api.post("/api/v1/applications", payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      showToast("success", "Lamaran berhasil dibuat.");
      router.push(`/applications/${response.data.id}`);
    },
    onError: (err) => {
      showToast("error", getErrorMessage(err, "Gagal membuat lamaran."));
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
  };

  const handleSelectPosition = (position: Position) => {
    setSelectedPosition(position);
    setValue("position_id", position.id);
    setPositionSearch(position.title);
    setShowPositionDropdown(false);
  };

  const onSubmit = (values: FormValues) => {
    if (selectedCandidate?.is_blacklisted) {
      setPendingFormValues(values);
      setShowBlacklistModal(true);
      showToast("warning", `Peringatan: Kandidat ${selectedCandidate.full_name} sedang dalam daftar blacklist.`);
      return;
    }
    createMutation.mutate(values);
  };

  const handleConfirmBlacklisted = () => {
    if (!pendingFormValues) return;
    setShowBlacklistModal(false);
    createMutation.mutate({ ...pendingFormValues, force_blacklisted: true });
    setPendingFormValues(null);
  };

  const handleCancelBlacklisted = () => {
    setShowBlacklistModal(false);
    setPendingFormValues(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/applications" className="text-sm font-medium text-primary-600 hover:underline">
          ← Kembali ke pipeline
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Tambah Lamaran</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-16">
        {/* Candidate Selection */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Pilih Kandidat</h2>

          <div className="relative" ref={candidateRef}>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nama Kandidat <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={candidateSearch}
              onChange={(e) => {
                setCandidateSearch(e.target.value);
                setShowCandidateDropdown(true);
                if (e.target.value.length < 2) setSelectedCandidate(null);
              }}
              onFocus={() => setShowCandidateDropdown(true)}
              placeholder="Ketik nama kandidat..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
            {errors.candidate_id && (
              <p className="mt-1 text-xs text-red-600">{errors.candidate_id.message}</p>
            )}

            {showCandidateDropdown && candidates.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => handleSelectCandidate(candidate)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center gap-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{candidate.full_name}</p>
                      <p className="text-xs text-gray-500">
                        {candidate.email || candidate.phone || "-"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showCandidateDropdown && candidates.length === 0 && candidateSearch.length >= 2 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-3 text-center text-sm text-gray-500">
                Tidak ditemukan
              </div>
            )}
          </div>

          {selectedCandidate && (
            <div className={`rounded-lg px-4 py-3 text-sm border ${selectedCandidate.is_blacklisted ? "bg-amber-50 border-amber-300" : "bg-blue-50 border-blue-200"}`}>
              <div className="flex items-center gap-2">
                <p className={`font-medium ${selectedCandidate.is_blacklisted ? "text-amber-900" : "text-blue-900"}`}>
                  {selectedCandidate.full_name}
                </p>
                {selectedCandidate.is_blacklisted && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    ⚠ Blacklist
                  </span>
                )}
              </div>
              <p className={`text-xs mt-1 ${selectedCandidate.is_blacklisted ? "text-amber-700" : "text-blue-700"}`}>
                {selectedCandidate.email && `Email: ${selectedCandidate.email}  •  `}
                {selectedCandidate.phone && `HP: ${selectedCandidate.phone}`}
              </p>
              {selectedCandidate.is_blacklisted && (
                <p className="mt-1.5 text-xs text-amber-800 font-medium">
                  Kandidat ini terdaftar dalam blacklist. Anda masih dapat melanjutkan proses lamaran, namun konfirmasi diperlukan.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Position Selection */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Pilih Posisi</h2>

          <div className="relative" ref={positionRef}>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Judul Posisi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={positionSearch}
              onChange={(e) => {
                setPositionSearch(e.target.value);
                setShowPositionDropdown(true);
                if (e.target.value.length < 2) setSelectedPosition(null);
              }}
              onFocus={() => setShowPositionDropdown(true)}
              placeholder="Ketik judul posisi..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
            {errors.position_id && (
              <p className="mt-1 text-xs text-red-600">{errors.position_id.message}</p>
            )}

            {showPositionDropdown && positions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                {positions.map((pos) => (
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

            {showPositionDropdown && positions.length === 0 && positionSearch.length >= 2 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-3 text-center text-sm text-gray-500">
                Tidak ditemukan
              </div>
            )}
          </div>

          {selectedPosition && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm">
              <p className="font-medium text-blue-900">{selectedPosition.title}</p>
              <p className="text-blue-700 text-xs mt-1">
                Client: {selectedPosition.client_name || "-"}  •  {selectedPosition.employment_type || "Full-time"}
              </p>
            </div>
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
            disabled={isSubmitting || createMutation.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {createMutation.isPending ? "Menyimpan..." : "Simpan Lamaran"}
          </button>
        </div>
      </form>

      {/* ── Blacklist Confirmation Modal ─────────────────────────────────────── */}
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

      {/* ── Upload CV untuk AI Screening (Langkah Tambahan) ────────────────────────────── */}
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
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Posisi yang Dilamar <span className="text-red-500">*</span>
          </label>
          <input
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
            <p className="font-medium text-violet-900">{selectedUploadPosition.title}</p>
            <p className="text-violet-700 text-xs mt-1">Client: {selectedUploadPosition.client_name || "-"}</p>
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
                <span className="font-medium">{lastUploadResult.total_files} CV</span> untuk posisi{" "}
                <span className="font-medium">{lastUploadResult.position_title || lastUploadResult.created_screening_result_ids.length + " kandidat"}</span>
                {lastUploadResult.client_name && ` (Client: ${lastUploadResult.client_name})`}
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
                Drag & drop file PDF di sini, atau klik untuk memilih
              </p>
              <p className="mt-1 text-xs text-gray-500">Hanya PDF • Bisa pilih beberapa file sekaligus</p>
              <input
                ref={cvFileInputRef}
                type="file"
                accept=".pdf"
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
                      <svg className="h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
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
                {cvFiles.length > 0 ? `${cvFiles.length} file dipilih` : "Belum ada file dipilih"}
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
    </div>
  );
}
