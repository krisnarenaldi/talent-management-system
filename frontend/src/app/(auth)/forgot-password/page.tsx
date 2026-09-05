"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";

const forgotPasswordSchema = z.object({
  email: z.string().email("Email tidak valid"),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setLoading(true);
    setError(null);

    try {
      await api.post("/api/v1/auth/forgot-password", data);
      setSubmitted(true);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Permintaan gagal. Silakan coba lagi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-background min-h-screen flex items-center justify-center px-4 py-10 text-on-surface antialiased">
      <div className="w-full max-w-[500px]">
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xl shadow-primary/5 p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-primary-container to-secondary" />

          <div className="text-center mb-8">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-primary font-bold text-headline-md mb-8"
            >
              <span className="material-symbols-outlined">dataset</span>
              TalentFlow
            </Link>
            <h1 className="text-headline-lg font-bold tracking-tight">
              Lupa kata sandi?
            </h1>
            <p className="text-body-md text-on-surface-variant mt-2">
              Masukkan email kerja Anda. Kami akan mengirimkan instruksi untuk
              mengatur ulang kata sandi.
            </p>
          </div>

          {submitted ? (
            <div className="space-y-6 text-center">
              <div className="flex items-center justify-center gap-2 bg-success-container border border-success/20 rounded-xl px-4 py-3 text-success-on-container">
                <span className="material-symbols-outlined">mark_email_read</span>
                <p className="text-body-sm">
                  Jika email terdaftar, instruksi reset kata sandi telah dikirim.
                </p>
              </div>
              <Link
                href="/login"
                className="w-full py-3.5 px-6 bg-primary-container hover:bg-primary text-on-primary rounded-xl text-headline-sm transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">
                  arrow_back
                </span>
                Kembali ke Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-label-md text-on-surface mb-2 uppercase tracking-wide font-semibold"
                >
                  Email Kerja / Work Email
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline group-focus-within:text-primary transition-colors">
                    <span className="material-symbols-outlined text-xl">mail</span>
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="nama@perusahaan.com"
                    {...register("email")}
                    className="w-full pl-11 pr-4 py-3 bg-surface-container-low border border-transparent text-on-surface placeholder:text-outline rounded-xl text-body-md focus:bg-surface-container-lowest focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-150 outline-none"
                  />
                </div>
                {errors.email && (
                  <p className="text-error text-xs mt-1.5">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-error-container border border-error/20 rounded-xl px-4 py-3">
                  <span className="material-symbols-outlined text-on-error-container text-base">
                    error
                  </span>
                  <p className="text-body-sm text-on-error-container">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 bg-primary-container hover:bg-primary text-on-primary rounded-xl text-headline-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-primary/20 disabled:opacity-80 disabled:cursor-wait"
              >
                <span className="material-symbols-outlined text-lg">
                  {loading ? "progress_activity" : "send"}
                </span>
                {loading ? "Mengirim..." : "Kirim Instruksi Reset"}
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-body-sm text-primary hover:text-primary-container hover:underline font-medium"
                >
                  Kembali ke Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}