"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { Application } from "@/types";

async function fetchApplications(params?: Record<string, string | undefined>) {
  const response = await api.get("/api/v1/applications", { params });
  return response.data as Application[];
}

const stageOptions = [
  "Dijadwalkan_Interview",
  "Konfirmasi_Kehadiran",
  "Interview_HR",
  "Psikotest",
  "Interview_User",
  "Offering",
  "Tanda_Tangan_Kontrak",
  "Onboarding",
  "Existing",
  "Rejected",
  "Withdrawn",
];

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "border border-emerald-200 bg-emerald-100 text-emerald-800";
    case "rejected":
      return "border border-red-200 bg-red-100 text-red-800";
    case "hired":
      return "border border-blue-200 bg-blue-100 text-blue-800";
    case "withdrawn":
      return "border border-slate-300 bg-slate-200 text-slate-800";
    default:
      return "border border-slate-200 bg-slate-100 text-slate-800";
  }
}

function stageBadgeClass(stage: string | null | undefined) {
  const normalizedStage = stage ?? "";
  if (normalizedStage.includes("Interview")) return "border border-violet-200 bg-violet-100 text-violet-800";
  if (normalizedStage.includes("Offering") || normalizedStage.includes("Kontrak") || normalizedStage.includes("Onboarding") || normalizedStage === "Existing") {
    return "border border-blue-200 bg-blue-100 text-blue-800";
  }
  if (normalizedStage.includes("Rejected") || normalizedStage.includes("Withdrawn")) return "border border-red-200 bg-red-100 text-red-800";
  return "border border-amber-200 bg-amber-100 text-amber-800";
}

function formatStageLabel(stage: string | null | undefined) {
  const normalizedStage = stage ?? "";
  return normalizedStage
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "-";
}

function normalizeRole(role: string | undefined): string {
  if (!role) return "";
  return role.split(".").pop()?.toLowerCase() || role;
}

export default function ApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const user = useAuthStore((state) => state.user);
  const canCreateApplication = user ? ["admin", "hr", "manager"].includes(normalizeRole(user.role)) : false;

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["applications", { statusFilter, stageFilter, startDate, endDate }],
    queryFn: () =>
      fetchApplications({
        status_filter: statusFilter || undefined,
        current_stage: stageFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">Recruitment pipeline</p>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline Rekrutmen</h1>
        </div>
        {canCreateApplication && (
          <Link
            href="/applications/new"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
          >
            + Tambah Lamaran
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">Semua</option>
              <option value="active">Aktif</option>
              <option value="rejected">Ditolak</option>
              <option value="hired">Diterima</option>
              <option value="withdrawn">Ditarik</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Tahap</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">Semua</option>
              {stageOptions.map((stage) => (
                <option key={stage} value={stage}>
                  {formatStageLabel(stage)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Tanggal mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Tanggal akhir</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Kandidat</th>
                <th className="px-4 py-3">Posisi</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Tahap</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Update</th>
                <th className="px-4 py-3">Recruiter</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                    Memuat data lamaran...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                    Belum ada lamaran.
                  </td>
                </tr>
              ) : (
                applications.map((application) => (
                  <tr key={application.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-gray-900">{application.candidate_name || "-"}</p>
                        <p className="text-xs text-gray-500">{application.candidate?.email || "-"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{application.position_title || "-"}</td>
                    <td className="px-4 py-3 text-gray-700">{application.client_name || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${stageBadgeClass(application.current_stage)}`}>
                        {formatStageLabel(application.current_stage)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(application.status)}`}>
                        {application.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {application.updated_at ? format(new Date(application.updated_at), "dd MMM yyyy", { locale: idLocale }) : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{application.recruiter_name || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/applications/${application.id}`}
                        className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
                      >
                        Lihat detail
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
