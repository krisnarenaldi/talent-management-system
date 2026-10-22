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
