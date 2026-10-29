import re
from datetime import date

MONTHS = {
    "jan": 1, "january": 1, "januari": 1,
    "feb": 2, "february": 2, "februari": 2,
    "mar": 3, "march": 3, "maret": 3,
    "apr": 4, "april": 4,
    "may": 5, "mei": 5,
    "jun": 6, "june": 6, "juni": 6,
    "jul": 7, "july": 7, "juli": 7,
    "aug": 8, "august": 8, "agustus": 8, "agt": 8,
    "sep": 9, "september": 9,
    "oct": 10, "october": 10, "oktober": 10, "okt": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12, "desember": 12, "des": 12,
}


def parse_date_str(text: str | None) -> date | None:
    """Parse berbagai format string tanggal menjadi date object (YYYY-MM-DD)."""
    if not text:
        return None
    s = str(text).strip().lower()
    if s in ["present", "sekarang", "current", "now", "saat ini", "-", "null", "none", ""]:
        return None

    # Hapus koma dan titik yang sering menempel di nama bulan, misal 'JAN,' atau 'MAR.'
    s = s.replace(",", " ").replace(".", " ")
    s = re.sub(r"\s+", " ", s).strip()

    # 1. Format ISO YYYY-MM-DD
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass

    # 1b. Format ISO YYYY-MM (tanpa hari, misal "2023-10")
    m = re.match(r"^(\d{4})-(\d{1,2})$", s)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), 1)
        except ValueError:
            pass

    # 2. Format Month YYYY (contoh: "October 2023", "Oct 2024", "Januari 2022", "MAR 2023", "DES 2025")
    #    Juga tangani tanpa spasi: "Mar2023", "Oktober2023"
    m = re.search(r"([a-z]+)\s*(\d{4})", s)
    if m:
        mon_str, year_str = m.group(1), m.group(2)
        mon = MONTHS.get(mon_str[:3], 1)
        try:
            return date(int(year_str), mon, 1)
        except ValueError:
            pass

    # Format YYYY Month (contoh: "2023 October", "2026 Jan")
    m = re.search(r"(\d{4})\s+([a-z]+)", s)
    if m:
        year_str, mon_str = m.group(1), m.group(2)
        mon = MONTHS.get(mon_str[:3], 1)
        try:
            return date(int(year_str), mon, 1)
        except ValueError:
            pass

    # 3. Format MM/YYYY atau MM-YYYY
    m = re.match(r"^(\d{1,2})[/-](\d{4})$", s)
    if m:
        try:
            return date(int(m.group(2)), int(m.group(1)), 1)
        except ValueError:
            pass

    # 4. Format DD/MM/YYYY
    m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", s)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass

    # 5. Tahun saja (contoh: "2017", "2023")
    m = re.search(r"\b(19\d\d|20\d\d)\b", s)
    if m:
        try:
            return date(int(m.group(1)), 1, 1)
        except ValueError:
            pass

    return None


def parse_period_range(period: str | None) -> tuple[date | None, date | None]:
    """
    Parse rentang periode kerja/pendidikan.
    Contoh:
      - "October 2023 – Jan 2026" -> (date(2023, 10, 1), date(2026, 1, 1))
      - "JAN, 2026 - APR 2026" -> (date(2026, 1, 1), date(2026, 4, 1))
      - "MAR, 2023 – DES 2025" -> (date(2023, 3, 1), date(2025, 12, 1))
      - "January 2026 - Present" -> (date(2026, 1, 1), None)
      - "2013 - 2017" -> (date(2013, 1, 1), date(2017, 1, 1))
      - "Mar2023-Des2025" -> (date(2023, 3, 1), date(2025, 12, 1))
      - "Oktober2023-Sekarang" -> (date(2023, 10, 1), None)
    """
    if not period:
        return None, None

    p = str(period).strip()

    # 1. En-dash, em-dash, tilde — selalu pemisah rentang
    p = re.sub(r"\s*[\u2013\u2014–—~]\s*", " <SEP> ", p)

    # 2. Kata penghubung (to, s/d, hingga, sampai)
    p = re.sub(r"\s+(?:to|s/d|hingga|sampai)\s+", " <SEP> ", p, flags=re.IGNORECASE)

    # 3. Rentang tahun-tahun saja: "2013-2017" atau "2013 - 2017"
    #    Harus diproses SEBELUM aturan hyphen umum agar "2023-03-01" tetap utuh.
    p = re.sub(r"(\d{4})\s*-\s*(\d{4})(?!\s*-)", r"\1 <SEP> \2", p)

    # 4a. Tahun diikuti langsung huruf, misal "2023-Januari", "2023-Present"
    #     (hiphen antara angka 4-digit dan huruf — pasti pemisah, bukan bagian tanggal ISO)
    p = re.sub(r"(\d{4})-([A-Za-z])", r"\1 <SEP> \2", p)

    # 4b. Hyphen sebagai pemisah periode — dengan atau tanpa spasi di sekitarnya.
    #    Gunakan negative lookbehind/lookahead agar hyphen di dalam ISO date
    #    ("2023-03-01") tidak ikut dipotong: hyphen di antara dua digit tidak displit.
    p = re.sub(r"(?<!\d)-(?!\d)", " <SEP> ", p)

    parts = [x.strip() for x in p.split("<SEP>") if x.strip()]
    if len(parts) == 1:
        return parse_date_str(parts[0]), None
    elif len(parts) >= 2:
        return parse_date_str(parts[0]), parse_date_str(parts[1])

    return None, None
