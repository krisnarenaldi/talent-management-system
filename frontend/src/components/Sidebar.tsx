"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { useSidebar } from "@/contexts/SidebarContext";
import SidebarTooltip from "@/components/SidebarTooltip";

interface NavItem {
  href: string;
  icon: string;
  label: string;
  description?: string;
}

// Distinct, non-confusing icons with descriptive tooltips
const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard", description: "Ringkasan metrik & aktivitas" },
  { href: "/candidates", icon: "groups", label: "Database", description: "Database semua profil kandidat" },
  { href: "/talent-pool", icon: "folder_special", label: "Talent Pool", description: "Kumpulan talenta terkurasi" },
  { href: "/applications", icon: "assignment", label: "Applications", description: "Status lamaran & pipeline" },
  { href: "/employees", icon: "badge", label: "Employees", description: "Karyawan aktif & kontrak" },
  { href: "/blacklist", icon: "block", label: "Blacklist", description: "Daftar hitam & catatan penolakan" },
];

const SIDEBAR_MANAGER_ADMIN_ITEMS: NavItem[] = [
  { href: "/analytics", icon: "bar_chart", label: "Reports", description: "Laporan analitik & konversi" },
];

const SIDEBAR_MANAGER_ITEMS: NavItem[] = [
  { href: "/search", icon: "auto_awesome", label: "AI Search", description: "Pencarian pintar berbasis AI" },
];

const SIDEBAR_ADMIN_ITEMS: NavItem[] = [
  { href: "/admin/clients", icon: "domain", label: "Clients", description: "Manajemen perusahaan klien" },
  { href: "/admin/positions", icon: "work_outline", label: "Positions", description: "Lowongan posisi kerja" },
  { href: "/admin/blacklist-status-types", icon: "gavel", label: "Blacklist Statuses", description: "Master status blacklist" },
  { href: "/admin/agreement-types", icon: "description", label: "Agreement Types", description: "Tipe perjanjian & kontrak" },
  { href: "/admin/users", icon: "manage_accounts", label: "Users", description: "Manajemen user & role sistem" },
];

const SIDEBAR_BOTTOM_ITEMS: NavItem[] = [
  { href: "/settings", icon: "settings", label: "Settings", description: "Pengaturan sistem & preferensi" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isRole = useAuthStore((state) => state.isRole);
  const isPM = isRole("pm");
  const { collapsed, toggleSidebar } = useSidebar();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const renderLink = (item: NavItem) => {
    const active = isActive(item.href);

    return (
      <SidebarTooltip
        key={item.href}
        label={item.label}
        description={item.description}
        show={collapsed}
      >
        <Link
          href={item.href}
          aria-label={item.label}
          className={`flex items-center rounded-lg transition-all duration-200 ease-in-out w-full ${
            collapsed
              ? "justify-center p-2.5"
              : "gap-3 px-3 py-2"
          } ${
            active
              ? "bg-secondary-container text-on-secondary-container font-semibold"
              : "text-on-surface-variant hover:bg-surface-container-highest"
          }`}
        >
          <span
            className={`material-symbols-outlined shrink-0 text-[22px] ${
              active ? "text-primary" : ""
            }`}
          >
            {item.icon}
          </span>
          {!collapsed && (
            <span className="truncate text-body-md">{item.label}</span>
          )}
        </Link>
      </SidebarTooltip>
    );
  };

  return (
    <aside
      aria-label="Sidebar navigation"
      className={`fixed left-0 top-0 h-full bg-surface-container-low border-r border-outline-variant flex flex-col z-50 transition-all duration-300 ease-in-out ${
        collapsed ? "w-16 px-2 py-4" : "w-64 p-stack-md"
      }`}
    >
      {/* Header: Logo + Toggle button */}
      <div
        className={`flex items-center mb-stack-lg transition-all duration-300 ${
          collapsed ? "justify-center relative" : "justify-between"
        }`}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-stack-sm overflow-hidden group"
          title="TalentFlow"
        >
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-sm shrink-0 shadow-sm group-hover:scale-105 transition-transform">
            TF
          </div>
          {!collapsed && (
            <div className="overflow-hidden transition-opacity duration-200">
              <h1 className="text-headline-sm text-primary font-semibold leading-tight truncate">
                TalentFlow
              </h1>
              <p className="text-label-sm text-on-surface-variant leading-none truncate">
                Enterprise Recruitment
              </p>
            </div>
          )}
        </Link>

        {/* Toggle Collapse Button */}
        <SidebarTooltip
          label={collapsed ? "Perluas Sidebar" : "Perkecil Sidebar"}
          show={collapsed}
        >
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Perluas Sidebar" : "Perkecil Sidebar"}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest hover:text-primary transition-colors ${
              collapsed ? "mt-3 w-8 h-8 bg-surface-container border border-outline-variant/60 shadow-xs" : ""
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {collapsed ? "chevron_right" : "chevron_left"}
            </span>
          </button>
        </SidebarTooltip>
      </div>

      {/* Main nav items */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-1 scrollbar-hide py-1">
        {/* PM: only shows Blacklist */}
        {isPM ? (
          <>
            {!collapsed ? (
              <p className="px-3 text-label-xs text-on-surface-variant/50 uppercase tracking-wider mb-1">
                Monitoring Outsource
              </p>
            ) : (
              <div className="my-2 border-t border-outline-variant/40" />
            )}
            {renderLink({
              href: "/blacklist",
              icon: "block",
              label: "Blacklist",
              description: "Daftar blacklist kandidat",
            })}
          </>
        ) : (
          <>
            {SIDEBAR_NAV_ITEMS.map((item) => renderLink(item))}

            {/* AI Search & Analytics — Manager & Admin */}
            {isRole("admin", "manager") && (
              <div className="pt-2 mt-2 border-t border-outline-variant/60 space-y-1">
                {!collapsed && (
                  <p className="px-3 text-label-xs text-on-surface-variant/50 uppercase tracking-wider">
                    Admin &amp; Manager
                  </p>
                )}
                {SIDEBAR_MANAGER_ITEMS.map((item) => renderLink(item))}
                {SIDEBAR_MANAGER_ADMIN_ITEMS.map((item) => renderLink(item))}
              </div>
            )}

            {/* HR & Manager items */}
            {isRole("hr", "manager") && (
              <div className="pt-2 mt-2 border-t border-outline-variant/60 space-y-1">
                {!collapsed && (
                  <p className="px-3 text-label-xs text-on-surface-variant/50 uppercase tracking-wider">
                    HR &amp; Manager
                  </p>
                )}
                {SIDEBAR_ADMIN_ITEMS.slice(0, 2).map((item) => renderLink(item))}
              </div>
            )}

            {/* Full Admin items */}
            {isRole("admin") && (
              <div className="pt-2 mt-2 border-t border-outline-variant/60 space-y-1">
                {!collapsed && (
                  <p className="px-3 text-label-xs text-on-surface-variant/50 uppercase tracking-wider">
                    Admin
                  </p>
                )}
                {SIDEBAR_ADMIN_ITEMS.map((item) => renderLink(item))}
              </div>
            )}

            {/* Bottom items: Settings */}
            <div className="pt-2 mt-2 border-t border-outline-variant/60 space-y-1">
              {SIDEBAR_BOTTOM_ITEMS.map((item) => renderLink(item))}
            </div>
          </>
        )}
      </div>

      {/* Add Candidate CTA Button — hidden for PM */}
      {!isPM && (
        <div className="mt-stack-md pt-2">
          <SidebarTooltip
            label="Add Candidate"
            description="Tambah kandidat baru"
            show={collapsed}
          >
            <Link
              href="/candidates/new"
              aria-label="Add Candidate"
              className={`w-full bg-primary hover:bg-primary/90 text-on-primary rounded-lg font-medium transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow active:scale-[0.98] ${
                collapsed ? "h-10 p-0" : "py-2 gap-2 text-body-md"
              }`}
            >
              <span className="material-symbols-outlined text-lg">add</span>
              {!collapsed && <span>Add Candidate</span>}
            </Link>
          </SidebarTooltip>
        </div>
      )}
    </aside>
  );
}
