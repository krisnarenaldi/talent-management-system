"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api/settings";
import { useToastStore } from "@/stores/toast.store";
import { getErrorMessage } from "@/lib/errors";
import type { SourceChannel } from "@/types";

export function SettingsSourceChannels() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);

  const [showForm, setShowForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["source-channels"],
    queryFn: () => settingsApi.listSourceChannels(),
  });

  const createMutation = useMutation({
    mutationFn: (label: string) => settingsApi.createSourceChannel({ label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source-channels"] });
      setNewLabel("");
      setShowForm(false);
      showToast("success", "Sumber berhasil ditambahkan.");
    },
    onError: (err) => {
      showToast("error", getErrorMessage(err, "Gagal menambah sumber."));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SourceChannel> }) =>
      settingsApi.updateSourceChannel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source-channels"] });
      showToast("success", "Sumber berhasil diperbarui.");
    },
    onError: (err) => {
      showToast("error", getErrorMessage(err, "Gagal memperbarui sumber."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => settingsApi.deleteSourceChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source-channels"] });
      showToast("success", "Sumber berhasil dihapus.");
    },
    onError: (err) => {
      showToast("error", getErrorMessage(err, "Gagal menghapus sumber."));
    },
  });

  const handleCreate = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  const handleToggleActive = (channel: SourceChannel) => {
    updateMutation.mutate({
      id: channel.id,
      data: { is_active: !channel.is_active },
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Yakin ingin menghapus sumber ini?")) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-body-md text-on-surface font-medium">Source Channels</h2>
          <p className="text-body-sm text-on-surface-variant mt-0.5">
            Kelola sumber kandidat (LinkedIn, Glints, Referral, dll) yang tersedia di form.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90"
        >
          {showForm ? "Batal" : "+ Tambah Sumber"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex gap-3">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Contoh: LinkedIn, Glints, JobStreet..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newLabel.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Simpan
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-700">Label</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  Memuat data...
                </td>
              </tr>
            )}
            {!isLoading && channels.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  Belum ada sumber. Klik "Tambah Sumber" untuk memulai.
                </td>
              </tr>
            )}
            {!isLoading &&
              channels.map((channel) => (
                <tr key={channel.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{channel.label}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(channel)}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        channel.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {channel.is_active ? "Aktif" : "Nonaktif"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(channel.id)}
                      className="text-xs font-medium text-red-600 hover:text-red-800"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
