/**
 * Normalisasi nomor HP ke format 08xxx (hanya digit).
 *
 * Dipakai oleh: client PIC, kandidat, employee, dan modul lain yang
 * menyimpan nomor HP. Menjamin format penyimpanan seragam.
 *
 * Aturan:
 * - kosong → "" (string kosong)
 * - Strip semua karakter non-digit (spasi, +, -, (), huruf, dll.)
 * - 62xxx → 08xxx (kode negara Indonesia → leading 0)
 * - 8xxx  → 08xxx (tambah leading 0)
 * - Nomor lain (bukan 62/8/0) → digit saja, tanpa perubahan prefix
 */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return "";
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("62")) return "0" + digits.slice(2);
  if (digits.startsWith("8")) return "0" + digits;
  return digits;
}
