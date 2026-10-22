"""Utilitas normalisasi nomor telepon — shared untuk semua modul.

Dipakai oleh: client PIC, kandidat, employee, dan modul lain yang menyimpan
nomor HP. Menjamin format penyimpanan seragam 08xxx (hanya digit).
"""

import re

# Pola validasi nomor HP setelah normalisasi:
# hanya digit, diawali 0, panjang 9-15 digit (format 08xxx Indonesia).
PHONE_PATTERN = re.compile(r"^0\d{8,14}$")


def normalize_phone(value: str | None) -> str:
    """Normalisasi nomor HP ke format 08xxx (hanya digit).

    Aturan:
    - None / kosong → "" (string kosong)
    - Strip semua karakter non-digit (spasi, +, -, (), huruf, dll.)
    - 62xxx → 08xxx (kode negara Indonesia → leading 0)
    - 8xxx  → 08xxx (tambah leading 0)
    - Nomor lain (bukan 62/8/0) → digit saja, tanpa perubahan prefix
    """
    if not value:
        return ""
    digits = re.sub(r"\D", "", value)
    if digits.startswith("62"):
        digits = "0" + digits[2:]
    elif digits.startswith("8"):
        digits = "0" + digits
    return digits


def phone_variants(value: str | None) -> list[str]:
    """Daftar varian penyimpanan nomor HP untuk query backward-compat.

    Menghasilkan semua kemungkinan format yang mungkin tersimpan di database
    untuk satu nomor, sehingga query bisa match data lama maupun baru.

    Contoh:
      "081234567890"   → ["081234567890", "+6281234567890"]
      "+62 812-3456"   → ["08123456",    "+628123456"]
      "+1-650-5551234" → ["16505551234", "+16505551234"]
    """
    norm = normalize_phone(value)
    if not norm:
        return []
    variants: list[str] = [norm]
    if norm.startswith("0"):
        # Varian +62 untuk data lama yang disimpan dengan kode negara
        variants.append("+62" + norm[1:])
    else:
        # Nomor asing — tambahkan varian dengan + prefix
        variants.append("+" + norm)
    return variants
