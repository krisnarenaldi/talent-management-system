"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { fetchEmployees } from "@/lib/api/employees";
import type { Employee } from "@/types";

const STATUS_OPTIONS = [
  { value: "", label: "Semua" },
  { value: "aktif", label: "Aktif" },
  { value: "cuti", label: "Cuti" },
  { value: "resign", label: "Resign" },
];

export default function EmployeesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [placementFilter, setPlacementFilter] = useState("");
  const [expiryDays, setExpiryDays] = useState("");

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees", { statusFilter, placementFilter, expiryDays }],
    queryFn: () =>
      fetchEmployees({
        status: statusFilter || undefined,
        placement: placementFilter || undefined,
        contract_expiry_within_days: expiryDays ? Number(expiryDays) : undefined,
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
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Status Karyawan
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
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
              onChange={(e) => setPlacementFilter(e.target.value)}
              placeholder="Cari penempatan…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Kontrak habis dalam
            </label>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
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
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">NIK / NIP</th>
                <th className="px-4 py-3">Penempatan</th>
                <th className="px-4 py-3">Posisi</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Kontrak Berjalan</th>
                <th className="px-4 py-3">Umur</th>
                <th className="px-4 py-3 text-right">Aksi</th>
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
                      ? emp.contract_duration_running <= expiryDays
                      : false;

                  return (
                    <tr key={emp.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{emp.full_name}</p>
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
                              : emp.employee_status === "cuti"
                              ? "border-amber-200 bg-amber-100 text-amber-800"
                              : "border-red-200 bg-red-100 text-red-800"
                          }`}
                        >
                          {emp.employee_status === "aktif" ? "Aktif" : emp.employee_status === "cuti" ? "Cuti" : "Resign"}
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
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/employees/${emp.id}`}
                          className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
                        >
                          Lihat detail
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
