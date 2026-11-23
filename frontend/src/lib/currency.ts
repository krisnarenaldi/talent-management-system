/**
 * Helper format & parse nilai Rupiah untuk input form.
 * Format tampilan memakai gaya Indonesia (titik sebagai pemisah ribuan).
 */

export function formatRupiah(value: number | string): string {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "";
  return Math.round(num).toLocaleString("id-ID");
}

/**
 * Parse teks input Rupiah ("Rp 15.000.000", "15000000") menjadi angka.
 * Mengembalikan undefined bila teks tidak mengandung digit.
 */
export function parseRupiah(text: string): number | undefined {
  const digits = (text ?? "").replace(/[^0-9]/g, "");
  if (!digits) return undefined;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Format rentang gaji (range atau nilai tunggal).
 * Contoh:
 *   - formatSalaryRange(9400000, 10000000) -> "Rp 9.400.000 - 10.000.000"
 *   - formatSalaryRange(10000000) -> "Rp 10.000.000"
 */
export function formatSalaryRange(
  min?: number | string | null,
  max?: number | string | null,
  prefix = "Rp "
): string {
  if (min == null && max == null) return "-";

  const minNum = min != null && min !== "" && !isNaN(Number(min)) ? Number(min) : null;
  const maxNum = max != null && max !== "" && !isNaN(Number(max)) ? Number(max) : null;

  if (minNum != null && maxNum != null && minNum !== maxNum) {
    return `${prefix}${minNum.toLocaleString("id-ID")} - ${maxNum.toLocaleString("id-ID")}`;
  }
  if (minNum != null) {
    return `${prefix}${minNum.toLocaleString("id-ID")}`;
  }
  if (maxNum != null) {
    return `${prefix}${maxNum.toLocaleString("id-ID")}`;
  }
  return "-";
}
