import { useEffect, useRef } from "react";

/**
 * Menutup modal saat user menekan tombol Escape.
 * @param onClose - fungsi penutup modal
 * @param enabled - (opsional) nonaktifkan hook saat aksi sedang berjalan (isPending/isSubmitting)
 */
export function useModalEscape(onClose: () => void, enabled = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
