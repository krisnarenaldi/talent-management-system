"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { profileApi } from "@/lib/api/users";
import type { AuthMeResponse } from "@/lib/api/users";

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = useState(user?.name ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const initials = (user?.name ?? "").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Nama wajib diisi.");
      return;
    }

    if (password) {
      if (password.length < 6) {
        setError("Password minimal 6 karakter.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Konfirmasi password tidak cocok.");
        return;
      }
    }

    setLoading(true);
    try {
      const payload: Parameters<typeof profileApi.updateMe>[0] = { name: name.trim() };
      if (password) payload.password = password;

      const updated = await profileApi.updateMe(payload);
      setUser({ ...user!, id: updated.id, name: updated.name, role: updated.role as "admin" | "hr" | "manager", email: updated.email });
      setSuccess("Profil berhasil diperbarui.");
      setPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memperbarui profil.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-surface border border-outline flex items-center justify-center hover:bg-surface-bright transition-colors"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
        </button>
        <div>
          <h1 className="text-headline-sm text-on-surface font-semibold">Profile</h1>
          <p className="text-body-sm text-on-surface-variant">Kelola nama dan password Anda</p>
        </div>
      </div>

      {/* Avatar + Email (readonly) */}
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-outline-variant">
        <div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-lg font-semibold border border-outline">
          {initials || "?"}
        </div>
        <div>
          <p className="text-title-sm text-on-surface font-medium">{user?.name}</p>
          <p className="text-body-sm text-on-surface-variant">{user?.email}</p>
          <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container capitalize">
            {user?.role}
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-label-sm text-on-surface font-medium mb-1.5">
            Nama lengkap
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-outline bg-surface text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
            placeholder="Masukkan nama lengkap"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-label-sm text-on-surface font-medium mb-1.5">
            Password baru
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 pr-10 rounded-lg border border-outline bg-surface text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
              placeholder="Kosongkan jika tidak diubah"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1"
            >
              <span className="material-symbols-outlined text-sm">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
          <p className="mt-1 text-caption text-on-surface-variant">Minimal 6 karakter</p>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-label-sm text-on-surface font-medium mb-1.5">
            Konfirmasi password
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 pr-10 rounded-lg border border-outline bg-surface text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
              placeholder="Ulangi password baru"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1"
            >
              <span className="material-symbols-outlined text-sm">
                {showConfirm ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>

        {/* Error / Success */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-error-container/10 border border-error-container">
            <span className="material-symbols-outlined text-sm text-error">error</span>
            <p className="text-body-sm text-error">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-success-container/10 border border-success-container">
            <span className="material-symbols-outlined text-sm text-success">check_circle</span>
            <p className="text-body-sm text-success">{success}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-primary text-on-primary font-medium text-body-md hover:bg-primary-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
          Simpan Perubahan
        </button>
      </form>
    </div>
  );
}
