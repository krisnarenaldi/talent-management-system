"use client";

/**
 * Pagination component — shows numbered page buttons with < > arrows.
 *
 * Usage (with known totalPages):
 *   <Pagination currentPage={3} totalPages={9} onPageChange={setCurrentPage} />
 *
 * Usage (unknown total — use hasNextPage):
 *   <Pagination currentPage={2} totalPages={null} hasNextPage={items.length === pageSize} onPageChange={setCurrentPage} />
 *
 * When totalPages is null the component falls back to minimal prev/[n]/next mode.
 */

import React from "react";

interface PaginationProps {
  currentPage: number;
  /** Pass null when total page count is unknown (server doesn't return total). */
  totalPages: number | null;
  onPageChange: (page: number) => void;
  /** Used only when totalPages is null: whether a next page exists. */
  hasNextPage?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Returns an array of page numbers / "…" ellipsis markers to render. */
function buildPageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "…")[] = [];

  // Always show first page
  pages.push(1);

  if (current > 4) {
    pages.push("…");
  }

  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 3) {
    pages.push("…");
  }

  // Always show last page
  pages.push(total);

  return pages;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  hasNextPage,
  disabled = false,
  className = "",
}: PaginationProps) {
  const isFirst = currentPage === 1;
  const isLast =
    totalPages !== null ? currentPage >= totalPages : !hasNextPage;

  const btnBase =
    "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-sm font-medium transition-colors focus:outline-none";
  const btnActive =
    "bg-blue-600 text-white hover:bg-blue-700";
  const btnInactive =
    "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50";
  const btnDisabled =
    "opacity-40 cursor-not-allowed pointer-events-none";
  const btnArrow =
    "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50";

  if (totalPages !== null) {
    const window = buildPageWindow(currentPage, totalPages);

    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {/* Prev */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={isFirst || disabled}
          aria-label="Halaman sebelumnya"
          className={`${btnBase} ${btnArrow} ${isFirst || disabled ? btnDisabled : ""}`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Page numbers */}
        {window.map((item, idx) =>
          item === "…" ? (
            <span
              key={`ellipsis-${idx}`}
              className="inline-flex h-8 min-w-[2rem] items-center justify-center text-sm text-gray-400 select-none"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item as number)}
              disabled={disabled}
              aria-label={`Halaman ${item}`}
              aria-current={item === currentPage ? "page" : undefined}
              className={`${btnBase} ${
                item === currentPage ? btnActive : btnInactive
              } ${disabled ? btnDisabled : ""}`}
            >
              {item}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={isLast || disabled}
          aria-label="Halaman selanjutnya"
          className={`${btnBase} ${btnArrow} ${isLast || disabled ? btnDisabled : ""}`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    );
  }

  // ── Fallback: unknown totalPages ──────────────────────────────────────────
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* Prev */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isFirst || disabled}
        aria-label="Halaman sebelumnya"
        className={`${btnBase} ${btnArrow} ${isFirst || disabled ? btnDisabled : ""}`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Show first page link if we're deep */}
      {currentPage > 2 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            disabled={disabled}
            aria-label="Halaman 1"
            className={`${btnBase} ${btnInactive} ${disabled ? btnDisabled : ""}`}
          >
            1
          </button>
          {currentPage > 3 && (
            <span className="inline-flex h-8 min-w-[2rem] items-center justify-center text-sm text-gray-400 select-none">
              …
            </span>
          )}
        </>
      )}

      {/* Previous page number */}
      {currentPage > 1 && (
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disabled}
          aria-label={`Halaman ${currentPage - 1}`}
          className={`${btnBase} ${btnInactive} ${disabled ? btnDisabled : ""}`}
        >
          {currentPage - 1}
        </button>
      )}

      {/* Current page */}
      <button
        disabled
        aria-current="page"
        className={`${btnBase} ${btnActive}`}
      >
        {currentPage}
      </button>

      {/* Next page (if has more) */}
      {hasNextPage && (
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={disabled}
          aria-label={`Halaman ${currentPage + 1}`}
          className={`${btnBase} ${btnInactive} ${disabled ? btnDisabled : ""}`}
        >
          {currentPage + 1}
        </button>
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isLast || disabled}
        aria-label="Halaman selanjutnya"
        className={`${btnBase} ${btnArrow} ${isLast || disabled ? btnDisabled : ""}`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
