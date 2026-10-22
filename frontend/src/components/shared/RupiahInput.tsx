"use client";

import { useEffect, useState } from "react";

import { formatRupiah, parseRupiah } from "@/lib/currency";

interface RupiahInputProps {
  value?: number | string | null;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}

/**
 * Input nominal Rupiah dengan pemformatan ribuan gaya Indonesia.
 * Nilai internal tetap berupa angka (number) agar siap dikirim ke API.
 */
export default function RupiahInput({
  value,
  onChange,
  placeholder,
  id,
  disabled = false,
}: RupiahInputProps) {
  const [text, setText] = useState(() =>
    value !== undefined && value !== null ? formatRupiah(value) : ""
  );

  // Sinkronkan ketika nilai diubah dari luar (mis. hasil ekstraksi AI).
  useEffect(() => {
    setText((prev) => {
      const prevValue = parseRupiah(prev);
      const nextValue = value ?? undefined;
      if (prevValue === nextValue) return prev;
      return nextValue === undefined ? "" : formatRupiah(nextValue);
    });
  }, [value]);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "");
    setText(digits ? formatRupiah(Number(digits)) : "");
    onChange(digits ? Number(digits) : undefined);
  };

  return (
    <div
      className={`flex items-center rounded-lg border border-outline-variant bg-surface transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <span className="pl-3 pr-1 text-body-sm text-on-surface-variant">Rp</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent px-2 py-2 text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant/70 disabled:cursor-not-allowed"
      />
    </div>
  );
}
