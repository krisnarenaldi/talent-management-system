"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import api from "@/lib/api";
import type { Client } from "@/types";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";

const clientCreateSchema = z.object({
  name: z.string().min(1, "Nama klien wajib diisi"),
  industry: z.string().optional(),
  pic_name: z.string().optional(),
  pic_contact: z.string().optional(),
});

const clientUpdateSchema = z
  .object({
    name: z.string().min(1, "Nama klien wajib diisi").optional(),
    industry: z.string().optional(),
    pic_name: z.string().optional(),
    pic_contact: z.string().optional(),
    is_active: z.boolean().optional(),
  })
  .partial();

type ClientCreateForm = z.infer<typeof clientCreateSchema>;
type ClientUpdateForm = z.infer<typeof clientUpdateSchema>;

interface ClientsResponse {
  data: Client[];
  total: number;
}

async function fetchClients(params?: Record<string, unknown>): Promise<ClientsResponse> {
  const response = await api.get("/api/v1/clients", { params });
  const data = response.data;
  if (Array.isArray(data)) {
    return { data, total: data.length };
  }
  return data;
}

export default function AdminClientsPage() {
  const queryClient = useQueryClient();
  const { isRole } = useAuthStore();
  const showToast = useToastStore((state) => state.showToast);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteConfirmClient, setDeleteConfirmClient] = useState<Client | null>(null);

  const {
    data: clientsData,
    isLoading,
    isError,
    error,
  } = useQuery<ClientsResponse>({
    queryKey: ["clients", { search: searchTerm, status: statusFilter }],
    queryFn: () =>
      fetchClients({
        search: searchTerm || undefined,
        is_active:
          statusFilter === "active"
            ? true
            : statusFilter === "inactive"
              ? false
              : undefined,
      }),
  });

  const clients = clientsData?.data ?? [];
  const totalClients = clientsData?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (payload: ClientCreateForm) =>
      api.post("/api/v1/clients", payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setShowAddModal(false);
      showToast("success", "Klien berhasil ditambahkan.");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Gagal menambahkan klien.";
      showToast("error", msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ClientUpdateForm }) =>
      api.put(`/api/v1/clients/${id}`, payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setEditingClient(null);
      showToast("success", "Klien berhasil diperbarui.");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Gagal memperbarui klien.";
      showToast("error", msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDeleteConfirmClient(null);
      showToast("success", "Klien berhasil dinonaktifkan.");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Gagal menonaktifkan klien.";
      showToast("error", msg);
    },
  });

  const handleReactivate = (client: Client) => {
    updateMutation.mutate({
      id: client.id,
      payload: { is_active: true },
    });
  };

  if (isError) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 403) {
      return (
        <div className="p-container-padding">
          <div className="max-w-2xl mx-auto">
            <div className="bg-error-container border border-error/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-on-error-container">
                  lock
                </span>
                <p className="text-body-sm text-on-error-container">
                  Akses ditolak. Hanya Admin yang dapat mengelola klien.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="p-container-padding">
      <div className="max-w-[1400px] mx-auto space-y-stack-md">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-headline-lg font-bold text-on-surface">
            Kelola Klien
          </h1>
          {isRole("admin") && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Tambah Klien
            </button>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-label-sm text-on-surface-variant mb-1 uppercase tracking-wider">
              Cari
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
                search
              </span>
              <input
                type="text"
                placeholder="Nama klien, PIC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-label-sm text-on-surface-variant mb-1 uppercase tracking-wider">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-surface border border-outline-variant rounded-md text-body-sm text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            >
              <option value="">Semua</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0px_4px_12px_rgba(9,30,66,0.08)] overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-2xl mb-2">
                progress_activity
              </span>
              <p>Memuat klien...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-label-md text-on-surface-variant">
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">
                      Nama Klien
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">
                      Industri
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">
                      PIC
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">
                      Kontak PIC
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">
                      Status
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">
                      Dibuat
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">
                      Diubah
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="text-body-sm divide-y divide-outline-variant">
                  {clients.map((client) => (
                    <tr
                      key={client.id}
                      className="hover:bg-surface-container-low/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-on-surface">
                        {client.name}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {client.industry ?? "-"}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {client.pic_name ?? "-"}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {client.pic_contact ?? "-"}
                      </td>
                      <td className="py-3 px-4">
                        {client.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E6F4EA] text-[#137333]">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FCE8E6] text-[#C5221F]">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {format(new Date(client.created_at), "dd MMM yyyy", {
                          locale: idLocale,
                        })}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {format(new Date(client.updated_at), "dd MMM yyyy", {
                          locale: idLocale,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          {isRole("admin") && (
                            <>
                              <button
                                onClick={() => setEditingClient(client)}
                                className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                                title="Edit"
                              >
                                <span className="material-symbols-outlined text-lg">
                                  edit
                                </span>
                              </button>
                              {client.is_active ? (
                                <button
                                  onClick={() => setDeleteConfirmClient(client)}
                                  className="p-1 text-on-surface-variant hover:text-error transition-colors"
                                  title="Nonaktifkan"
                                >
                                  <span className="material-symbols-outlined text-lg">
                                    delete
                                  </span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReactivate(client)}
                                  className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                                  title="Aktifkan kembali"
                                >
                                  <span className="material-symbols-outlined text-lg">
                                    check_circle
                                  </span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {clients.length === 0 && !isLoading && (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-8 text-center text-on-surface-variant"
                      >
                        <span className="material-symbols-outlined text-3xl mb-2">
                          search_off
                        </span>
                        <p>Tidak ada klien ditemukan.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="p-4 border-t border-outline-variant text-body-sm text-on-surface-variant flex justify-between items-center bg-surface-bright">
            <span>Total: {totalClients} klien</span>
          </div>
        </div>

        {/* Add/Edit Modal */}
        {(showAddModal || editingClient) && (
          <ClientFormModal
            key={editingClient?.id ?? "new"}
            client={editingClient}
            onClose={() => {
              setShowAddModal(false);
              setEditingClient(null);
            }}
            onCreate={createMutation.mutateAsync}
            onUpdate={updateMutation.mutateAsync}
            isCreatingPending={createMutation.isPending}
            isUpdatingPending={updateMutation.isPending}
          />
        )}

        {/* Delete Confirm Modal */}
        {deleteConfirmClient && (
          <DeleteConfirmModal
            client={deleteConfirmClient}
            onClose={() => setDeleteConfirmClient(null)}
            onConfirm={() => deleteMutation.mutate(deleteConfirmClient.id)}
            isPending={deleteMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

function ClientFormModal({
  client,
  onClose,
  onCreate,
  onUpdate,
  isCreatingPending,
  isUpdatingPending,
}: {
  client: Client | null;
  onClose: () => void;
  onCreate: (payload: ClientCreateForm) => Promise<unknown>;
  onUpdate: ({ id, payload }: { id: string; payload: ClientUpdateForm }) => Promise<unknown>;
  isCreatingPending: boolean;
  isUpdatingPending: boolean;
}) {
  const isCreating = !client;
  const schema = isCreating ? clientCreateSchema : clientUpdateSchema;
  const isSubmitting = isCreating ? isCreatingPending : isUpdatingPending;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: isCreating
      ? { name: "", industry: "", pic_name: "", pic_contact: "" }
      : {
          name: client?.name ?? "",
          industry: client?.industry ?? "",
          pic_name: client?.pic_name ?? "",
          pic_contact: client?.pic_contact ?? "",
        },
  });

  void register;
  void errors;

  const onSubmit = async (data: Record<string, unknown>) => {
    try {
      if (isCreating) {
        await onCreate(data as unknown as ClientCreateForm);
      } else if (client) {
        await onUpdate({ id: client.id, payload: data as unknown as ClientUpdateForm });
      }
    } catch {
      // Errors handled by mutation's onError callback
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-headline-md font-semibold text-on-surface mb-4">
          {isCreating ? "Tambah Klien Baru" : `Edit Klien: ${client?.name}`}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-label-md text-on-surface mb-1.5">
              Nama Klien
            </label>
            <input
              type="text"
              placeholder="PT. Contoh Indonesia"
              {...register("name")}
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
            {errors.name && (
              <p className="text-error text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-label-md text-on-surface mb-1.5">
              Industri
            </label>
            <input
              type="text"
              placeholder="Banking / Financial"
              {...register("industry")}
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
            {errors.industry && (
              <p className="text-error text-xs mt-1">{errors.industry.message}</p>
            )}
          </div>

          <div>
            <label className="block text-label-md text-on-surface mb-1.5">
              Nama PIC
            </label>
            <input
              type="text"
              placeholder="John Smith"
              {...register("pic_name")}
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
            {errors.pic_name && (
              <p className="text-error text-xs mt-1">{errors.pic_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-label-md text-on-surface mb-1.5">
              Kontak PIC
            </label>
            <input
              type="text"
              placeholder="+62 812-3456-7890"
              {...register("pic_contact")}
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
            {errors.pic_contact && (
              <p className="text-error text-xs mt-1">{errors.pic_contact.message}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface rounded-lg font-medium hover:bg-surface-container-highest transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-wait"
            >
              {isSubmitting ? (
                <span className="material-symbols-outlined text-lg animate-spin">
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined text-lg">
                  {isCreating ? "add" : "save"}
                </span>
              )}
              {isSubmitting
                ? "Menyimpan..."
                : isCreating
                  ? "Tambah"
                  : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  client,
  onClose,
  onConfirm,
  isPending,
}: {
  client: Client;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-2xl text-error">
            warning
          </span>
          <h2 className="text-headline-md font-semibold text-on-surface">
            Konfirmasi Nonaktifkan Klien
          </h2>
        </div>
        <p className="text-body-sm text-on-surface-variant mb-6">
          Nonaktifkan klien{" "}
          <span className="font-medium text-on-surface">{client.name}</span>?
          Pengguna yang dinonaktifkan tidak dapat masuk lagi.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface rounded-lg font-medium hover:bg-surface-container-highest transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2 bg-error-container hover:bg-error-container/90 text-on-error-container rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-wait"
          >
            {isPending ? (
              <span className="material-symbols-outlined text-lg animate-spin">
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined text-lg">check</span>
            )}
            Nonaktifkan
          </button>
        </div>
      </div>
    </div>
  );
}
