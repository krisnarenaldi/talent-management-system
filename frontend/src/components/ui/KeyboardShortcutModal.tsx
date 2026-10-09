"use client";

interface ShortcutRow {
  key: string;
  description: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { key: "?", description: "Tampilkan/sembunyikan shortcut" },
  { key: "Esc", description: "Tutup modal" },
  { key: "C", description: "Kandidat baru" },
  { key: "B", description: "Blacklist baru" },
  { key: "A", description: "Lamaran baru" },
  { key: "E", description: "Daftar karyawan" },
  { key: "D", description: "Dashboard" },
  { key: "L", description: "Daftar blacklist" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          aria-label="Tutup"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* Title */}
        <h2 className="text-headline-md font-semibold text-on-surface mb-1">
          Keyboard Shortcuts
        </h2>
        <p className="text-body-sm text-on-surface-variant mb-5">
          Navigasi cepat tanpa menyentuh mouse
        </p>

        {/* Shortcut grid */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SHORTCUTS.map(({ key, description }) => (
            <div
              key={key}
              className="flex items-center gap-3 rounded-xl bg-surface-container px-3 py-2.5"
            >
              <kbd className="inline-flex min-w-[2rem] items-center justify-center rounded border border-outline-variant bg-surface px-1.5 py-0.5 font-mono text-body-sm text-on-surface shadow-sm">
                {key}
              </kbd>
              <span className="text-body-sm text-on-surface-variant">
                {description}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-label-sm text-on-surface-variant">
          Shortcut tidak aktif saat mengetik di form
        </p>
      </div>
    </div>
  );
}
