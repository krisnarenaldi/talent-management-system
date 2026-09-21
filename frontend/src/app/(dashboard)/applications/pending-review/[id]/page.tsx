"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import type { AIScreeningResult } from "@/types";
import AIExtractionReview from "@/components/AIExtractionReview";

export default function PendingReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [screening, setScreening] = useState<AIScreeningResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/api/v1/applications/screening/${params.id}`)
      .then((res) => setScreening(res.data))
      .catch((err) => setError(err.response?.data?.detail || "Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="p-8 text-center">Memuat data...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!screening) return <div className="p-8 text-center">Data tidak ditemukan</div>;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
        <Link href="/applications/pending-review" className="hover:text-primary">
          Pending Review
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-on-surface font-medium truncate">{screening.cv_file_url?.split("/").pop()?.replace(/_/g, " ") || screening.id}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review AI Screening</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {screening.position_title} — {screening.client_name || "-"}
          </p>
        </div>
        <Link
          href="/applications/pending-review"
          className="flex items-center gap-1 text-sm text-primary hover:text-primary-dark"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Kembali
        </Link>
      </div>

      <AIExtractionReview screening={screening} />
    </div>
  );
}
