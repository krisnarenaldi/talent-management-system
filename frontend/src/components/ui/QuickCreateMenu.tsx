"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";

interface QuickAction {
  label: string;
  icon: string;
  href: string;
  roles: string[];
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Kandidat Baru",
    icon: "person_add",
    href: "/candidates/new",
    roles: ["hr", "manager", "admin"],
  },
  {
    label: "Lamaran Baru",
    icon: "work",
    href: "/applications/new",
    roles: ["hr", "manager", "admin"],
  },
  {
    label: "Blacklist Baru",
    icon: "gavel",
    href: "/blacklist/new",
    roles: ["hr", "manager", "admin", "pm"],
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickCreateMenu({ isOpen, onClose }: Props) {
  const router = useRouter();
  const isRole = useAuthStore((s) => s.isRole);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const visibleActions = QUICK_ACTIONS.filter((action) =>
    action.roles.some((role) => isRole(role as Parameters<typeof isRole>[0]))
  );

  const handleNavigate = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <div
      ref={wrapperRef}
      className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-outline-variant bg-surface p-4 shadow-lg"
    >
      <p className="mb-3 text-body-sm font-medium text-on-surface-variant">
        Akses Cepat
      </p>
      <div className="grid grid-cols-2 gap-2">
        {visibleActions.map((action) => (
          <button
            key={action.href}
            type="button"
            onClick={() => handleNavigate(action.href)}
            className="flex flex-col items-center gap-1.5 rounded-xl p-3 text-center text-on-surface transition-colors hover:bg-primary-container hover:text-on-primary-container"
          >
            <span className="material-symbols-outlined text-2xl">
              {action.icon}
            </span>
            <span className="text-label-sm leading-tight">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
