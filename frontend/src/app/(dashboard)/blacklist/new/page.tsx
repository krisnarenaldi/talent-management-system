"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import { blacklistApi } from "@/lib/api/blacklist";
import { useToastStore } from "@/stores/toast.store";
import { useAuthStore } from "@/stores/auth.store";
import { getErrorMessage } from "@/lib/errors";
import type { BlacklistStatusType, Candidate, Employee } from "@/types";

const formSchema = z.object({
  target_type: z.enum(["candidate", "employee"]),
  target_id: z.string().min(1, "Pilih target terlebih dahulu"),
  status_type_id: z.string().min(1, "Pilih status type"),
  reason: z.string().min(1, "Alasan wajib diisi").max(500),
  notes: z.string().optional(),
  blacklisted_date: z.string().optional(),
  pic_user_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewBlacklistPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const user = useAuthStore((state) => state.user);
  const isPM = user?.role === "pm";
  const isHRorManager = user?.role === "hr" || user?.role === "manager";

  const [targetType, setTargetType] = useState<"candidate" | "employee">("candidate");
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<Candidate | Employee | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [picSearchTerm, setPicSearchTerm] = useState("");
  const [showPicDropdown, setShowPicDropdown] = useState(false);
  const [selectedPic, setSelectedPic] = useState<Employee | null>(null);
  const picDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (picDropdownRef.current && !picDropdownRef.current.contains(e.target as Node)) {
        setShowPicDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { data: statusTypes = [] } = useQuery({
    queryKey: ["blacklist-status-types"],
    queryFn: async () => {
      const response = await api.get("/api/v1/admin/blacklist-status-types");
      return response.data as BlacklistStatusType[];
    },
  });

  // Candidate search
  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates-search", searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim()) return [];
      const response = await api.get("/api/v1/candidates", { params: { search: searchTerm } });
      return response.data as Candidate[];
    },
    enabled: searchTerm.length >= 2 && targetType === "candidate",
    staleTime: 5 * 60 * 1000,
  });

  // Employee search
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-search", searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim()) return [];
      const response = await api.get("/api/v1/employee", { params: { search: searchTerm } });
      return response.data as Employee[];
    },
    enabled: searchTerm.length >= 2 && targetType === "employee",
    staleTime: 5 * 60 * 1000,
  });

  // PIC employee search (only for HR/Manager)
  const { data: picEmployees = [] } = useQuery({
    queryKey: ["employees-search-pic", picSearchTerm],
    queryFn: async () => {
      if (!picSearchTerm.trim()) return [];
      const response = await api.get("/api/v1/employees", { params: { search: picSearchTerm } });
      return response.data as Employee[];
    },
    enabled: isHRorManager && picSearchTerm.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: FormValues) => {
      const blacklistPayload = {
        ...(payload.target_type === "candidate"
          ? { candidate_id: payload.target_id }
          : { employee_id: payload.target_id }),
        status_type_id: payload.status_type_id,
        reason: payload.reason,
        notes: payload.notes || null,
        blacklisted_date: payload.blacklisted_date || null,
        pic_user_id: payload.pic_user_id || null,
      };
      return blacklistApi.create(blacklistPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
      showToast("success", "Target berhasil ditambahkan ke blacklist.");
      router.push("/blacklist");
    },
    onError: (err) => {
      showToast("error", getErrorMessage(err, "Gagal menambahkan blacklist."));
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      target_type: "candidate",
      reason: "",
      notes: "",
      pic_user_id: isPM ? user?.id : undefined,
    },
  });

  const handleSelectTarget = (target: Candidate | Employee) => {
    setSelectedTarget(target);
    setValue("target_id", target.id);
    setSearchTerm(target.full_name);
    setShowDropdown(false);
  };

  const handleSelectPIC = (employee: Employee) => {
    setSelectedPic(employee);
    setValue("pic_user_id", employee.id);
    setPicSearchTerm(employee.full_name);
    setShowPicDropdown(false);
  };

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/blacklist" className="text-sm font-medium text-primary-600 hover:underline">
          ← Kembali ke Blacklist
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Tambah ke Blacklist</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-16">
        {/* Target Selection */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Pilih Target</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tipe Target <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="candidate"
                  checked={targetType === "candidate"}
                  onChange={() => {
                    setTargetType("candidate");
                    setValue("target_type", "candidate");
                    setSearchTerm("");
                    setSelectedTarget(null);
                    setValue("target_id", "");
                  }}
                  className="mr-2"
                />
                Kandidat
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="employee"
                  checked={targetType === "employee"}
                  onChange={() => {
                    setTargetType("employee");
                    setValue("target_type", "employee");
                    setSearchTerm("");
                    setSelectedTarget(null);
                    setValue("target_id", "");
                  }}
                  className="mr-2"
                />
                Karyawan
              </label>
            </div>
          </div>

          <div className="relative" ref={dropdownRef}>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nama Target <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
                if (e.target.value.length < 2) setSelectedTarget(null);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={`Ketik nama ${targetType === "candidate" ? "kandidat" : "karyawan"}...`}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
            {errors.target_id && (
              <p className="mt-1 text-xs text-red-600">{errors.target_id.message}</p>
            )}

            {showDropdown && targetType === "candidate" && candidates.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => handleSelectTarget(candidate)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center gap-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{candidate.full_name}</p>
                      <p className="text-xs text-gray-500">
                        {candidate.email || candidate.phone || candidate.identity_no || "-"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showDropdown && targetType === "employee" && employees.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSelectTarget(emp)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center gap-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{emp.full_name}</p>
                      <p className="text-xs text-gray-500">
                        {emp.office_email || emp.phone_number || "-"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showDropdown && ((targetType === "candidate" && candidates.length === 0) || (targetType === "employee" && employees.length === 0)) && searchTerm.length >= 2 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-3 text-center text-sm text-gray-500">
                Tidak ditemukan
              </div>
            )}
          </div>

          {selectedTarget && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm">
              <p className="font-medium text-blue-900">{selectedTarget.full_name}</p>
              <p className="text-blue-700 text-xs mt-1">
                {targetType === "candidate" ? (
                  <>
                    {(selectedTarget as Candidate).email && `Email: ${(selectedTarget as Candidate).email}  •  `}
                    {(selectedTarget as Candidate).phone && `HP: ${(selectedTarget as Candidate).phone}`}
                  </>
                ) : (
                  <>
                    {(selectedTarget as Employee).office_email && `Email Kantor: ${(selectedTarget as Employee).office_email}  •  `}
                    {(selectedTarget as Employee).phone_number && `HP: ${(selectedTarget as Employee).phone_number}`}
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* PIC Selection (optional for PM) */}
        {!isPM && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">PIC (Person in Charge)</h2>
            <div className="relative" ref={picDropdownRef}>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Pilih PIC
              </label>
              <input
                type="text"
                value={picSearchTerm}
                onChange={(e) => {
                  setPicSearchTerm(e.target.value);
                  setShowPicDropdown(true);
                  if (e.target.value.length < 2) setSelectedPic(null);
                }}
                onFocus={() => setShowPicDropdown(true)}
                placeholder="Cari karyawan..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
              {showPicDropdown && picEmployees.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                  {picEmployees.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => handleSelectPIC(emp)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <p className="font-medium text-gray-900">{emp.full_name}</p>
                      <p className="text-xs text-gray-500">{emp.office_email || emp.phone_number}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">Kosongkan untuk menggunakan user aktif saat ini.</p>
          </div>
        )}

        {/* Detail Blacklist */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Detail Blacklist</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Status Type <span className="text-red-500">*</span>
            </label>
            <select
              {...register("status_type_id")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">-- Pilih Status Type --</option>
              {statusTypes.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
            {errors.status_type_id && (
              <p className="mt-1 text-xs text-red-600">{errors.status_type_id.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Alasan <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register("reason")}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
              placeholder="Jelaskan alasan blacklist..."
            />
            {errors.reason && (
              <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Catatan</label>
            <textarea
              {...register("notes")}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
              placeholder="Catatan tambahan (opsional)"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tanggal Blacklist</label>
            <input
              type="date"
              {...register("blacklisted_date")}
              className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500">Kosongkan untuk menggunakan hari ini</p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/blacklist"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {createMutation.isPending ? "Menyimpan..." : "Simpan Blacklist"}
          </button>
        </div>
      </form>
    </div>
  );
}