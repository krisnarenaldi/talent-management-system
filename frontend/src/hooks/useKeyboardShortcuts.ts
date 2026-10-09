"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const NAVIGATION_SHORTCUTS: Record<string, string> = {
  c: "/candidates/new",
  b: "/blacklist/new",
  a: "/applications/new",
  e: "/employees",
  d: "/dashboard",
  l: "/blacklist",
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as HTMLElement;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(
  isModalOpen: boolean,
  setIsModalOpen: (v: boolean) => void
): void {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in form fields
      if (isTypingTarget(e.target)) return;
      // Ignore when modifier keys are held
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key;

      if (key === "?") {
        e.preventDefault();
        setIsModalOpen(!isModalOpen);
        return;
      }

      if (key === "Escape") {
        if (isModalOpen) {
          e.preventDefault();
          setIsModalOpen(false);
        }
        return;
      }

      // Navigation shortcuts — only when modal is closed
      if (!isModalOpen) {
        const path = NAVIGATION_SHORTCUTS[key.toLowerCase()];
        if (path) {
          e.preventDefault();
          router.push(path);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, setIsModalOpen, router]);
}
