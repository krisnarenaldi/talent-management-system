"""Unit tests untuk normalisasi nama kandidat (app.core.text_utils.normalize_name)."""

from app.core.text_utils import normalize_name


def test_normalize_name_all_caps():
    # ALL CAPS harus dikonversi menjadi Title Case
    assert normalize_name("BAYU AHMAD PRAKOSO") == "Bayu Ahmad Prakoso"
    assert normalize_name("DWI IQBAL HASANI") == "Dwi Iqbal Hasani"
    assert normalize_name("JOHN DOE") == "John Doe"


def test_normalize_name_mixed_and_title_case_preserved():
    # Nama yang sudah Title Case atau Mixed Case harus dipertahankan apa adanya
    assert normalize_name("Destry Hutagaol") == "Destry Hutagaol"
    assert normalize_name("Bunga Athirah Khairunnissa") == "Bunga Athirah Khairunnissa"
    assert normalize_name("McDonald") == "McDonald"
    assert normalize_name("M. Rizky, S.Kom.") == "M. Rizky, S.Kom."
    assert normalize_name("Dr. Ir. Budi Santoso") == "Dr. Ir. Budi Santoso"


def test_normalize_name_whitespace():
    # Menghapus trailing/leading whitespace dan multiple spaces
    assert normalize_name("   BAYU   AHMAD   PRAKOSO   ") == "Bayu Ahmad Prakoso"
    assert normalize_name("  Choerul   Rizky  ") == "Choerul Rizky"


def test_normalize_name_empty_or_none():
    assert normalize_name(None) == ""
    assert normalize_name("") == ""
    assert normalize_name("   ") == ""
