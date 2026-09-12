"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import { useToastStore } from "@/stores/toast.store";
import { useAuthStore } from "@/stores/auth.store";
import type { Candidate, Position } from "@/types";

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

  const [positionSearch, setPositionSearch] = useState("");
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  const candidateRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (candidateRef.current && !candidateRef.current.contains(e.target as Node)) {
        setShowCandidateDropdown(false);
      }
      if (positionRef.current && !positionRef.current.contains(e.target as Node)) {
        setShowPositionDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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

  const createMutation = useMutation({
    mutationFn: (payload: FormValues) => api.post("/api/v1/applications", payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      showToast("success", "Lamaran berhasil dibuat.");
      router.push(`/applications/${response.data.id}`);
    },
    onError: (err) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Gagal membuat lamaran.";
      showToast("error", message);
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
    createMutation.mutate(values);
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
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm">
              <p className="font-medium text-blue-900">{selectedCandidate.full_name}</p>
              <p className="text-blue-700 text-xs mt-1">
                {selectedCandidate.email && `Email: ${selectedCandidate.email}  •  `}
                {selectedCandidate.phone && `HP: ${selectedCandidate.phone}`}
              </p>
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
    </div>
  );
}
