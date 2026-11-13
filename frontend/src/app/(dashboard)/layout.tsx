"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import AuthProvider from "@/components/AuthProvider";
import TokenRefreshProvider from "@/components/TokenRefreshProvider";
import NotificationBell from "@/components/NotificationBell";
import KeyboardShortcutModal from "@/components/ui/KeyboardShortcutModal";
import QuickCreateMenu from "@/components/ui/QuickCreateMenu";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAuthStore } from "@/stores/auth.store";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import api from "@/lib/api";

function normalizeRole(role: string | undefined): string {
  if (!role) return "";
  return role.split(".").pop()?.toLowerCase() || role;
}

// Route /admin/* yang hanya boleh diakses admin — hr/manager boleh akses clients & positions
const ADMIN_ONLY_ROUTES = [
  "/admin/users",
  "/admin/blacklist-status-types",
  "/admin/agreement-types",
  "/admin/cv-templates",
];

function isAdminOnlyRoute(pathname: string): boolean {
  return ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r));
}

// Routes yang diizinkan untuk PM (hanya blacklist + settings)
const PM_ALLOWED_PREFIXES = ["/blacklist", "/settings"];

function isPMAllowedRoute(pathname: string): boolean {
  return PM_ALLOWED_PREFIXES.some((r) => pathname.startsWith(r));
}

interface PageHeaderInfo {
  title: string;
  description: string;
}

function getHeaderInfo(pathname: string): PageHeaderInfo {
  if (pathname === "/candidates/pending-review") {
    return {
      title: "Log Upload & Ekstraksi CV",
      description: "Riwayat dokumen CV yang diunggah serta status hasil ekstraksi AI.",
    };
  }
  if (pathname === "/candidates/new") {
    return {
      title: "Upload CV Baru",
      description: "Unggah dokumen CV untuk diekstrak otomatis oleh AI ke dalam database.",
    };
  }
  if (pathname === "/candidates/manual/new") {
    return {
      title: "Input Manual Kandidat",
      description: "Pendaftaran data profil kandidat secara manual ke dalam database.",
    };
  }
  if (pathname.startsWith("/candidates/") && pathname.endsWith("/edit")) {
    return {
      title: "Edit Profil Kandidat",
      description: "Perbarui data pribadi, riwayat pengalaman, dan informasi profil kandidat.",
    };
  }
  if (pathname.startsWith("/candidates/") && pathname !== "/candidates") {
    return {
      title: "Detail Profil Kandidat",
      description: "Informasi lengkap, resume, kualifikasi, dan riwayat lamaran kandidat.",
    };
  }
  if (pathname === "/candidates") {
    return {
      title: "Database Kandidat",
      description: "Bank data seluruh profil kandidat dan riwayat CV yang tersimpan.",
    };
  }
  if (pathname.startsWith("/talent-pool")) {
    return {
      title: "Talent Pool",
      description: "Kumpulan talenta terkurasi dan kandidat siap pakai untuk kebutuhan posisi.",
    };
  }
  if (pathname.startsWith("/applications/pending-review")) {
    return {
      title: "Review Ekstraksi Lamaran",
      description: "Verifikasi hasil ekstraksi AI dan evaluasi kelengkapan lamaran per posisi.",
    };
  }
  if (pathname.startsWith("/applications/") && pathname !== "/applications") {
    return {
      title: "Detail Lamaran",
      description: "Proses evaluasi, tahapan pipeline, dan catatan penempatan kandidat.",
    };
  }
  if (pathname === "/applications") {
    return {
      title: "Applications",
      description: "Pelacakan proses seleksi dan pipeline tahapan lamaran kerja kandidat.",
    };
  }
  if (pathname.startsWith("/employees")) {
    return {
      title: "Data Karyawan",
      description: "Pengelolaan data karyawan aktif, riwayat penempatan, dan kontrak kerja.",
    };
  }
  if (pathname.startsWith("/blacklist")) {
    return {
      title: "Blacklist",
      description: "Daftar kandidat yang diblokir beserta riwayat dan catatan penolakan.",
    };
  }
  if (pathname.startsWith("/analytics")) {
    return {
      title: "Analytics & Reports",
      description: "Laporan analitik rekrutmen, performa tim, dan metrik konversi kandidat.",
    };
  }
  if (pathname.startsWith("/search")) {
    return {
      title: "AI Talent Search",
      description: "Pencarian pintar berbasis AI untuk mencocokkan profil dan keahlian talenta.",
    };
  }
  if (pathname.startsWith("/admin/clients")) {
    return {
      title: "Manajemen Klien",
      description: "Master data perusahaan rekanan, PIC, dan kebutuhan rekrutmen klien.",
    };
  }
  if (pathname.startsWith("/admin/positions")) {
    return {
      title: "Lowongan Posisi",
      description: "Manajemen lowongan pekerjaan yang dibuka untuk masing-masing klien.",
    };
  }
  if (pathname.startsWith("/admin/blacklist-status-types")) {
    return {
      title: "Master Status Blacklist",
      description: "Pengaturan master kategori dan alasan penetapan status blacklist.",
    };
  }
  if (pathname.startsWith("/admin/agreement-types")) {
    return {
      title: "Master Tipe Perjanjian",
      description: "Pengaturan jenis kontrak kerja dan perjanjian penempatan karyawan.",
    };
  }
  if (pathname.startsWith("/admin/users")) {
    return {
      title: "Manajemen Pengguna",
      description: "Pengelolaan akun tim, peran akses (Admin, HR, Manager, PM), dan hak sistem.",
    };
  }
  if (pathname.startsWith("/settings")) {
    return {
      title: "Pengaturan",
      description: "Konfigurasi preferensi sistem dan profil pengguna.",
    };
  }
  if (pathname === "/dashboard" || pathname === "/") {
    return {
      title: "Dashboard",
      description: "Ringkasan metrik rekrutmen, aktivitas tim, dan statistik kandidat.",
    };
  }

  return {
    title: "TalentFlow",
    description: "Sistem Manajemen Talenta & Rekrutmen Terpadu.",
  };
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAdmin = normalizeRole(user?.role) === "admin";
  const isPM = normalizeRole(user?.role) === "pm";
  const { collapsed } = useSidebar();
  const headerInfo = getHeaderInfo(pathname);

  useKeyboardShortcuts(shortcutModalOpen, setShortcutModalOpen);

  useEffect(() => {
    if (!authLoading && user && isAdminOnlyRoute(pathname) && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [authLoading, isAdmin, pathname, router, user]);

  // PM hanya boleh akses /blacklist dan /settings
  useEffect(() => {
    if (!authLoading && user && isPM && !isPMAllowedRoute(pathname)) {
      router.replace("/blacklist");
    }
  }, [authLoading, isPM, pathname, router, user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    try {
      await api.post("/api/v1/auth/logout");
    } catch {
      // ignore
    }
    queryClient.clear();
    logout();
    router.replace("/login");
  };

  const initials = (user?.name ?? "")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isUnauthorizedAdminRoute =
    !authLoading && isAdminOnlyRoute(pathname) && !isAdmin && !isPM;

  return (
    <>
      <div className="flex h-full bg-surface text-on-surface">
        <Sidebar />

        {/* Content area — smoothly transitions padding/margin when sidebar collapses */}
        <div
          className={`flex-1 flex flex-col h-full relative transition-[margin-left] duration-300 ease-in-out ${
            collapsed ? "ml-16" : "ml-64"
          }`}
        >
          {/* Top header bar */}
          <header
            className={`fixed top-0 right-0 h-16 bg-surface border-b border-outline-variant flex items-center justify-between px-container-padding z-40 transition-[width] duration-300 ease-in-out ${
              collapsed ? "w-[calc(100%-4rem)]" : "w-[calc(100%-16rem)]"
            }`}
          >
            <div className="hidden md:flex flex-col justify-center min-w-0 pr-4">
              <h2 className="text-base lg:text-lg font-bold text-on-surface leading-tight truncate">
                {headerInfo.title}
              </h2>
              <p className="text-xs text-on-surface-variant leading-tight truncate mt-0.5">
                {headerInfo.description}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <NotificationBell />
              <button
                onClick={() => setShortcutModalOpen((v) => !v)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary-container transition-colors"
                title="Keyboard shortcuts (?)"
              >
                <span className="material-symbols-outlined">help</span>
              </button>
              <div className="relative">
                <button
                  onClick={() => setQuickMenuOpen((v) => !v)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary-container transition-colors"
                  title="Akses cepat"
                >
                  <span className="material-symbols-outlined">apps</span>
                </button>
                <QuickCreateMenu
                  isOpen={quickMenuOpen}
                  onClose={() => setQuickMenuOpen(false)}
                />
              </div>

              {/* User dropdown */}
              <div className="relative ml-2" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container text-xs font-semibold border border-outline-variant hover:border-primary transition-colors select-none"
                  title="Profile & settings"
                >
                  {initials || "?"}
                </button>

                {menuOpen && (
                  <>
                    {/* Backdrop overlay */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setMenuOpen(false)}
                    />
                    {/* Dropdown panel */}
                    <div className="absolute right-0 top-10 w-56 bg-surface border border-outline-variant rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                      <div className="px-4 py-3 border-b border-outline-variant">
                        <p className="text-body-sm text-on-surface font-medium truncate">
                          {user?.name}
                        </p>
                        <p className="text-caption text-on-surface-variant truncate">
                          {user?.email}
                        </p>
                      </div>
                      <Link
                        href="/settings"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-body-sm text-on-surface hover:bg-primary-container hover:text-on-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">
                          person
                        </span>
                        Profile
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-body-sm text-error hover:bg-error-container/20 transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-lg">
                          logout
                        </span>
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Scrollable page content */}
          <main className="flex-1 overflow-y-auto overflow-x-auto mt-16 bg-surface-bright px-container-padding">
            {isUnauthorizedAdminRoute ? (
              <div className="p-container-padding">
                <div className="max-w-2xl mx-auto bg-error-container border border-error/20 rounded-xl px-4 py-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-on-error-container">
                    lock
                  </span>
                  <p className="text-body-sm text-on-error-container">
                    Akses ditolak. Hanya Admin yang dapat mengakses halaman ini.
                  </p>
                </div>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>

      <KeyboardShortcutModal
        isOpen={shortcutModalOpen}
        onClose={() => setShortcutModalOpen(false)}
      />
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TokenRefreshProvider>
      <AuthProvider>
        <SidebarProvider>
          <DashboardContent>{children}</DashboardContent>
        </SidebarProvider>
      </AuthProvider>
    </TokenRefreshProvider>
  );
}
