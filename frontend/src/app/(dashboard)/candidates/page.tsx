"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Candidate } from "@/types";

async function fetchCandidates(params?: Record<string, string | undefined>) {
  const response = await api.get("/api/v1/candidates", { params });
  return response.data as Candidate[];
}

export default function CandidatesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates", { searchTerm, sourceFilter, statusFilter }],
    queryFn: () =>
      fetchCandidates({
        search: searchTerm || undefined,
        source_channel: sourceFilter || undefined,
        completeness_status: statusFilter || undefined,
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Talent pool</p>
          <h1 className="text-2xl font-bold text-gray-900">Kandidat</h1>
        </div>
        <Link
          href="/candidates/new"
          className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          + Tambah Kandidat
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Cari
            </label>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nama, email, no. HP"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Sumber
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">Semua</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Glints">Glints</option>
              <option value="Email">Email</option>
              <option value="Referral">Referral</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Status kelengkapan
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">Semua</option>
              <option value="lengkap">Lengkap</option>
              <option value="belum_lengkap">Belum lengkap</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">Sumber</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Kelengkapan</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    Memuat data kandidat...
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    Belum ada kandidat.
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => (
                  <tr key={candidate.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-gray-900">{candidate.full_name}</p>
                        <p className="text-xs text-gray-500">{candidate.identity_no || "-"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p>{candidate.email || "-"}</p>
                        <p>{candidate.phone || "-"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{candidate.source_channel || "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          candidate.contact_status === "aktif"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {candidate.contact_status === "aktif" ? "Aktif" : "Tidak bisa dihubungi"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          candidate.completeness_status === "lengkap"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {candidate.completeness_status === "lengkap" ? "Lengkap" : "Belum lengkap"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/candidates/${candidate.id}`}
                        className="inline-flex items-center rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100"
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
