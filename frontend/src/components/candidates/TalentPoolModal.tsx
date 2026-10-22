"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Users } from "lucide-react";
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
  { value: "gaji_tidak_sesuai", label: "Gaji Tidak Sesuai" },
  { value: "kebutuhan_masa_depan", label: "Kebutuhan Masa Depan" },
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

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      {/* Panel — stop click propagation so backdrop click doesn't bubble */}
      <div
        className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          aria-label="Tutup modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
            <Users className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Pindahkan ke Talent Pool</h2>
            <p className="text-sm text-gray-500">{candidateName}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          {/* Reason radio group */}
          <fieldset className="mb-4">
            <legend className="mb-2 block text-sm font-medium text-gray-700">
              Alasan <span className="text-red-500">*</span>
            </legend>
            <div className="space-y-2">
              {REASON_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50"
                >
                  <input
                    type="radio"
                    value={value}
                    {...register("reason")}
                    className="h-4 w-4 accent-emerald-600 cursor-pointer"
                  />
                  <span className="font-medium text-gray-800">{label}</span>
                </label>
              ))}
            </div>
            {errors.reason && (
              <p className="mt-1.5 text-xs text-red-600">{errors.reason.message}</p>
            )}
          </fieldset>

          {/* Notes textarea */}
          <div className="mb-6">
            <label htmlFor="talent-pool-notes" className="mb-1.5 block text-sm font-medium text-gray-700">
              Catatan tambahan{" "}
              <span className="text-xs font-normal text-gray-400">(opsional)</span>
            </label>
            <textarea
              id="talent-pool-notes"
              {...register("notes")}
              rows={3}
              placeholder="Tambahkan catatan untuk kandidat ini..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 resize-none"
            />
          </div>

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
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Memproses...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" />
                  Pindahkan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
