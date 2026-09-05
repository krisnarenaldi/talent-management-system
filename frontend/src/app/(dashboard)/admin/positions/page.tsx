"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import api from "@/lib/api";
import type { AgreementType, Position, Client } from "@/types";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";

const positionCreateSchema = z.object({
  client_id: z.string().min(1, "Klien wajib dipilih"),
  title: z.string().min(1, "Judul posisi wajib diisi"),
  requirement: z.string().optional(),
  employment_type: z.string().optional(),
  contract_duration_months: z
    .number()
    .min(1, "Durasi minimal 1 bulan")
    .optional(),
  is_active: z.boolean().default(true),
});

const positionUpdateSchema = z
  .object({
    title: z.string().min(1, "Judul posisi wajib diisi").optional(),
    requirement: z.string().optional(),
    employment_type: z.string().optional(),
    contract_duration_months: z
      .number()
      .min(1, "Durasi minimal 1 bulan")
      .optional(),
    is_active: z.boolean().optional(),
  })
  .partial();

type PositionCreateForm = z.infer<typeof positionCreateSchema>;
type PositionUpdateForm = z.infer<typeof positionUpdateSchema>;

interface PositionsResponse {
  data: Position[];
  total: number;
}

async function fetchPositions(params?: Record<string, unknown>): Promise<PositionsResponse> {
  const response = await api.get("/api/v1/positions", { params });
  const data = response.data;
  if (Array.isArray(data)) {
    return { data, total: data.length };
  }
  return data;
}

async function fetchClients(): Promise<Client[]> {
  const response = await api.get("/api/v1/clients?is_active=true");
  return response.data;
}

async function fetchAgreementTypes(): Promise<AgreementType[]> {
  const response = await api.get("/api/v1/admin/agreement-types", {
    params: { is_active: true },
  });
  return response.data;
}

export default function AdminPositionsPage() {
  const queryClient = useQueryClient();
  const { isRole } = useAuthStore();
  const showToast = useToastStore((state) => state.showToast);

  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);

  const {
    data: positionsData,
    isLoading,
    isError,
    error,
  } = useQuery<PositionsResponse>({
    queryKey: ["positions", { search: searchTerm, client: clientFilter, status: statusFilter }],
    queryFn: () =>
      fetchPositions({
        search: searchTerm || undefined,
        client_id: clientFilter || undefined,
        is_active:
          statusFilter === "active"
            ? true
            : statusFilter === "inactive"
              ? false
              : undefined,
      }),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });

  const { data: agreementTypes = [] } = useQuery({
    queryKey: ["agreement-types", "active"],
    queryFn: fetchAgreementTypes,
  });

  const positions = positionsData?.data ?? [];
  const totalPositions = positionsData?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (payload: PositionCreateForm) =>
      api.post("/api/v1/positions", payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setShowAddModal(false);
      showToast("success", "Posisi berhasil ditambahkan.");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Gagal menambahkan posisi.";
      showToast("error", msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PositionUpdateForm }) =>
      api.put(`/api/v1/positions/${id}`, payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setEditingPosition(null);
      showToast("success", "Posisi berhasil diperbarui.");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Gagal memperbarui posisi.";
      showToast("error", msg);
    },
  });

  const handleToggleActive = (position: Position) => {
    updateMutation.mutate({
      id: position.id,
      payload: { is_active: !position.is_active },
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
                  Akses ditolak. Hanya Admin yang dapat mengelola posisi.
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
            Kelola Posisi
          </h1>
          {isRole("admin") && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Tambah Posisi
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
                placeholder="Judul posisi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-label-sm text-on-surface-variant mb-1 uppercase tracking-wider">
              Klien
            </label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-3 py-1.5 bg-surface border border-outline-variant rounded-md text-body-sm text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none min-w-[140px]"
            >
              <option value="">Semua Klien</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
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
              <p>Memuat posisi...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-label-md text-on-surface-variant">
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">
                      Judul Posisi
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">
                      Klien
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">
                      Tipe Pekerjaan
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">
                      Durasi (bulan)
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
                  {positions.map((position) => (
                    <tr
                      key={position.id}
                      className="hover:bg-surface-container-low/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-on-surface">
                        {position.title}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {position.client_name}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {position.employment_type ?? "-"}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {position.contract_duration_months ?? "-"}
                      </td>
                      <td className="py-3 px-4">
                        {position.is_active ? (
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
                        {format(new Date(position.created_at), "dd MMM yyyy", {
                          locale: idLocale,
                        })}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {format(new Date(position.updated_at), "dd MMM yyyy", {
                          locale: idLocale,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          {isRole("admin") && (
                            <>
                              <button
                                onClick={() => setEditingPosition(position)}
                                className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                                title="Edit"
                              >
                                <span className="material-symbols-outlined text-lg">
                                  edit
                                </span>
                              </button>
                              {position.is_active ? (
                                <button
                                  onClick={() => handleToggleActive(position)}
                                  className="p-1 text-on-surface-variant hover:text-warning transition-colors"
                                  title="Nonaktifkan"
                                >
                                  <span className="material-symbols-outlined text-lg">
                                    toggle_off
                                  </span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleActive(position)}
                                  className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                                  title="Aktifkan kembali"
                                >
                                  <span className="material-symbols-outlined text-lg">
                                    toggle_on
                                  </span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {positions.length === 0 && !isLoading && (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-8 text-center text-on-surface-variant"
                      >
                        <span className="material-symbols-outlined text-3xl mb-2">
                          search_off
                        </span>
                        <p>Tidak ada posisi ditemukan.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="p-4 border-t border-outline-variant text-body-sm text-on-surface-variant flex justify-between items-center bg-surface-bright">
            <span>Total: {totalPositions} posisi</span>
          </div>
        </div>

        {/* Add/Edit Modal */}
        {(showAddModal || editingPosition) && (
          <PositionFormModal
            key={editingPosition?.id ?? "new"}
            position={editingPosition}
            clients={clients}
            agreementTypes={agreementTypes}
            onClose={() => {
              setShowAddModal(false);
              setEditingPosition(null);
            }}
            onCreate={createMutation.mutateAsync}
            onUpdate={updateMutation.mutateAsync}
            isCreatingPending={createMutation.isPending}
            isUpdatingPending={updateMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

function PositionFormModal({
  position,
  clients,
  agreementTypes,
  onClose,
  onCreate,
  onUpdate,
  isCreatingPending,
  isUpdatingPending,
}: {
  position: Position | null;
  clients: Client[];
  agreementTypes: AgreementType[];
  onClose: () => void;
  onCreate: (payload: PositionCreateForm) => Promise<unknown>;
  onUpdate: ({ id, payload }: { id: string; payload: PositionUpdateForm }) => Promise<unknown>;
  isCreatingPending: boolean;
  isUpdatingPending: boolean;
}) {
  const isCreating = !position;
  const schema = isCreating ? positionCreateSchema : positionUpdateSchema;
  const isSubmitting = isCreating ? isCreatingPending : isUpdatingPending;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: isCreating
      ? {
          client_id: "",
          title: "",
          requirement: "",
          employment_type: "",
          contract_duration_months: undefined,
          is_active: true,
        }
      : {
          client_id: position?.client_id ?? "",
          title: position?.title ?? "",
          requirement: position?.requirement ?? "",
          employment_type: position?.employment_type ?? "",
          contract_duration_months: position?.contract_duration_months ?? undefined,
          is_active: position?.is_active ?? true,
        },
  });

  void register;
  void errors;
  void clients;

  const onSubmit = async (data: Record<string, unknown>) => {
    try {
      if (isCreating) {
        await onCreate(data as unknown as PositionCreateForm);
      } else if (position) {
        await onUpdate({ id: position.id, payload: data as unknown as PositionUpdateForm });
      }
    } catch {
      // Errors handled by mutation's onError callback
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-headline-md font-semibold text-on-surface mb-4">
          {isCreating ? "Tambah Posisi Baru" : `Edit Posisi: ${position?.title}`}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-label-md text-on-surface mb-1.5">
              Klien
            </label>
            <select
              {...register("client_id")}
              disabled={!isCreating}
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all disabled:opacity-50"
            >
              {isCreating && (
                <option value="">Pilih Klien</option>
              )}
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            {errors.client_id && (
              <p className="text-error text-xs mt-1">{errors.client_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-label-md text-on-surface mb-1.5">
              Judul Posisi
            </label>
            <input
              type="text"
              placeholder="Senior Backend Engineer"
              {...register("title")}
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
            {errors.title && (
              <p className="text-error text-xs mt-1">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-label-md text-on-surface mb-1.5">
              Tipe Pekerjaan
            </label>
            <select
              {...register("employment_type")}
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            >
              <option value="">Pilih Tipe Pekerjaan</option>
              {agreementTypes.map((agreementType) => (
                <option key={agreementType.id} value={agreementType.label}>
                  {agreementType.label}
                </option>
              ))}
            </select>
            {errors.employment_type && (
              <p className="text-error text-xs mt-1">{errors.employment_type.message}</p>
            )}
          </div>

          <div>
            <label className="block text-label-md text-on-surface mb-1.5">
              Durasi Kontrak (bulan)
            </label>
            <input
              type="number"
              placeholder="12"
              {...register("contract_duration_months", { valueAsNumber: true })}
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
            {errors.contract_duration_months && (
              <p className="text-error text-xs mt-1">{errors.contract_duration_months.message}</p>
            )}
          </div>

          <div>
            <label className="block text-label-md text-on-surface mb-1.5">
              Persyaratan
            </label>
            <textarea
              placeholder="Minimal S1 Teknik, pengalaman 3+ tahun dengan Node.js..."
              {...register("requirement")}
              rows={3}
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-y"
            />
            {errors.requirement && (
              <p className="text-error text-xs mt-1">{errors.requirement.message}</p>
            )}
          </div>

          {!isCreating && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                {...register("is_active")}
                className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer"
              />
              <label
                htmlFor="is_active"
                className="text-body-sm text-on-surface cursor-pointer"
              >
                Posisi aktif
              </label>
            </div>
          )}

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
