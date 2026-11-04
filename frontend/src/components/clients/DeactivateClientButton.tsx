"use client";

import { useState } from "react";

import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useModalEscape } from "@/hooks/useModalEscape";
import { useToastStore } from "@/stores/toast.store";

interface DeactivateClientButtonProps {
  client: { id: string; name: string };
  onSuccess?: () => void;
}

/**
 * Tombol danger untuk menon-aktifkan klien. Saat dikonfirmasi, semua posisi
 * milik klien dinonaktifkan dan seluruh lamaran aktif ditolak (bulk-reject)
 * beserta alasan penonaktifan.
 */
export default function DeactivateClientButton({
  client,
  onSuccess,
}: DeactivateClientButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  const openModal = () => {
    setReason("");
    setError(null);
    setOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setOpen(false);
  };

  useModalEscape(closeModal, open && !submitting);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError("Alasan penonaktifan klien wajib diisi.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.put(`/api/v1/clients/${client.id}`, {
        is_active: false,
        bulk_reject: true,
        reject_reason: reason.trim(),
      });
      showToast(
        "success",
        "Klien berhasil dinonaktifkan. Semua posisi dan lamaran aktif ditolak.",
      );
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      setError(getErrorMessage(err, "Gagal menonaktifkan klien."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-2 px-4 py-2 bg-error-container hover:bg-error-container/90 text-on-error-container rounded-lg font-medium transition-colors"
      >
        <span className="material-symbols-outlined text-lg">block</span>
        Non-aktifkan Klien
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-2xl text-error">
                warning
              </span>
              <h2 className="text-headline-md font-semibold text-on-surface">
                Konfirmasi Nonaktifkan Klien
              </h2>
            </div>
            <p className="text-body-sm text-on-surface-variant mb-4">
              Klien{" "}
              <span className="font-medium text-on-surface">
                &quot;{client.name}&quot;
              </span>{" "}
              akan dinon-aktifkan. Semua posisi dan lamaran aktif akan otomatis
              ditolak.
            </p>
            <div className="mb-4">
              <label className="block text-label-md text-on-surface mb-1.5">
                Alasan Penonaktifan Klien
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Alasan penonaktifan klien..."
                className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              />
            </div>
            {error && <p className="text-error text-xs mb-4">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface rounded-lg font-medium hover:bg-surface-container-highest transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-error-container hover:bg-error-container/90 text-on-error-container rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-wait"
              >
                {submitting ? (
                  <span className="material-symbols-outlined text-lg animate-spin">
                    progress_activity
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-lg">check</span>
                )}
                Nonaktifkan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
