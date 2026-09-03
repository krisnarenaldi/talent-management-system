"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import api from "@/lib/api";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/candidates", icon: "group", label: "Candidates" },
  { href: "/applications", icon: "work", label: "Jobs" },
  { href: "/interviews", icon: "calendar_today", label: "Interviews" },
  { href: "/analytics", icon: "bar_chart", label: "Reports" },
] as const;

const BOTTOM_ITEMS = [
  { href: "/settings", icon: "settings", label: "Settings" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await api.post("/api/v1/auth/logout");
    } catch {
      // ignore
    } finally {
      router.push("/login");
    }
  };

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-surface-container-low border-r border-outline-variant flex flex-col p-stack-md z-50">
      {/* Logo */}
      <div className="flex items-center gap-stack-sm mb-stack-lg">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-sm">
          TF
        </div>
        <div>
          <h1 className="text-headline-sm text-primary font-semibold">
            TalentFlow
          </h1>
          <p className="text-label-sm text-on-surface-variant">
            Enterprise Recruitment
          </p>
        </div>
      </div>

      {/* Main nav */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ease-in-out ${
                active
                  ? "bg-secondary-container text-on-secondary-container font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-2 mt-2 border-t border-outline-variant space-y-1">
          {BOTTOM_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ease-in-out ${
                  active
                    ? "bg-secondary-container text-on-secondary-container font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Add Candidate CTA */}
      <div className="mt-stack-md space-y-2">
        <Link
          href="/candidates/new"
          className="w-full bg-primary hover:bg-primary/90 text-on-primary py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-body-md"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Add Candidate
        </Link>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-highest transition-all duration-200 text-body-md"
        >
          <span className="material-symbols-outlined">logout</span>
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}
