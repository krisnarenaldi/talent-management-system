"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Briefcase, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";
import api from "@/lib/api";
import { positionsApi } from "@/lib/api/positions";
import type { Candidate, Position } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BulkAssignModalProps {
  candidateIds: string[];
  candidateNames: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Schema ────────────────────────────────────────────────────────────────────
const bulkAssignSchema = z.object({
  position_id: z.string().uuid("Pilih posisi yang valid"),
  client_user_name: z.string().optional(),
  run_ai_screening: z.boolean().default(false),
});

type BulkAssignFormValues = z.infer<typeof bulkAssignSchema>;

// ── Component ─────────────────────────────────────────────────────────────────
export default function BulkAssignModal({
  candidateIds,
  candidateNames,
  isOpen,
  onClose,
  onSuccess,
}: BulkAssignModalProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToastStore();
  const isRole = useAuthStore((state) => state.isRole);
  const canToggleAIScreening = isRole("admin", "manager");

  // Form
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<BulkAssignFormValues>({
    resolver: zodResolver(bulkAssignSchema),
    defaultValues: {
      position_id: "",
      client_user_name: "",
      run_ai_screening: false,
    },
  });

  const selectedPositionId = watch("position_id");

  // Combobox state for position search
  const [comboQuery, setComboQuery] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  // Close combobox when clicking outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setComboOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Fetch active positions for dropdown
  const { data: positions = [], isLoading: loadingPositions } = useQuery({
    queryKey: ["active-positions"],
    queryFn: positionsApi.listActive,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch selected position details to get client_user_names
  const { data: selectedPosition } = useQuery({
    queryKey: ["position-detail", selectedPositionId],
    queryFn: () => positionsApi.getById(selectedPositionId),
    enabled: !!selectedPositionId,
    staleTime: 5 * 60 * 1000,
  });

  // Reset form when modal opens/closes or candidate list changes
  useEffect(() => {
    if (isOpen) {
      reset({ position_id: "", client_user_name: "", run_ai_screening: false });
      setComboQuery("");
      setComboOpen(false);
    }
  }, [isOpen, reset, candidateIds]);

  // Filtered positions for combobox
  const filteredPositions = positions.filter((pos) => {
    if (!comboQuery) return true;
    const q = comboQuery.toLowerCase();
    return (
      pos.title.toLowerCase().includes(q) ||
      (pos.client_name ?? "").toLowerCase().includes(q)
    );
  });

  // Warn if any selected candidate is blacklisted or in cooldown
  const [warnings, setWarnings] = useState<{
    blacklisted: string[];
    cooldown: string[];
  }>({ blacklisted: [], cooldown: [] });

  // Mutation
  const mutation = useMutation({
    mutationFn: async (values: BulkAssignFormValues) => {
      const payload = {
        candidate_ids: candidateIds,
        position_id: values.position_id,
        client_user_name: values.client_user_name || undefined,
        run_ai_screening: canToggleAIScreening ? values.run_ai_screening : false,
      };
      const res = await api.post("/api/v1/candidates/bulk-assign", payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      showToast("success", `Berhasil assign ${data.assigned_count ?? candidateIds.length} kandidat ke lowongan`);
      onSuccess();
      onClose();
    },
    onError: (error: unknown) => {
      const apiError = error as { response?: { data?: { detail?: string } } };
      showToast("error", apiError.response?.data?.detail ?? "Gagal assign kandidat ke lowongan");
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          disabled={mutation.isPending}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
          aria-label="Tutup modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <Briefcase className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Assign Kandidat ke Lowongan</h2>
            <p className="text-sm text-gray-500">{candidateIds.length} kandidat terpilih</p>
          </div>
        </div>

        {/* Selected candidates list */}
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 max-h-32 overflow-y-auto">
          <p className="mb-2 text-xs font-medium text-gray-600">Kandidat yang akan di-assign:</p>
          <ul className="space-y-1">
            {candidateNames.map((name, idx) => (
              <li key={idx} className="text-sm text-gray-800">
                {idx + 1}. {name}
              </li>
            ))}
            {candidateNames.length > 5 && (
              <li className="text-sm text-gray-500">... dan {candidateNames.length - 5} lainnya</li>
            )}
          </ul>
        </div>

        {/* Warnings */}
        {(warnings.blacklisted.length > 0 || warnings.cooldown.length > 0) && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800 space-y-1">
                {warnings.blacklisted.length > 0 && (
                  <p>
                    <strong>Blacklist:</strong> {warnings.blacklisted.join(", ")} memiliki status blacklist aktif.
                  </p>
                )}
                {warnings.cooldown.length > 0 && (
                  <p>
                    <strong>Cooldown:</strong> {warnings.cooldown.join(", ")} dalam masa cooldown (ditolak kurang dari 6 bulan pada posisi ini).
                  </p>
                )}
                <p>Assign tetap bisa dilanjutkan, namun direkomendasikan review manual.</p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          {/* Position dropdown */}
          <div className="mb-4">
            <label htmlFor="position_id" className="mb-1.5 block text-sm font-medium text-gray-700">
              Posisi / Lowongan Aktif <span className="text-red-500">*</span>
            </label>
            {loadingPositions ? (
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                Memuat daftar posisi...
              </div>
            ) : (
              <div ref={comboRef} className="relative">
                <input
                  id="position_id"
                  type="text"
                  role="combobox"
                  aria-expanded={comboOpen}
                  aria-controls="position-listbox"
                  aria-autocomplete="list"
                  value={comboQuery}
                  onChange={(e) => {
                    setComboQuery(e.target.value);
                    setComboOpen(true);
                    if (!e.target.value) setValue("position_id", "");
                  }}
                  onFocus={() => setComboOpen(true)}
                  placeholder="Cari posisi..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
                {comboOpen && filteredPositions.length > 0 && (
                  <ul
                    id="position-listbox"
                    role="listbox"
                    aria-label="Daftar posisi"
                    className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
                  >
                    {filteredPositions.map((pos) => (
                      <li
                        key={pos.id}
                        role="option"
                        aria-selected={selectedPositionId === pos.id}
                        onMouseDown={(e) => {
                          // Use mousedown to fire before input blur
                          e.preventDefault();
                          setValue("position_id", pos.id);
                          setComboQuery(`${pos.title} — ${pos.client_name}`);
                          setComboOpen(false);
                        }}
                        className={`cursor-pointer px-3 py-2 text-sm hover:bg-blue-50 ${
                          selectedPositionId === pos.id ? "bg-blue-50 font-medium text-blue-700" : "text-gray-800"
                        }`}
                      >
                        {pos.title} — {pos.client_name}
                      </li>
                    ))}
                  </ul>
                )}
                {comboOpen && comboQuery && filteredPositions.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg">
                    Tidak ada posisi yang cocok.
                  </div>
                )}
              </div>
            )}
            {errors.position_id && (
              <p className="mt-1.5 text-xs text-red-600">{errors.position_id.message}</p>
            )}
          </div>

          {/* PIC User Client dropdown (from position.client_user_names) */}
          <div className="mb-4">
            <label htmlFor="client_user_name" className="mb-1.5 block text-sm font-medium text-gray-700">
              PIC User Klien (Pewawancara)
            </label>
            {selectedPosition && selectedPosition.client_user_names && selectedPosition.client_user_names.length > 0 ? (
              <select
                id="client_user_name"
                {...register("client_user_name")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              >
                <option value="">-- Pilih PIC User --</option>
                {selectedPosition.client_user_names.map((name: string, idx: number) => (
                  <option key={idx} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="client_user_name"
                type="text"
                {...register("client_user_name")}
                placeholder="Masukkan nama PIC User (opsional)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            )}
          </div>

          {/* RBAC Toggle AI Screening */}
          {canToggleAIScreening && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
              <input
                type="checkbox"
                id="run_ai_screening"
                {...register("run_ai_screening")}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 accent-violet-600"
              />
              <label htmlFor="run_ai_screening" className="text-sm text-gray-700 cursor-pointer">
                <span className="font-semibold block text-gray-900">Jalankan AI Screening</span>
                <span className="text-xs text-gray-500">
                  AI akan menganalisis kecocokan CV kandidat di latar belakang dan memperbarui skor di pipeline lamaran.
                </span>
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !selectedPositionId}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Assign ke Lowongan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}