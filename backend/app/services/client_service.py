"""Utilitas master data PIC klien.

PIC klien disimpan dua kali:

* ``client.pics`` — JSONB terstruktur ``[{"name": ..., "contact": ...}]`` (sumber data)
* ``client.pic_name`` / ``client.pic_contact`` — string terpisah dengan pemisah ``;``
  (kolom kompatibilitas yang dipakai enquiry lama & kolom legacy)

Helper di modul ini menjaga kedua representation tersebut tetap sinkron dan
menjaga nama ↔ kontak tetap berpasangan pada indeks yang sama.
"""

from __future__ import annotations

from app.core.phone_utils import normalize_phone
from app.models.client import Client

PIC_SEPARATOR = ";"


def normalize_pics(pics: list[dict] | None) -> list[dict]:
    """Bersihkan daftar PIC: potong spasi, buang baris kosong, dan dedup nama.

    Menerima baik dict maupun objek (mis. schema Pydantic) yang memiliki
    atribut ``name`` dan ``contact``.
    """
    result: list[dict] = []
    seen: set[str] = set()
    for raw in pics or []:
        if isinstance(raw, dict):
            name = raw.get("name")
            contact = raw.get("contact")
        else:
            name = getattr(raw, "name", None)
            contact = getattr(raw, "contact", None)
        name = str(name or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        contact = str(contact).strip() if contact is not None else ""
        if contact:
            contact = normalize_phone(contact)
        result.append({"name": name, "contact": contact or None})
    return result


def parse_legacy_pics(pic_name: str | None, pic_contact: str | None) -> list[dict]:
    """Baca representation legacy (string ``;``) menjadi daftar PIC terstruktur.

    Nama dan kontak dipasangkan berdasarkan indeks. Baris tanpa nama diabaikan
    (kontaknya juga ikut hilang) supaya data tetap konsisten.
    """
    names = [n.strip() for n in (pic_name or "").split(PIC_SEPARATOR)]
    contacts = [c.strip() for c in (pic_contact or "").split(PIC_SEPARATOR)]
    rows: list[dict] = []
    for index, name in enumerate(names):
        if not name:
            continue
        contact = contacts[index] if index < len(contacts) else ""
        rows.append({"name": name, "contact": contact or None})
    return normalize_pics(rows)


def pics_to_legacy(pics: list[dict]) -> tuple[str | None, str | None]:
    """Konversi daftar PIC terstruktur menjadi pasangan string legacy.

    Nama & kontak memakai pemisah ``;`` dan posisi yang sama, sehingga
    ``pic_name`` dan ``pic_contact`` dapat dipasangkan kembali per indeks.
    """
    if not pics:
        return None, None
    names = [p["name"] for p in pics]
    contacts = [p.get("contact") or "" for p in pics]
    return PIC_SEPARATOR.join(names), PIC_SEPARATOR.join(contacts)


def client_pics(client: Client) -> list[dict]:
    """Ambil daftar PIC klien dari ``client.pics``; fallback ke kolom legacy."""
    if client.pics:
        return normalize_pics(client.pics)
    return parse_legacy_pics(client.pic_name, client.pic_contact)


def client_pic_names(client: Client) -> list[str]:
    """Daftar nama PIC klien (sumber data kanonik untuk assignment posisi)."""
    return [p["name"] for p in client_pics(client)]


def resolve_pic_names(client: Client, names: list[str]) -> tuple[list[str], list[str]]:
    """Cocokkan nama PIC posisi dengan master PIC klien.

    Mengembalikan ``(nama_resolved, nama_tidak_dikenal)``. Nama yang dikenal
    dinormalisasi ke penulisan resmi pada master klien (case-insensitive).
    """
    available = {p["name"].lower(): p["name"] for p in client_pics(client)}
    resolved: list[str] = []
    unknown: list[str] = []
    seen: set[str] = set()
    for raw in names or []:
        name = str(raw or "").strip()
        if not name:
            continue
        canonical = available.get(name.lower())
        if canonical is None:
            if name.lower() not in {u.lower() for u in unknown}:
                unknown.append(name)
            continue
        if canonical.lower() in seen:
            continue
        seen.add(canonical.lower())
        resolved.append(canonical)
    return resolved, unknown
