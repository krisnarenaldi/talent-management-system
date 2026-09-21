"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Filter } from "lucide-react";
import api from "@/lib/api";
import type { Candidate } from "@/types";
import { useExport } from "@/hooks/useExport";
import ExportButton from "@/components/ExportButton";

async function fetchCandidates(params?: Record<string, string | undefined>) {
  const response = await api.get("/api/v1/candidates", { params });
  return response.data as Candidate[];
}

export default function CandidatesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("");
  const [educationFilter, setEducationFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const { exportCandidates } = useExport();

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates", { searchTerm, sourceFilter, statusFilter, positionFilter, startDate, endDate, cityFilter, experienceFilter, educationFilter, currentPage, itemsPerPage }],
    queryFn: () =>
      fetchCandidates({
        search: searchTerm || undefined,
        source_channel: sourceFilter || undefined,
        completeness_status: statusFilter || undefined,
        position_id: positionFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        city: cityFilter || undefined,
        experience_level: experienceFilter || undefined,
        education: educationFilter || undefined,
        skip: ((currentPage - 1) * itemsPerPage).toString(),
        limit: itemsPerPage.toString(),
      }),
  });

  const handleExport = async () => {
    try {
      await exportCandidates({
        completeness_status: statusFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
    } catch (error) {
      console.error("Export gagal:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Talent pool</p>
          <h1 className="text-2xl font-bold text-gray-900">Kandidat</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/candidates/new"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
          >
            + Tambah Kandidat
          </Link>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-200"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <ExportButton
            onExport={handleExport}
            className="hidden md:inline-flex"
            filters={showFilters && (
              <div className="space-y-3 border-t border-gray-200 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Posisi</label>
                    <input
                      value={positionFilter}
                      onChange={(e) => setPositionFilter(e.target.value)}
                      placeholder="Judul posisi"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Tanggal mulai</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Tanggal akhir</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      </div>

      {showFilters && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm space-y-3">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Posisi</label>
              <input
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                placeholder="Judul posisi"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Tanggal mulai</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Tanggal akhir</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Pendidikan</label>
              <input
                value={educationFilter}
                onChange={(e) => setEducationFilter(e.target.value)}
                placeholder="S1, SMA, dll"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Kota</label>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Semua</option>
                <option value="jabotabek">Jabotabek</option>
                <option value="non_jabotabek">Non Jabotabek</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Pengalaman Kerja</label>
              <select
                value={experienceFilter}
                onChange={(e) => setExperienceFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Semua</option>
                <option value="junior">Junior (0-3 thn)</option>
                <option value="intermediate">Intermediate (3-5 thn)</option>
                <option value="senior">Senior (&gt; 5 thn)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setPositionFilter("");
                  setStartDate("");
                  setEndDate("");
                  setCityFilter("");
                  setExperienceFilter("");
                  setEducationFilter("");
                }}
                className="w-full rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                Reset Filter
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Cari
            </label>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama, kota, skill, institusi..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Pendidikan
            </label>
            <input
              value={educationFilter}
              onChange={(e) => setEducationFilter(e.target.value)}
              placeholder="S1, SMA..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Kota
            </label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">Semua</option>
              <option value="jabotabek">Jabotabek</option>
              <option value="non_jabotabek">Non Jabotabek</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Pengalaman
            </label>
            <select
              value={experienceFilter}
              onChange={(e) => setExperienceFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">Semua</option>
              <option value="junior">Junior (0-3 thn)</option>
              <option value="intermediate">Intermediate (3-5 thn)</option>
              <option value="senior">Senior (&gt; 5 thn)</option>
            </select>
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
        </div>
        
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6 mt-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Kelengkapan
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
                <th className="px-4 py-3">Skill</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Kelengkapan</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    Memuat data kandidat...
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    Belum ada kandidat.
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => (
                  <tr key={candidate.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {candidate.photo_url ? (
                          <img
                            src={candidate.photo_url}
                            alt={candidate.full_name}
                            className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-gray-500 text-sm font-medium">
                            ?
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{candidate.full_name}</p>
                            {candidate.is_blacklisted && (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 border border-red-200">
                                Blacklist
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{candidate.identity_no || "-"}</p>
                        </div>
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
                      {candidate.skills && candidate.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {candidate.skills.slice(0, 3).map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                            >
                              {skill}
                            </span>
                          ))}
                          {candidate.skills.length > 3 && (
                            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              +{candidate.skills.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          candidate.contact_status === "aktif"
                            ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                            : "border-amber-200 bg-amber-100 text-amber-800"
                        }`}
                      >
                        {candidate.contact_status === "aktif" ? "Aktif" : "Tidak bisa dihubungi"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          candidate.completeness_status === "lengkap"
                            ? "border-sky-200 bg-sky-100 text-sky-800"
                            : "border-orange-200 bg-orange-100 text-orange-800"
                        }`}
                      >
                        {candidate.completeness_status === "lengkap" ? "Lengkap" : "Belum lengkap"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/candidates/${candidate.id}/cv`}
                          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm transition-all hover:bg-violet-100"
                          title="Generate CV Standar Altek"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          CV
                        </Link>
                        <Link
                          href={`/candidates/${candidate.id}`}
                          className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
                        >
                          Lihat detail
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between py-4 px-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Menampilkan {candidates.length} kandidat
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Sebelumnya
            </button>
            <span className="text-sm font-medium text-gray-700">Halaman {currentPage}</span>
            <button
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={candidates.length < itemsPerPage}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
