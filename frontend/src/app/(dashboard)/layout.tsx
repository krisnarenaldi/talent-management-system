"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AuthProvider from "@/components/AuthProvider";
import { useAuthStore } from "@/stores/auth.store";
import api from "@/lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    logout();
    router.replace("/login");
  };

  const initials = (user?.name ?? "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <AuthProvider>
      <div className="flex h-full bg-surface text-on-surface overflow-hidden">
        <Sidebar />

        {/* Content area — offset by sidebar width */}
        <div className="flex-1 flex flex-col ml-64 h-full relative">
          {/* Top header bar */}
          <header className="fixed top-0 right-0 w-[calc(100%-16rem)] h-16 bg-surface border-b border-outline-variant flex items-center justify-between px-container-padding z-40">
            <h2 className="text-headline-md text-on-surface font-semibold hidden md:block">
              Candidate Database
            </h2>
            <div className="flex items-center gap-2 ml-auto">
              <button className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary-container transition-colors" title="Notifications">
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <button className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary-container transition-colors" title="Help">
                <span className="material-symbols-outlined">help</span>
              </button>
              <button className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary-container transition-colors" title="Apps">
                <span className="material-symbols-outlined">apps</span>
              </button>

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
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    {/* Dropdown panel */}
                    <div className="absolute right-0 top-10 w-56 bg-surface border border-outline-variant rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                      <div className="px-4 py-3 border-b border-outline-variant">
                        <p className="text-body-sm text-on-surface font-medium truncate">{user?.name}</p>
                        <p className="text-caption text-on-surface-variant truncate">{user?.email}</p>
                      </div>
                      <Link
                        href="/settings/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-body-sm text-on-surface hover:bg-primary-container hover:text-on-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">person</span>
                        Profile
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-body-sm text-error hover:bg-error-container/20 transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-lg">logout</span>
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Scrollable page content */}
          <main className="flex-1 overflow-y-auto mt-16 bg-surface-bright">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
