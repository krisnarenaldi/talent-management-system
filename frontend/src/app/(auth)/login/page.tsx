"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const setUser = useAuthStore((state) => state.setUser);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post("/api/v1/auth/login", data);
      setUser({
        name: response.data.name,
        email: response.data.email,
        role: response.data.role,
      });
      setSuccess(true);
      setTimeout(() => {
        router.push(redirectTo);
      }, 800);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Login gagal. Periksa email dan password Anda.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-screen flex flex-col justify-between text-on-surface antialiased">
      {/* Header */}
      <header className="w-full px-8 lg:px-16 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md text-white">
            <span className="material-symbols-outlined text-2xl">dataset</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <span className="text-headline-md font-bold tracking-tight text-on-surface">
              TalentFlow
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container text-primary border border-surface-container-high">
              Enterprise
            </span>
          </div>
        </div>
        <div className="hidden sm:flex items-center space-x-6 text-body-sm font-medium text-on-surface-variant">
          <a className="hover:text-primary transition-colors" href="#">
            Dokumentasi
          </a>
          <a className="hover:text-primary transition-colors" href="#">
            Bantuan Admin
          </a>
          <div className="flex items-center space-x-1.5 cursor-pointer text-on-surface font-semibold pl-2 border-l border-outline-variant">
            <span className="material-symbols-outlined text-base">language</span>
            <span>ID</span>
            <span className="material-symbols-outlined text-xs">expand_more</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="w-full flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-10">
        <div className="w-full max-w-[500px]">
          {/* Card */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xl shadow-primary/5 p-8 sm:p-12 relative overflow-hidden">
            {/* Top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-primary-container to-secondary" />

            {/* Card header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-primary text-xs font-medium mb-3 border border-surface-container">
                <span className="material-symbols-outlined text-sm">
                  verified_user
                </span>
                <span>Portal Akses Terenkripsi</span>
              </div>
              <h1 className="text-headline-lg font-bold tracking-tight text-on-surface">
                Masuk ke Akun Anda
              </h1>
              <p className="text-body-md text-on-surface-variant mt-2">
                Masukkan email dan kata sandi Anda untuk mengakses portal
                TalentFlow.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-label-md text-on-surface mb-2 uppercase tracking-wide font-semibold"
                >
                  Email Kerja / Work Email
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline group-focus-within:text-primary transition-colors">
                    <span className="material-symbols-outlined text-xl">
                      mail
                    </span>
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

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="password"
                    className="block text-label-md text-on-surface uppercase tracking-wide font-semibold"
                  >
                    Kata Sandi / Password
                  </label>
                  <a
                    href="/forgot-password"
                    className="text-body-sm text-primary hover:text-primary-container hover:underline font-medium"
                  >
                    Lupa kata sandi?
                  </a>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline group-focus-within:text-primary transition-colors">
                    <span className="material-symbols-outlined text-xl">
                      lock
                    </span>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    {...register("password")}
                    className="w-full pl-11 pr-11 py-3 bg-surface-container-low border border-transparent text-on-surface placeholder:text-outline rounded-xl text-body-md focus:bg-surface-container-lowest focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-150 outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-outline hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                {errors.password && (
                  <p className="text-error text-xs mt-1.5">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Remember me */}
              <div className="flex items-center space-x-2.5">
                <input
                  type="checkbox"
                  id="remember"
                  defaultChecked
                  className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary focus:ring-offset-0 bg-surface-container-low cursor-pointer"
                />
                <label
                  htmlFor="remember"
                  className="text-body-sm text-on-surface-variant cursor-pointer select-none"
                >
                  Ingat saya untuk 30 hari ke depan
                </label>
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 bg-error-container border border-error/20 rounded-xl px-4 py-3">
                  <span className="material-symbols-outlined text-on-error-container text-base">
                    error
                  </span>
                  <p className="text-body-sm text-on-error-container">{error}</p>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading || success}
                className="w-full py-3.5 px-6 bg-primary-container hover:bg-primary text-on-primary rounded-xl text-headline-sm transition-all duration-200 flex items-center justify-center space-x-2 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.99] cursor-pointer disabled:opacity-80 disabled:cursor-wait"
              >
                {success ? (
                  <>
                    <span className="material-symbols-outlined text-lg">
                      check_circle
                    </span>
                    <span>Berhasil Masuk</span>
                  </>
                ) : loading ? (
                  <>
                    <span className="material-symbols-outlined text-lg animate-spin">
                      progress_activity
                    </span>
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Akun</span>
                    <span className="material-symbols-outlined text-lg">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>
            </form>

            {/* Footer card */}
            <div className="mt-8 pt-6 border-t border-surface-container text-center">
              <p className="text-body-sm text-on-surface-variant">
                Belum memiliki akses atau kendala masuk?
                <a
                  href="#"
                  className="text-primary hover:text-primary-container font-semibold hover:underline ml-1"
                >
                  Hubungi Tim Admin
                </a>
              </p>
            </div>
          </div>

          {/* Trust indicator */}
          <div className="mt-6 flex items-center justify-center space-x-2 text-on-surface-variant text-label-sm text-center">
            <span className="material-symbols-outlined text-base text-primary">
              security
            </span>
            <span>
              Dilindungi oleh Autentikasi Perusahaan &amp; SOC2 Type II
              Certified
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 px-8 lg:px-16 border-t border-surface-container flex flex-col sm:flex-row items-center justify-between gap-4 text-on-surface-variant text-body-sm">
        <div className="flex items-center space-x-2">
          <span>TalentFlow Enterprise Platform</span>
          <span className="text-outline-variant">•</span>
          <span>Hak Cipta © 2024. All rights reserved.</span>
        </div>
        <div className="flex items-center space-x-6">
          <a className="hover:text-on-surface transition-colors" href="#">
            Pusat Bantuan
          </a>
          <a className="hover:text-on-surface transition-colors" href="#">
            Kebijakan Privasi
          </a>
          <a className="hover:text-on-surface transition-colors" href="#">
            Syarat &amp; Ketentuan
          </a>
          <a className="hover:text-on-surface transition-colors" href="#">
            Status Sistem
          </a>
        </div>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
