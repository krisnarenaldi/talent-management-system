"use client";

import { useRef, useState } from "react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export default function TagInput({
  value,
  onChange,
  placeholder,
  id,
  disabled = false,
  ariaLabel,
}: TagInputProps) {
  const [pending, setPending] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const trimmed = raw.trim().replace(/,$/, "");
    if (!trimmed) return;
    const exists = value.some((tag) => tag.toLowerCase() === trimmed.toLowerCase());
    if (!exists) onChange([...value, trimmed]);
    setPending("");
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.focus()}
      className={`flex min-h-[42px] flex-wrap items-center gap-2 rounded-lg border border-outline-variant bg-surface px-3 py-2 ${
        disabled ? "opacity-50" : "cursor-text"
      } focus-within:border-primary focus-within:ring-2 focus-within:ring-primary`}
    >
      {value.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(index);
            }}
            disabled={disabled}
            className="ml-0.5 text-on-surface-variant hover:text-error disabled:pointer-events-none"
            aria-label={`Hapus ${tag}`}
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </span>
      ))}
      <input
        id={id}
        ref={inputRef}
        type="text"
        value={pending}
        disabled={disabled}
        onChange={(e) => setPending(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(pending);
          } else if (e.key === "Backspace" && pending === "" && value.length > 0) {
            removeTag(value.length - 1);
          }
        }}
        onBlur={() => addTag(pending)}
        className="min-w-[120px] flex-1 border-none bg-transparent text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant/70 disabled:cursor-not-allowed"
        placeholder={value.length === 0 ? placeholder : "Tambah..."}
        aria-label={ariaLabel}
      />
    </div>
  );
}
