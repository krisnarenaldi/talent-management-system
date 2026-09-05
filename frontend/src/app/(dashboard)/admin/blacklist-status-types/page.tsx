"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import type { BlacklistStatusType } from "@/types";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";

const formSchema = z.object({ label: z.string().trim().min(1, "Label wajib diisi") });
type FormValues = z.infer<typeof formSchema>;

type ApiError = { response?: { data?: { detail?: string }; status?: number } };

function getErrorMessage(error: unknown, fallback: string) {
  return (error as ApiError)?.response?.data?.detail || fallback;
}

export default function BlacklistStatusTypesPage() {
  const queryClient = useQueryClient();
  const isRole = useAuthStore((state) => state.isRole);
  const showToast = useToastStore((state) => state.showToast);
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<BlacklistStatusType | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data = [], isLoading, isError, error } = useQuery<BlacklistStatusType[]>({
    queryKey: ["blacklist-status-types", statusFilter],
    queryFn: async () => {
      const response = await api.get("/api/v1/admin/blacklist-status-types", {
        params: {
          is_active: statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined,
        },
      });
      return response.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: FormValues }) =>
      id
        ? api.put(`/api/v1/admin/blacklist-status-types/${id}`, payload)
        : api.post("/api/v1/admin/blacklist-status-types", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist-status-types"] });
      setEditing(null);
      setShowForm(false);
      showToast("success", `Jenis status blacklist berhasil ${editing ? "diperbarui" : "ditambahkan"}.`);
    },
    onError: (mutationError: unknown) => showToast("error", getErrorMessage(mutationError, "Gagal menyimpan jenis status blacklist.")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.put(`/api/v1/admin/blacklist-status-types/${id}`, { is_active }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["blacklist-status-types"] });
      showToast("success", variables.is_active ? "Jenis status diaktifkan." : "Jenis status dinonaktifkan.");
    },
    onError: (mutationError: unknown) => showToast("error", getErrorMessage(mutationError, "Gagal mengubah status.")),
  });

  if (isError && (error as ApiError)?.response?.status === 403) {
    return <AccessDenied resource="jenis status blacklist" />;
  }

  return (
    <div className="p-container-padding">
      <div className="max-w-[1000px] mx-auto space-y-stack-md">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-headline-lg font-bold text-on-surface">Jenis Status Blacklist</h1>
            <p className="text-body-sm text-on-surface-variant mt-1">Kelola status yang digunakan saat mencatat blacklist kandidat.</p>
          </div>
          {isRole("admin") && (
            <button onClick={() => { setEditing(null); setShowForm(true); }} className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-lg font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">add</span>Tambah Status
            </button>
          )}
        </div>

        <div className="flex justify-end">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="px-3 py-1.5 bg-surface border border-outline-variant rounded-md text-body-sm text-on-surface outline-none">
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0px_4px_12px_rgba(9,30,66,0.08)] overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
              <p>Memuat data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low text-label-md text-on-surface-variant">
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">Label</th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">Status</th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="text-body-sm divide-y divide-outline-variant">
                  {data.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-container-low/50">
                      <td className="py-3 px-4 font-medium text-on-surface">{item.label}</td>
                      <td className="py-3 px-4">
                        {item.is_active ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E6F4EA] text-[#137333]">Aktif</span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FCE8E6] text-[#C5221F]">Nonaktif</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isRole("admin") && (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setEditing(item); setShowForm(true); }} className="p-1 text-on-surface-variant hover:text-primary" title="Edit">
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button onClick={() => toggleMutation.mutate({ id: item.id, is_active: !item.is_active })} className="p-1 text-on-surface-variant hover:text-primary" title={item.is_active ? "Nonaktifkan" : "Aktifkan kembali"}>
                              <span className="material-symbols-outlined text-lg">{item.is_active ? "toggle_off" : "toggle_on"}</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-3xl">search_off</span>
                        <p>Tidak ada jenis status blacklist ditemukan.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="p-4 border-t border-outline-variant text-body-sm text-on-surface-variant bg-surface-bright">Total: {data.length} status</div>
        </div>

        {showForm && (
          <BlacklistStatusTypeFormModal
            item={editing}
            pending={saveMutation.isPending}
            onClose={() => { setEditing(null); setShowForm(false); }}
            onSubmit={(payload) => saveMutation.mutate({ id: editing?.id, payload })}
          />
        )}
      </div>
    </div>
  );
}

function BlacklistStatusTypeFormModal({
  item,
  pending,
  onClose,
  onSubmit,
}: {
  item: BlacklistStatusType | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: FormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { label: item?.label ?? "" },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-headline-md font-semibold text-on-surface mb-4">
          {item ? `Edit Jenis Status Blacklist: ${item.label}` : "Tambah Jenis Status Blacklist"}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-label-md text-on-surface mb-1.5">Label</label>
            <input
              {...register("label")}
              placeholder="Contoh: Menolak Offer Tanpa Alasan"
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
            {errors.label && <p className="text-error text-xs mt-1">{errors.label.message}</p>}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={pending} className="flex-1 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface rounded-lg font-medium hover:bg-surface-container-highest transition-colors disabled:opacity-50">Batal</button>
            <button type="submit" disabled={pending} className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-wait">
              {pending ? <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-lg">{item ? "save" : "add"}</span>}
              {pending ? "Menyimpan..." : item ? "Simpan" : "Tambah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AccessDenied({ resource }: { resource: string }) {
  return (
    <div className="p-container-padding">
      <div className="max-w-2xl mx-auto bg-error-container border border-error/20 rounded-xl px-4 py-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-on-error-container">lock</span>
        <p className="text-body-sm text-on-error-container">Akses ditolak. Hanya Admin yang dapat mengelola {resource}.</p>
      </div>
    </div>
  );
}
