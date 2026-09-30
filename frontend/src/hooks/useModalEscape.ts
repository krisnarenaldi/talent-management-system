import { useEffect } from "react";

/**
 * Menutup modal saat user menekan tombol Escape.
 * @param onClose - fungsi penutup modal
 * @param enabled - (opsional) nonaktifkan hook saat aksi sedang berjalan (isPending/isSubmitting)
 */
export function useModalEscape(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, enabled]);
}
