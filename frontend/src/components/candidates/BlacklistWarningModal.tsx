"use client";

interface BlacklistWarningModalProps {
  isOpen: boolean;
  candidateId: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function BlacklistWarningModal({
  isOpen,
  candidateId: _candidateId,
  onConfirm,
  onClose,
}: BlacklistWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="blacklist-modal-title"
    >
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        {/* Icon */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <span className="text-2xl" aria-hidden="true">🚫</span>
        </div>

        {/* Title */}
        <h2
          id="blacklist-modal-title"
          className="mb-2 text-lg font-bold text-gray-900"
        >
          Kandidat Terdeteksi Blacklist
        </h2>

        {/* Body */}
        <p className="mb-6 text-sm text-gray-600">
          Kandidat yang baru dibuat memiliki status <strong>blacklist aktif</strong>. Disarankan untuk
          melakukan review manual sebelum melanjutkan proses seleksi.
        </p>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Batal / Kembali
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          >
            Tetap Lanjut ke Detail
          </button>
        </div>
      </div>
    </div>
  );
}
