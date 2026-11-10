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
from app.services.application_service import bulk_reject_applications

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
    sort_by: str | None = Query(None),
    sort_order: str = Query("asc"),
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

    is_desc = (sort_order or "asc").lower() == "desc"
    if sort_by == "name":
        order_col = Client.name.desc() if is_desc else Client.name.asc()
        query = query.order_by(order_col)
    elif sort_by == "industry":
        order_col = Client.industry.desc().nullslast() if is_desc else Client.industry.asc().nullslast()
        query = query.order_by(order_col, Client.name.asc())
    elif sort_by == "created_at" or sort_by == "dibuat":
        order_col = Client.created_at.desc() if is_desc else Client.created_at.asc()
        query = query.order_by(order_col, Client.name.asc())
    else:
        query = query.order_by(Client.name.asc())

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

    # Bulk-reject: bila klien dinon-aktifkan dengan bulk_reject=True, nonaktifkan
    # semua posisi klien ini dan tolak semua lamaran aktif dengan alasan tersebut.
    if payload.is_active is False and payload.bulk_reject:
        if not payload.reject_reason:
            raise HTTPException(
                status_code=400,
                detail="reject_reason wajib bila bulk_reject=True",
            )
        client.is_active = False
        # deactivate all positions of this client
        positions = db.query(Position).filter(Position.client_id == client_id).all()
        pos_ids = [str(p.id) for p in positions]
        db.query(Position).filter(Position.client_id == client_id).update(
            {"is_active": False}, synchronize_session=False
        )
        bulk_reject_applications(db, pos_ids, payload.reject_reason)

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
        old_pics = client_service.client_pics(client)
        old_names = [p["name"] for p in old_pics if p.get("name")]
        new_names_lower = {p["name"].strip().lower() for p in pics if p.get("name")}

        old_contact_to_name = {
            p.get("contact"): p["name"]
            for p in old_pics
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

        # Validasi penghapusan PIC:
        # Jika ada PIC lama yang tidak ada di daftar baru dan tidak direname,
        # pastikan tidak sedang digunakan oleh lamaran aktif.
        deleted_pics = [
            name for name in old_names
            if name.strip().lower() not in new_names_lower and name.strip().lower() not in rename_map
        ]
        for deleted_name in deleted_pics:
            active_app_count = (
                db.query(Application)
                .join(Position, Application.position_id == Position.id)
                .filter(
                    Position.client_id == client_id,
                    Application.status == "active",
                    func.lower(Application.client_user_name) == deleted_name.strip().lower(),
                )
                .count()
            )
            if active_app_count > 0:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"PIC '{deleted_name}' tidak bisa dihapus karena ada {active_app_count} "
                        f"lamaran aktif dengan PIC ini. Silakan buat PIC baru, alihkan posisi & "
                        f"lamaran ke PIC baru terlebih dahulu."
                    ),
                )

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

    # Soft-delete: cukup nonaktifkan klien. Penanganan posisi & lamaran aktif
    # dilakukan lewat alur PUT dengan bulk_reject (lihat update_client).
    client.is_active = False
    db.commit()
