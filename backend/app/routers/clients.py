from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_role
from app.core.phone_utils import PHONE_PATTERN as PIC_CONTACT_PATTERN
from app.core.phone_utils import normalize_phone
from app.models.application import Application
from app.models.client import Client
from app.models.position import Position
from app.schemas.client import ClientCreate, ClientResponse, ClientUpdate
from app.services import client_service

router = APIRouter()


def _resolve_pics(
    pics: list[dict] | None,
    pic_name: str | None,
    pic_contact: str | None,
) -> list[dict]:
    """Tentukan daftar PIC final dari payload.

    ``pics`` (terstruktur) menang bila dikirim; jika tidak, dibaca dari kolom
    legacy ``pic_name``/``pic_contact``.
    """
    if pics is not None:
        return client_service.normalize_pics(pics)
    return client_service.parse_legacy_pics(pic_name, pic_contact)


def _validate_pics(pics: list[dict]) -> None:
    """Pastikan setiap PIC punya nama dan kontak yang konsisten serta valid."""
    for pic in pics:
        if not pic.get("name"):
            raise HTTPException(status_code=400, detail="Nama PIC tidak boleh kosong")
        contact = pic.get("contact")
        if not contact:
            raise HTTPException(
                status_code=400,
                detail=f"Kontak PIC '{pic['name']}' wajib diisi.",
            )
        if not PIC_CONTACT_PATTERN.match(contact):
            raise HTTPException(
                status_code=400,
                detail=f"Format nomor kontak PIC '{pic['name']}' tidak valid: {contact}",
            )


def _check_name_unique(db: Session, name: str, exclude_client_id: str | None = None) -> None:
    """Nama klien tidak boleh duplikat (case-insensitive)."""
    query = db.query(Client).filter(func.lower(Client.name) == name.lower().strip())
    if exclude_client_id:
        query = query.filter(Client.id != exclude_client_id)
    existing = query.first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Nama klien '{name}' sudah digunakan.",
        )


def _check_contacts_unique(db: Session, contacts: list[str], exclude_client_id: str | None = None) -> None:
    """Nomor kontak PIC tidak boleh dipakai oleh klien lain."""
    if not contacts:
        return
    query = db.query(Client).filter(Client.pic_contact != None)
    if exclude_client_id:
        query = query.filter(Client.id != exclude_client_id)
    for existing in query.all():
        existing_contacts = [normalize_phone(c) for c in existing.pic_contact.split(";") if c.strip()]
        for contact in contacts:
            if contact in existing_contacts:
                raise HTTPException(
                    status_code=400,
                    detail=f"Nomor kontak PIC sudah digunakan oleh klien lain: {contact}",
                )


@router.get("", response_model=list[ClientResponse])
def list_clients(
    search: str | None = Query(None),
    is_active: bool | None = Query(None, description="Filter: hanya aktif / hanya nonaktif"),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    query = db.query(Client)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Client.name.ilike(pattern)) | (Client.pic_name.ilike(pattern))
        )
    if is_active is not None:
        query = query.filter(Client.is_active == is_active)
    return query.all()


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client tidak ditemukan")
    return client


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),  # create: admin only
):
    _check_name_unique(db, payload.name)
    pics = _resolve_pics(payload.pics, payload.pic_name, payload.pic_contact)
    _validate_pics(pics)
    _check_contacts_unique(db, [p["contact"] for p in pics if p.get("contact")])

    pic_name, pic_contact = client_service.pics_to_legacy(pics)
    client = Client(
        name=payload.name,
        industry=payload.industry,
        pic_name=pic_name,
        pic_contact=pic_contact,
        pics=pics,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: str,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),  # edit: admin + manager
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client tidak ditemukan")

    data = payload.model_dump(exclude_unset=True)

    if "name" in data and data["name"] is not None:
        _check_name_unique(db, data["name"], exclude_client_id=client_id)

    # PIC hanya diubah bila salah satu field PIC dikirim pada payload.
    if "pics" in data or "pic_name" in data or "pic_contact" in data:
        pics = _resolve_pics(
            data.get("pics"),
            data.get("pic_name", client.pic_name),
            data.get("pic_contact", client.pic_contact),
        )
        _validate_pics(pics)
        _check_contacts_unique(
            db,
            [p["contact"] for p in pics if p.get("contact")],
            exclude_client_id=client_id,
        )

        # Tentukan pasangan rename: setiap nama lama yang masih ada di daftar baru
        # tapi telah berubah penulisannya (case-insensitive match pada kontak).
        # Strategi: pasangkan PIC lama ↔ baru berdasarkan kontak yang sama.
        old_contact_to_name = {
            p.get("contact"): p["name"]
            for p in client_service.client_pics(client)
            if p.get("contact")
        }
        new_contact_to_name = {
            p.get("contact"): p["name"]
            for p in pics
            if p.get("contact")
        }
        rename_map: dict[str, str] = {}
        for contact, old_name in old_contact_to_name.items():
            new_name = new_contact_to_name.get(contact)
            if new_name and new_name != old_name:
                rename_map[old_name.lower()] = new_name

        pic_name, pic_contact = client_service.pics_to_legacy(pics)
        client.pics = pics
        client.pic_name = pic_name
        client.pic_contact = pic_contact

        # Cascade: perbarui client_user_names pada semua posisi klien ini
        # bila ada nama PIC yang berubah.
        if rename_map:
            positions = (
                db.query(Position)
                .filter(Position.client_id == client_id)
                .all()
            )
            for position in positions:
                old_names = position.client_user_names or []
                updated_names = [
                    rename_map.get(n.lower(), n) for n in old_names
                ]
                if updated_names != old_names:
                    position.client_user_names = updated_names

    for key in ("name", "industry", "is_active"):
        if key in data:
            setattr(client, key, data[key])

    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),  # deactivate: admin only
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client tidak ditemukan")

    # Guard: tidak boleh nonaktifkan jika masih ada posisi aktif.
    active_positions = (
        db.query(Position)
        .filter(Position.client_id == client_id, Position.is_active == True)
        .count()
    )
    if active_positions:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Tidak dapat menonaktifkan klien. Masih ada {active_positions} "
                f"posisi aktif. Nonaktifkan posisi terlebih dahulu."
            ),
        )

    # Guard: tidak boleh nonaktifkan jika masih ada kandidat aktif dalam pipeline.
    active_applications = (
        db.query(Application)
        .join(Position, Application.position_id == Position.id)
        .filter(Position.client_id == client_id, Application.status == "active")
        .count()
    )
    if active_applications:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Tidak dapat menonaktifkan klien. Masih ada {active_applications} "
                f"kandidat aktif dalam pipeline. Selesaikan atau tarik kembali terlebih dahulu."
            ),
        )

    client.is_active = False
    db.commit()
