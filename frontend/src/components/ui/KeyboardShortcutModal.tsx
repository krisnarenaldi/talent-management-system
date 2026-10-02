"use client";

interface Shortcut {
  key: string;
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { key: "?", description: "Tampilkan/sembunyikan shortcut ini" },
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
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Panel — stop propagation so clicks inside don't close the modal */}
      <div
        className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-6 relative mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <h2 className="text-headline-md font-semibold text-on-surface mb-4">
          Keyboard Shortcuts
        </h2>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors text-xl leading-none"
          aria-label="Tutup"
        >
          ×
        </button>

        {/* Shortcut grid — 2 columns */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {SHORTCUTS.map(({ key, description }) => (
            <div key={key} className="flex items-center gap-2">
              <kbd className="inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded bg-surface-container-high border border-outline-variant text-body-sm font-mono text-on-surface shrink-0">
                {key}
              </kbd>
              <span className="text-body-sm text-on-surface-variant">
                {description}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
