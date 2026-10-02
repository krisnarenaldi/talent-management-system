"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";

interface Action {
  label: string;
  href: string;
  icon: string;
  roles: string[];
}

const ACTIONS: Action[] = [
  {
    label: "Kandidat Baru",
    href: "/candidates/new",
    icon: "person_add",
    roles: ["hr", "manager", "admin"],
  },
  {
    label: "Lamaran Baru",
    href: "/applications/new",
    icon: "work",
    roles: ["hr", "manager", "admin"],
  },
  {
    label: "Blacklist Baru",
    href: "/blacklist/new",
    icon: "gavel",
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
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside the popover
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const visibleActions = ACTIONS.filter((action) =>
    isRole(...action.roles)
  );

  return (
    <div
      ref={ref}
      className="absolute right-0 top-10 z-50 bg-surface border border-outline-variant rounded-xl shadow-lg p-4 w-56"
    >
      <p className="text-body-sm font-medium text-on-surface-variant mb-3">
        Akses Cepat
      </p>

      {visibleActions.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant text-center py-2">
          Tidak ada aksi tersedia
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {visibleActions.map((action) => (
            <button
              key={action.href}
              onClick={() => {
                router.push(action.href);
                onClose();
              }}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-primary-container hover:text-on-primary-container transition-colors text-center text-on-surface"
            >
              <span className="material-symbols-outlined text-2xl">
                {action.icon}
              </span>
              <span className="text-label-sm leading-tight">{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
