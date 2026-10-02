"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Global keyboard shortcut handler.
 * - Ignores events when the target is an editable element or when a modifier key is held.
 * - `?` toggles the shortcut-help modal.
 * - `Escape` closes the modal.
 * - Single-letter keys navigate to common routes.
 */
export function useKeyboardShortcuts(
  isModalOpen: boolean,
  setIsModalOpen: (v: boolean) => void
): void {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when modifier keys are held
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Ignore when focus is inside an editable element
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case "?":
          setIsModalOpen(!isModalOpen);
          break;
        case "Escape":
          setIsModalOpen(false);
          break;
        case "c":
          router.push("/candidates/new");
          break;
        case "b":
          router.push("/blacklist/new");
          break;
        case "a":
          router.push("/applications/new");
          break;
        case "e":
          router.push("/employees");
          break;
        case "d":
          router.push("/dashboard");
          break;
        case "l":
          router.push("/blacklist");
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, setIsModalOpen, router]);
}
