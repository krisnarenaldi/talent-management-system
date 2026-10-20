"use client";

import Link from "next/link";

interface DuplicateWarningBannerProps {
  candidateId: string;
  onDismiss: () => void;
}

export default function DuplicateWarningBanner({
  candidateId,
  onDismiss,
}: DuplicateWarningBannerProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-yellow-500 text-base leading-none">⚠️</span>
        <div>
          <p className="text-sm font-semibold text-yellow-800">Kemungkinan kandidat duplikat terdeteksi</p>
          <p className="mt-0.5 text-sm text-yellow-700">
            Sistem menemukan kandidat yang mungkin sudah ada di database.{" "}
            <Link
              href={`/candidates/${candidateId}`}
              className="font-medium underline hover:text-yellow-900"
            >
              Lihat Kandidat Ini
            </Link>{" "}
            untuk memverifikasi.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Tutup peringatan"
        className="shrink-0 text-yellow-500 hover:text-yellow-700"
      >
        ✕
      </button>
    </div>
  );
}
