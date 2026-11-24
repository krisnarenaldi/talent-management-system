"""Utilitas normalisasi dan pembersihan teks/nama kandidat dan profil."""

import re

# Kata sambung atau partikel nama kecil (bila ada) atau gelar umum
# Tapi untuk nama Indonesia / internasional secara umum, title case kata per kata
# sangat natural bila input aslinya adalah ALL UPPERCASE.


def normalize_name(value: str | None) -> str:
    """Normalisasi nama kandidat / person.

    Aturan:
    - None atau kosong -> ""
    - Strip whitespace di awal dan akhir, serta rapikan spasi ganda di tengah
    - Jika input 100% HURUF KAPITAL SEMUA (ALL CAPS, misal 'BAYU AHMAD PRAKOSO' atau 'DWI IQBAL HASANI'):
      Dikonversi menjadi Title Case ('Bayu Ahmad Prakoso', 'Dwi Iqbal Hasani').
    - Jika input sudah memiliki variasi huruf (Title Case atau Mixed Case, misal 'Destry Hutagaol',
      'McDonald', 'Bunga Athirah Khairunnissa', 'M. Rizky'):
      Dipertahankan kapitalisasi aslinya agar singkatan (M., Dr., dsb) atau casing khusus tidak rusak.
    """
    if not value:
        return ""

    cleaned = " ".join(value.strip().split())
    if not cleaned:
        return ""

    # Cek apakah string hanya berisi huruf kapital (abaikan tanda baca/angka/spasi)
    # str.isupper() di Python bernilai True jika ada setidaknya 1 karakter berhuruf dan semuanya cased UPPER
    if cleaned.isupper():
        return cleaned.title()

    return cleaned
