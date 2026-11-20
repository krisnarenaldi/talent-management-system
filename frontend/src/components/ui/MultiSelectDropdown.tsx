"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X, Search } from "lucide-react";

export interface MultiSelectDropdownProps {
  label?: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  className?: string;
  maxHeight?: string;
}

export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = "Semua",
  allLabel = "Semua",
  className = "",
  maxHeight = "max-h-64",
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const selectAll = () => {
    onChange([]);
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAllSelected = selected.length === 0;

  // Determine trigger label
  const getTriggerText = () => {
    if (isAllSelected) return allLabel;
    if (selected.length === 1) return selected[0];
    return `${selected.length} posisi dipilih`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm outline-none transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate text-gray-800 font-normal">
          {getTriggerText()}
        </span>
        <div className="flex items-center gap-1.5 ml-1 flex-shrink-0">
          {!isAllSelected && (
            <span
              role="button"
              tabIndex={0}
              onClick={clearSelection}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange([]);
                }
              }}
              title="Reset ke Semua"
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[220px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1">
          {/* Quick Search if more than 5 options */}
          {options.length > 5 && (
            <div className="relative mb-1.5 px-1 pt-1">
              <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari posisi..."
                className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
          )}

          <div className={`overflow-y-auto ${maxHeight} space-y-0.5`}>
            {/* Option "Semua" */}
            <button
              type="button"
              onClick={selectAll}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
                isAllSelected
                  ? "bg-blue-50 font-semibold text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    isAllSelected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {isAllSelected && <Check className="h-3 w-3 stroke-[3]" />}
                </span>
                <span>{allLabel}</span>
              </span>
            </button>

            {/* List of positions */}
            {filteredOptions.length === 0 ? (
              <div className="py-2 text-center text-xs text-gray-400">
                Tidak ada posisi yang cocok
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isChecked = selected.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleOption(option)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
                      isChecked
                        ? "bg-blue-50 font-semibold text-blue-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                          isChecked
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      </span>
                      <span className="truncate">{option}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer status if items selected */}
          {!isAllSelected && (
            <div className="mt-1.5 border-t border-gray-100 pt-1.5 px-2 flex items-center justify-between text-[11px] text-gray-500">
              <span>{selected.length} dipilih</span>
              <button
                type="button"
                onClick={selectAll}
                className="text-blue-600 hover:underline font-medium"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
