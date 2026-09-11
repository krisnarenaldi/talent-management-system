"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";
import {
  fetchEmployee,
  updateEmployee,
  fetchContracts,
  addContract,
  updateContract,
  deleteContract,
  fetchPayroll,
  updatePayroll,
} from "@/lib/api/employees";
import EmployeeDocumentUploader from "@/components/employees/EmployeeDocumentUploader";
import type { Employee, EmployeeContract, EmployeePayroll } from "@/types";

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
function safeDate(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : format(d, "dd MMM yyyy", { locale: idLocale });
}

/* ── Sub-components ───────────────────────────────────────────────────────────── */
function PersonalDataTab({
  employee,
}: {
  employee: Employee;
}) {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const [form, setForm] = useState<Employee>(employee);

  useEffect(() => {
    setForm(employee);
  }, [employee]);

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<Employee>) => updateEmployee(employee.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", employee.id] });
      showToast("success", "Data karyawan berhasil diperbarui.");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Gagal menyimpan.";
      showToast("error", msg);
    },
  });

  const handleChange = (field: keyof Employee, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  const fields: { key: keyof Employee; label: string; span?: string }[] = [
    { key: "full_name", label: "Nama Lengkap" },
    { key: "employee_nip", label: "NIP" },
    { key: "identity_no", label: "NIK / No. Identitas" },
    { key: "birth_place", label: "Tempat Lahir" },
    { key: "birth_date", label: "Tanggal Lahir" },
    { key: "gender", label: "Jenis Kelamin" },
    { key: "blood_type", label: "Golongan Darah" },
    { key: "personal_email", label: "Email Pribadi" },
    { key: "office_email", label: "Email Kantor" },
    { key: "phone_number", label: "No. HP" },
    { key: "placement", label: "Penempatan" },
    { key: "role_level", label: "Level Jabatan" },
    { key: "notes", label: "Catatan" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Usia", value: employee.age != null ? `${employee.age} tahun` : "-", color: "bg-sky-50 border-sky-200" },
          { label: "Status", value: employee.employee_status, color: "bg-emerald-50 border-emerald-200" },
          { label: "Kontrak Berjalan", value: employee.contract_duration_running != null ? `${employee.contract_duration_running} bulan` : "-", color: "bg-violet-50 border-violet-200" },
          { label: "Penempatan", value: employee.placement || "-", color: "bg-amber-50 border-amber-200" },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl border ${card.color} p-4`}>
            <p className="text-xs uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {card.label === "Status"
                ? card.value === "aktif" ? "Aktif" : card.value === "cuti" ? "Cuti" : "Resign"
                : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Editable form */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Data Pribadi</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(({ key, label, span }) => (
            <div key={key} className={span ?? ""}>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                {label}
              </label>
              {key === "notes" ? (
                <textarea
                  value={form[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                />
              ) : (
                <input
                  type={key.includes("date") ? "date" : "text"}
                  value={form[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-secondary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {updateMutation.isPending ? "Menyimpan…" : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContractsTab({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts", employeeId],
    queryFn: () => fetchContracts(employeeId),
  });

  const addMutation = useMutation({
    mutationFn: (payload: Partial<EmployeeContract>) => addContract(employeeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts", employeeId] });
      showToast("success", "Kontrak baru berhasil ditambahkan.");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Gagal menambah kontrak.";
      showToast("error", msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContract(employeeId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts", employeeId] });
      showToast("success", "Kontrak berhasil dihapus.");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Gagal menghapus kontrak.";
      showToast("error", msg);
    },
  });

  return (
    <div className="space-y-5">
      {/* Add contract form */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Tambah Kontrak Baru</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Jenis Perjanjian
            </label>
            <input
              placeholder="PKWT / PKWTT"
              onChange={(e) => addMutation.mutate({ agreement_type_id: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              No. Kontrak
            </label>
            <input
              placeholder="Nomor kontrak"
              onChange={(e) => addMutation.mutate({ contract_number: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Durasi (bulan)
            </label>
            <input
              type="number"
              placeholder="12"
              onChange={(e) => addMutation.mutate({ duration_months: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Tanggal Mulai
            </label>
            <input
              type="date"
              onChange={(e) => addMutation.mutate({ join_date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Tanggal Akhir
            </label>
            <input
              type="date"
              onChange={(e) => addMutation.mutate({ end_date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              disabled={addMutation.isPending}
              onClick={() => addMutation.mutate({ status: "aktif" })}
              className="w-full rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-secondary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {addMutation.isPending ? "Menyimpan…" : "Tambah Kontrak"}
            </button>
          </div>
        </div>
      </div>

      {/* Contracts list */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Riwayat Kontrak</h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">Memuat kontrak…</p>
        ) : contracts.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada kontrak.</p>
        ) : (
          <div className="space-y-3">
            {contracts.map((c) => (
              <ContractRow
                key={c.id}
                contract={c}
                onDelete={() => deleteMutation.mutate(c.id)}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContractRow({
  contract,
  onDelete,
  isDeleting,
}: {
  contract: EmployeeContract;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const isAktif = contract.status === "aktif";
  const isEndingSoon =
    contract.end_date &&
    (() => {
      const diff = Math.ceil(
        (new Date(contract.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      return diff <= 30 && diff >= 0;
    })();

  return (
    <div className={`rounded-lg border p-4 ${isAktif ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isAktif ? "bg-emerald-200 text-emerald-800" : "bg-gray-200 text-gray-700"}`}>
              {contract.status?.toUpperCase()}
            </span>
            {contract.contract_number && (
              <span className="text-sm font-mono text-gray-600">{contract.contract_number}</span>
            )}
          </div>
          <div className="text-sm text-gray-600">
            {contract.join_date && `Mulai: ${safeDate(contract.join_date)}`}
            {contract.join_date && contract.end_date && <span className="mx-2">—</span>}
            {contract.end_date && `Berakhir: ${safeDate(contract.end_date)}`}
            {contract.duration_months != null && (
              <span className="ml-2 text-xs text-gray-500">({contract.duration_months} bulan)</span>
            )}
          </div>
          {isEndingSoon && (
            <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              ⚠ Kontrak hampir habis
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed"
        >
          Hapus
        </button>
      </div>
    </div>
  );
}

function PayrollTab({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);
  const { user } = useAuthStore();
  const canEdit = user && (user.role === "manager" || user.role === "admin");

  const { data: payroll, isLoading, error } = useQuery({
    queryKey: ["payroll", employeeId],
    queryFn: () => fetchPayroll(employeeId),
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<EmployeePayroll>) => updatePayroll(employeeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll", employeeId] });
      showToast("success", "Data payroll berhasil diperbarui.");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Gagal menyimpan payroll.";
      showToast("error", msg);
    },
  });

  if (!canEdit) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">
          Anda tidak memiliki akses ke data payroll. Hanya Manager dan Admin yang dapat mengakses bagian ini.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-gray-500">Memuat data payroll…</p>;
  }

  if (error || !payroll) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">Data payroll belum tersedia untuk karyawan ini.</p>
      </div>
    );
  }

  const fields: { key: keyof EmployeePayroll; label: string; type?: string }[] = [
    { key: "thp", label: "THP (Take Home Pay)" },
    { key: "payroll_bank", label: "Bank Penggajian" },
    { key: "bank_account_number", label: "No. Rekening" },
    { key: "bpjs_tk_status", label: "BPJS TK (Status)" },
    { key: "bpjs_tk_number", label: "BPJS TK (No. Peserta)" },
    { key: "bpjs_kesehatan_status", label: "BPJS Kesehatan (Status)" },
    { key: "bpjs_kesehatan_number", label: "BPJS Kesehatan (No. Peserta)" },
    { key: "npwp_number", label: "NPWP" },
    { key: "allowance_used", label: "Tunjangan" },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Payroll</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(({ key, label, type }) => (
          <div key={key}>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              {label}
            </label>
            <input
              type={type ?? (typeof payroll[key] === "number" ? "number" : "text")}
              value={String(payroll[key] ?? "")}
              onChange={(e) =>
                updateMutation.mutate({
                  [key]: typeof payroll[key] === "number" ? Number(e.target.value) : e.target.value,
                } as Partial<EmployeePayroll>)
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => updateMutation.mutate(payroll)}
          disabled={updateMutation.isPending}
          className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-secondary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {updateMutation.isPending ? "Menyimpan…" : "Simpan Payroll"}
        </button>
      </div>
    </div>
  );
}

function DocumentsTab({ employeeId }: { employeeId: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Dokumen Karyawan</h2>
      <EmployeeDocumentUploader employeeId={employeeId} />
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────────── */
export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => fetchEmployee(id),
  });
  const [activeTab, setActiveTab] = useState("data");
  const { user } = useAuthStore();
  const canViewPayroll = user && (user.role === "manager" || user.role === "admin");

  const tabs = [
    { key: "data", label: "Data Pribadi" },
    { key: "contracts", label: "Kontrak" },
    ...(canViewPayroll ? [{ key: "payroll", label: "Payroll" }] : []),
    { key: "documents", label: "Dokumen" },
  ];

  if (isLoading || !employee) {
    return (
      <div className="space-y-6">
        <Link href="/employees" className="text-sm font-medium text-primary-600 hover:underline">
          ← Kembali ke daftar karyawan
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Memuat detail karyawan…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/employees" className="text-sm font-medium text-primary-600 hover:underline">
            ← Kembali
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{employee.full_name}</h1>
            <p className="text-sm text-gray-500">
              {employee.placement || "-"} · {employee.role_level || "-"}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            employee.employee_status === "aktif"
              ? "bg-emerald-100 text-emerald-800"
              : employee.employee_status === "cuti"
              ? "bg-amber-100 text-amber-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {employee.employee_status === "aktif" ? "Aktif" : employee.employee_status === "cuti" ? "Cuti" : "Resign"}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-secondary text-secondary"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="py-2">
        {activeTab === "data" && <PersonalDataTab employee={employee} />}
        {activeTab === "contracts" && <ContractsTab employeeId={id} />}
        {activeTab === "payroll" && canViewPayroll && <PayrollTab employeeId={id} />}
        {activeTab === "documents" && <DocumentsTab employeeId={id} />}
      </div>
    </div>
  );
}
