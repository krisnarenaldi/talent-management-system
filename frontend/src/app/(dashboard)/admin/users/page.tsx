"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import api from "@/lib/api";
import type { User } from "@/types";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";

const USER_ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  hr: "HR",
  manager: "Manager",
};

const userCreateSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Email tidak valid"),
  role: z.enum(["admin", "hr", "manager"], { message: "Role wajib dipilih" }),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

const userUpdateSchema = z
  .object({
    name: z.string().min(1, "Nama wajib diisi").optional(),
    email: z.string().email("Email tidak invalid").optional(),
    role: z
      .enum(["admin", "hr", "manager"], { message: "Role tidak valid" })
      .optional(),
    password: z
      .string()
      .refine((val) => val.length === 0 || val.length >= 6, "Password minimal 6 karakter")
      .optional(),
    is_active: z.boolean().optional(),
  })
  .partial();

type UserCreateForm = z.infer<typeof userCreateSchema>;
type UserUpdateForm = z.infer<typeof userUpdateSchema>;

interface UsersResponse {
  data: User[];
  total: number;
}

async function fetchUsers(params?: Record<string, unknown>): Promise<UsersResponse> {
  const response = await api.get("/api/v1/users", { params });
  const data = response.data;
  if (Array.isArray(data)) {
    return { data, total: data.length };
  }
  return data;
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { isRole } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const showToast = useToastStore((state) => state.showToast);

  const {
    data: usersData,
    isLoading,
    isError,
    error,
  } = useQuery<UsersResponse>({
    queryKey: ["users", { search: searchTerm, role: roleFilter, status: statusFilter }],
    queryFn: () =>
      fetchUsers({
        search: searchTerm || undefined,
        role: roleFilter || undefined,
        is_active:
          statusFilter === "active"
            ? true
            : statusFilter === "inactive"
              ? false
              : undefined,
        skip: 0,
        limit: 100,
      }),
  });

  const users = usersData?.data ?? [];
  const totalUsers = usersData?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (payload: UserCreateForm) =>
      api.post("/api/v1/users", payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowAddModal(false);
      showToast("success", "Pengguna berhasil ditambahkan.");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Gagal menambahkan pengguna.";
      showToast("error", msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UserUpdateForm }) =>
      api.put(`/api/v1/users/${id}`, payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
      showToast("success", "Pengguna berhasil diperbarui.");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Gagal memperbarui pengguna.";
      showToast("error", msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      showToast("success", "Pengguna berhasil dinonaktifkan.");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Gagal menonaktifkan pengguna.";
      showToast("error", msg);
    },
  });

  const handleDelete = (user: User) => {
    setDeleteConfirmUser(user);
  };

  const handleReactivate = (user: User) => {
    updateMutation.mutate({
      id: user.id,
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
                  Akses ditolak. Hanya Admin yang dapat mengelola pengguna.
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
            Kelola Pengguna
          </h1>
          {isRole("admin") && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Tambah Pengguna
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
                placeholder="Nama atau email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-label-sm text-on-surface-variant mb-1 uppercase tracking-wider">
              Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 bg-surface border border-outline-variant rounded-md text-body-sm text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            >
              <option value="">Semua</option>
              <option value="admin">Admin</option>
              <option value="hr">HR</option>
              <option value="manager">Manager</option>
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
              <p>Memuat pengguna...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-label-md text-on-surface-variant">
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">
                      Nama
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">
                      Email
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider">
                      Role
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
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-surface-container-low/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-on-surface">
                        {user.name}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {user.email}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary-container/20 text-secondary border border-secondary-container/30">
                          {USER_ROLE_LABELS[user.role] ?? user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {user.is_active ? (
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
                        {format(new Date(user.created_at), "dd MMM yyyy", {
                          locale: idLocale,
                        })}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {format(new Date(user.updated_at), "dd MMM yyyy", {
                          locale: idLocale,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          {isRole("admin") && (
                            <>
                              <button
                                onClick={() => setEditingUser(user)}
                                className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                                title="Edit"
                              >
                                <span className="material-symbols-outlined text-lg">
                                  edit
                                </span>
                              </button>
                              {user.is_active ? (
                                <button
                                  onClick={() => handleDelete(user)}
                                  className="p-1 text-on-surface-variant hover:text-error transition-colors"
                                  title="Nonaktifkan"
                                >
                                  <span className="material-symbols-outlined text-lg">
                                    delete
                                  </span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReactivate(user)}
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
                  {users.length === 0 && !isLoading && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-on-surface-variant"
                      >
                        <span className="material-symbols-outlined text-3xl mb-2">
                          search_off
                        </span>
                        <p>Tidak ada pengguna ditemukan.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="p-4 border-t border-outline-variant text-body-sm text-on-surface-variant flex justify-between items-center bg-surface-bright">
            <span>Total: {totalUsers} pengguna</span>
          </div>
        </div>

        {/* Add/Edit Modal */}
        {(showAddModal || editingUser) && (
          <UserFormModal
            key={editingUser?.id ?? "new"}
            user={editingUser}
            onClose={() => {
              setShowAddModal(false);
              setEditingUser(null);
            }}
            onCreate={createMutation.mutateAsync}
            onUpdate={updateMutation.mutateAsync}
            isCreatingPending={createMutation.isPending}
            isUpdatingPending={updateMutation.isPending}
          />
        )}

        {deleteConfirmUser && (
          <DeleteConfirmModal
            user={deleteConfirmUser}
            onClose={() => setDeleteConfirmUser(null)}
            onConfirm={() => deleteMutation.mutate(deleteConfirmUser.id)}
            isPending={deleteMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

function UserFormModal({
  user,
  onClose,
  onCreate,
  onUpdate,
  isCreatingPending,
  isUpdatingPending,
}: {
  user: User | null;
  onClose: () => void;
  onCreate: (payload: UserCreateForm) => Promise<unknown>;
  onUpdate: ({ id, payload }: { id: string; payload: UserUpdateForm }) => Promise<unknown>;
  isCreatingPending: boolean;
  isUpdatingPending: boolean;
}) {
  const isCreating = !user;
  const schema = isCreating ? userCreateSchema : userUpdateSchema;
  const isSubmitting = isCreating ? isCreatingPending : isUpdatingPending;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: isCreating
      ? { name: "", email: "", role: "hr", password: "" }
      : {
          name: user?.name ?? "",
          email: user?.email ?? "",
          role: (user?.role as "admin" | "hr" | "manager") ?? "hr",
          password: "",
          is_active: user?.is_active ?? true,
        },
  });

  void register;
  void errors;

  const onSubmit = async (data: Record<string, unknown>) => {
    try {
      if (isCreating) {
        await onCreate(data as unknown as UserCreateForm);
      } else if (user) {
        const payload = data as unknown as UserUpdateForm;
        if (!payload.password) {
          delete (payload as { password?: string }).password;
        }
        await onUpdate({ id: user.id, payload });
      }
    } catch {
      // Errors handled by mutation's onError callback
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-headline-md font-semibold text-on-surface mb-4">
          {isCreating ? "Tambah Pengguna Baru" : `Edit Pengguna: ${user?.name}`}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-label-md text-on-surface mb-1.5">
              Nama Lengkap
            </label>
            <input
              type="text"
              placeholder="John Doe"
              {...register("name")}
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
            {errors.name && (
              <p className="text-error text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-label-md text-on-surface mb-1.5">
              Email
            </label>
            <input
              type="email"
              placeholder="nama@perusahaan.com"
              {...register("email")}
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
            {errors.email && (
              <p className="text-error text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-label-md text-on-surface mb-1.5">
              Role
            </label>
            <select
              {...register("role")}
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            >
              <option value="admin">Admin</option>
              <option value="hr">HR</option>
              <option value="manager">Manager</option>
            </select>
            {errors.role && (
              <p className="text-error text-xs mt-1">{errors.role.message}</p>
            )}
          </div>

          <div>
            <label className="block text-label-md text-on-surface mb-1.5">
              Password {isCreating ? "(wajib)" : "(kosongkan jika tidak diubah)"}
            </label>
            <input
              type="password"
              placeholder={
                isCreating ? "Minimal 6 karakter" : "Kosongkan untuk tidak rubah"
              }
              {...register("password")}
              className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
            {errors.password && (
              <p className="text-error text-xs mt-1">{errors.password.message}</p>
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
                Pengguna aktif
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface rounded-lg font-medium hover:bg-surface-container-highest transition-colors"
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
  user,
  onClose,
  onConfirm,
  isPending,
}: {
  user: User;
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
            Konfirmasi Nonaktifkan
          </h2>
        </div>
        <p className="text-body-sm text-on-surface-variant mb-6">
          Nonaktifkan pengguna{" "}
          <span className="font-medium text-on-surface">{user.name}</span>?
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
              <span className="material-symbols-outlined text-lg">
                check
              </span>
            )}
            Nonaktifkan
          </button>
        </div>
      </div>
    </div>
  );
}
