"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { fetchEmployees } from "@/lib/api/employees";
import type { Employee } from "@/types";

const STATUS_OPTIONS = [
  { value: "", label: "Semua" },
  { value: "aktif", label: "Aktif" },
  { value: "nonaktif", label: "Non Aktif" },
];

export default function EmployeesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [placementFilter, setPlacementFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expiryDays, setExpiryDays] = useState("");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Debounce search: send query 400ms after user stops typing
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearchQuery(value.trim());
      setCurrentPage(1);
    }, 400);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        setSortBy(null);
        setSortOrder("asc");
      }
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees", { statusFilter, placementFilter, searchQuery, expiryDays, sortBy, sortOrder, currentPage, itemsPerPage }],
    queryFn: () =>
      fetchEmployees({
        status: statusFilter || undefined,
        placement: placementFilter || undefined,
        search: searchQuery || undefined,
        contract_expiry_within_days: expiryDays ? Number(expiryDays) : undefined,
        sort_by: sortBy || undefined,
        sort_order: sortOrder,
        skip: (currentPage - 1) * itemsPerPage,
        limit: itemsPerPage,
      }),
  });

  const expiryWithin = Number(expiryDays) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Monitoring Outsource</p>
          <h1 className="text-2xl font-bold text-gray-900">Karyawan</h1>
        </div>
        {/* TODO: button tambah manual jika diperlukan */}
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          {/* Search name / phone */}
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Cari Nama / No HP
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-gray-400">
                search
              </span>
              <input
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Cari nama atau no HP…"
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Status Karyawan
            </label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Penempatan
            </label>
            <input
              value={placementFilter}
              onChange={(e) => { setPlacementFilter(e.target.value); setCurrentPage(1); }}
              placeholder="Cari penempatan…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Kontrak habis dalam
            </label>
            <select
              value={expiryDays}
              onChange={(e) => { setExpiryDays(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Semua</option>
              <option value="7">7 hari</option>
              <option value="14">14 hari</option>
              <option value="30">30 hari</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort("name")}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <span>Nama</span>
                    <span className="material-symbols-outlined text-[16px]">
                      {sortBy === "name"
                        ? sortOrder === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">NIK / NIP</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort("placement")}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <span>Penempatan</span>
                    <span className="material-symbols-outlined text-[16px]">
                      {sortBy === "placement"
                        ? sortOrder === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort("position")}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <span>Posisi</span>
                    <span className="material-symbols-outlined text-[16px]">
                      {sortBy === "position"
                        ? sortOrder === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort("contract")}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <span>Kontrak Berjalan</span>
                    <span className="material-symbols-outlined text-[16px]">
                      {sortBy === "contract"
                        ? sortOrder === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort("age")}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <span>Umur</span>
                    <span className="material-symbols-outlined text-[16px]">
                      {sortBy === "age"
                        ? sortOrder === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">Email</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                    Memuat data karyawan…
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                    Belum ada karyawan.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const isContractUrgent =
                    emp.contract_duration_running != null && expiryWithin > 0
                      ? emp.contract_duration_running <= expiryWithin
                      : false;

                  return (
                    <tr key={emp.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/employees/${emp.id}`}
                            className="font-semibold text-gray-900 transition-colors hover:text-blue-600 hover:underline"
                          >
                            {emp.full_name}
                          </Link>
                          {emp.is_blacklisted && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 border border-red-200">
                              Blacklist
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{emp.phone_number || "-"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{emp.identity_no || "-"}</p>
                        <p className="text-xs text-gray-500">{emp.employee_nip || "-"}</p>
                      </td>
                      <td className="px-4 py-3">{emp.placement || "-"}</td>
                      <td className="px-4 py-3">{emp.role_level || "-"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            emp.employee_status === "aktif"
                              ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                              : "border-red-200 bg-red-100 text-red-800"
                          }`}
                        >
                          {emp.employee_status === "aktif" ? "Aktif" : "Non Aktif"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {emp.contract_duration_running != null ? (
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              isContractUrgent
                                ? "border-red-200 bg-red-100 text-red-700 animate-pulse"
                                : "border-sky-200 bg-sky-100 text-sky-800"
                            }`}
                          >
                            {isContractUrgent ? "⚠ " : ""}{emp.contract_duration_running} bln
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {emp.age != null ? <span className="text-gray-900">{emp.age} thn</span> : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        {emp.office_email || emp.personal_email ? (
                          <div className="space-y-0.5">
                            <p className="text-gray-900">{emp.office_email || emp.personal_email}</p>
                            {emp.office_email && emp.personal_email && emp.office_email !== emp.personal_email && (
                              <p className="text-xs text-gray-500">{emp.personal_email}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between py-4 px-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Menampilkan {employees.length} karyawan
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
              disabled={employees.length < itemsPerPage}
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
