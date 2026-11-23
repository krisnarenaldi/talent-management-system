import re
from decimal import Decimal
from typing import Tuple, Optional, Any


def _clean_number_string(val_str: str) -> Optional[Decimal]:
    """
    Membersihkan string angka mata uang ke Decimal.
    Mendukung format:
      - 10000000
      - 10.000.000
      - Rp 10.000.000
      - 10,000,000
    """
    if not val_str:
        return None
    cleaned = re.sub(r"(?i)rp|idr|\s+", "", str(val_str)).strip()
    if not cleaned:
        return None

    # Handle kombinasi titik dan koma
    if "." in cleaned and "," in cleaned:
        # Format Indonesia: 10.000.000,00 -> buang titik, ganti koma ke titik
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "." in cleaned:
        parts = cleaned.split(".")
        # Jika bagian setelah titik adalah 3 digit (pemisah ribuan), buang titik
        if all(len(p) == 3 for p in parts[1:]):
            cleaned = "".join(parts)
        else:
            cleaned = cleaned.replace(".", "")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", "")

    # Ambil angka dan desimal saja
    digits_only = re.sub(r"[^\d.]", "", cleaned)
    if not digits_only:
        return None
    try:
        return Decimal(digits_only)
    except Exception:
        return None


def parse_salary_range(value: Any) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    """
    Parse input gaji dari user (angka tunggal atau range).
    Returns: (min_salary, max_salary)
    
    Examples:
      - 10000000 -> (Decimal('10000000'), None)
      - "10000000" -> (Decimal('10000000'), None)
      - "9400000 - 10000000" -> (Decimal('9400000'), Decimal('10000000'))
      - "Rp 9.400.000 - Rp 10.000.000" -> (Decimal('9400000'), Decimal('10000000'))
      - "9.400.000-10.000.000" -> (Decimal('9400000'), Decimal('10000000'))
      - "10000000 s/d 12000000" -> (Decimal('10000000'), Decimal('12000000'))
      - None / "" -> (None, None)
    """
    if value is None:
        return (None, None)

    if isinstance(value, (int, float, Decimal)):
        try:
            return (Decimal(str(value)), None)
        except Exception:
            return (None, None)

    val_str = str(value).strip()
    if not val_str:
        return (None, None)

    # Deteksi pemisah range: ' - ', '-', ' sampai ', ' s/d ', ' sd '
    range_match = re.split(r"\s*-\s*|\s+(?:sampai|s/d|sd|to)\s+", val_str, flags=re.IGNORECASE)
    
    if len(range_match) >= 2:
        min_part = range_match[0].strip()
        max_part = range_match[1].strip()
        min_val = _clean_number_string(min_part)
        max_val = _clean_number_string(max_part)
        
        if min_val is not None and max_val is not None:
            # Pastikan min <= max jika terbalik
            if min_val > max_val:
                min_val, max_val = max_val, min_val
            return (min_val, max_val)
        elif min_val is not None:
            return (min_val, None)
        elif max_val is not None:
            return (max_val, None)

    # Jika bukan range, parse sebagai angka tunggal
    single_val = _clean_number_string(val_str)
    return (single_val, None)
