"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useModalEscape } from "@/hooks/useModalEscape";
import { Users } from "lucide-react";
import { useToastStore } from "@/stores/toast.store";
import api from "@/lib/api";

// ── Schema ────────────────────────────────────────────────────────────────────

const talentPoolSchema = z.object({
  reason: z.enum(["gaji_tidak_sesuai", "kebutuhan_masa_depan", "lainnya"], {
    required_error: "Pilih alasan pemindahan ke Talent Pool",
  }),
  notes: z.string().optional(),
});

type TalentPoolFormValues = z.infer<typeof talentPoolSchema>;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TalentPoolModalProps {
  candidateId: string;
  candidateName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const REASON_OPTIONS: Array<{ value: TalentPoolFormValues["reason"]; label: string }> = [
  { value: "gaji_tidak_sesuai", label: "Gaji tidak sesuai" },
  { value: "kebutuhan_masa_depan", label: "Kebutuhan masa depan" },
  { value: "lainnya", label: "Lainnya" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TalentPoolModal({
  candidateId,
  candidateName,
  isOpen,
  onClose,
  onSuccess,
}: TalentPoolModalProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToastStore();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TalentPoolFormValues>({
    resolver: zodResolver(talentPoolSchema),
    defaultValues: {
      reason: "gaji_tidak_sesuai",
      notes: "",
    },
  });

  // Reset form whenever modal opens
  useEffect(() => {
    if (isOpen) {
      reset({ reason: "gaji_tidak_sesuai", notes: "" });
    }
  }, [isOpen, reset]);

  const mutation = useMutation({
    mutationFn: async (values: TalentPoolFormValues) => {
      const response = await api.patch(
        `/api/v1/candidates/${candidateId}/talent-pool`,
        {
          pool_status: "talent_pool",
          talent_pool_reason: values.reason,
          talent_pool_notes: values.notes || undefined,
        },
      );
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all candidate-related queries so callers get fresh data
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
      showToast("success", `${candidateName} berhasil dipindahkan ke Talent Pool`);
      onSuccess();
      onClose();
    },
    onError: (error: unknown) => {
      const apiError = error as { response?: { data?: { detail?: string } } };
      showToast(
        "error",
        apiError.response?.data?.detail ?? "Gagal memindahkan kandidat ke Talent Pool",
      );
    },
  });

  // Close modal on Escape key
  useModalEscape(onClose, isOpen && !mutation.isPending);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
          aria-label="Tutup modal"
        >
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
            <Users className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-on-surface">Pindahkan ke Talent Pool</h2>
            <p className="text-sm text-on-surface-variant">1 kandidat akan dipindahkan ke Talent Pool.</p>
            <p className="text-sm font-medium text-on-surface mt-1">{candidateName}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <div className="mb-4">
            <label className="block text-label-md text-on-surface mb-1.5">
              Alasan <span className="text-error">*</span>
            </label>
            <select
              {...register("reason")}
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              {REASON_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.reason && (
              <p className="text-error text-xs mt-1">{errors.reason.message}</p>
            )}
          </div>

          {/* Notes textarea */}
          <div className="mb-6">
            <label htmlFor="talent-pool-notes" className="block text-label-md text-on-surface mb-1.5">
              Catatan (opsional)
            </label>
            <textarea
              id="talent-pool-notes"
              {...register("notes")}
              rows={3}
              placeholder="Tambahkan catatan..."
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface rounded-lg font-medium hover:bg-surface-container-highest transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-wait"
            >
              {mutation.isPending ? (
                <span className="material-symbols-outlined text-lg animate-spin">
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined text-lg">check</span>
              )}
              Konfirmasi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
