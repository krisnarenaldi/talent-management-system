from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, require_role
from app.models.client import Client
from app.models.position import Position
from app.schemas.position import (
    ExtractCriteriaRequest,
    ExtractCriteriaResponse,
    PositionCreate,
    PositionResponse,
    PositionUpdate,
    PositionsByClientResponse,
    RecommendCandidateItem,
    RecommendCandidatesRequest,
    RecommendCandidatesResponse,
)
from app.services import ai_service, client_service

router = APIRouter()


def _validate_client_pics(client: Client, names: list[str]) -> list[str]:
    """Pastikan PIC posisi berasal dari master PIC klien dan minimal satu PIC.

    Memembalikan daftar nama PIC yang sudah dinormalisasi ke penulisan resmi
    pada master klien.
    """
    resolved, unknown = client_service.resolve_pic_names(client, names)
    if unknown:
        available = ", ".join(client_service.client_pic_names(client)) or "(belum ada)"
        raise HTTPException(
            status_code=400,
            detail=(
                f"PIC '{unknown[0]}' tidak terdaftar sebagai PIC pada klien '{client.name}'. "
                f"PIC yang tersedia: {available}."
            ),
        )
    if not resolved:
        raise HTTPException(
            status_code=400,
            detail="PIC klien wajib dipilih untuk posisi ini.",
        )
    return resolved


@router.get("/by-client", response_model=list[PositionsByClientResponse])
def list_positions_by_client(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    rows = (
        db.query(
            Client.id.label("client_id"),
            Client.name.label("client_name"),
            func.count(Position.id).label("total_positions"),
            func.max(Position.created_at).label("last_created_at"),
        )
        .join(Position, Position.client_id == Client.id)
        .group_by(Client.id, Client.name)
        .order_by(Client.name)
        .all()
    )
    return [
        {
            "client_id": row.client_id,
            "client_name": row.client_name,
            "total_positions": row.total_positions,
            "last_created_at": row.last_created_at,
        }
        for row in rows
    ]


@router.get("", response_model=list[PositionResponse])
def list_positions(
    client_id: str | None = Query(None),
    is_active: bool | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    query = db.query(Position).join(Client, Position.client_id == Client.id).options(
        joinedload(Position.client)
    )
    if client_id:
        query = query.filter(Position.client_id == client_id)
    if is_active is not None:
        query = query.filter(Position.is_active == is_active)
    if search:
        pattern = f"%{search}%"
        query = query.filter(Position.title.ilike(pattern))
    return query.all()


@router.post("", response_model=PositionResponse, status_code=status.HTTP_201_CREATED)
def create_position(
    payload: PositionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),  # create: admin + manager
):
    from app.models.client import Client

    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client tidak ditemukan")

    if not client.is_active:
        raise HTTPException(
            status_code=400,
            detail=f"Klien '{client.name}' sudah tidak aktif. Tidak dapat membuat posisi baru.",
        )

    data = payload.model_dump()
    data["client_user_names"] = _validate_client_pics(client, payload.client_user_names)

    position = Position(**data)
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


@router.put("/{position_id}", response_model=PositionResponse)
def update_position(
    position_id: str,
    payload: PositionUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "manager")),  # edit: admin + manager
):
    from app.models.client import Client

    position = db.query(Position).join(Client).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position tidak ditemukan")

    data = payload.model_dump(exclude_unset=True)
    if "client_user_names" in data:
        client = db.query(Client).filter(Client.id == position.client_id).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client tidak ditemukan")
        data["client_user_names"] = _validate_client_pics(client, data["client_user_names"] or [])

    for key, value in data.items():
        setattr(position, key, value)
    db.commit()
    db.refresh(position)
    return position


# ── Ekstraksi Kriteria Posisi (AI) ───────────────────────────────────────────

@router.post("/extract-criteria", response_model=ExtractCriteriaResponse)
def extract_criteria(
    payload: ExtractCriteriaRequest,
    current_user=Depends(require_role("admin", "manager")),
):
    """
    Ekstrak budget gaji, lokasi, required skills, dan minimal pengalaman dari
    teks deskripsi/requirement lowongan (TASK-20.5).

    Dipakai oleh tombol helper "Ekstrak Kriteria dari Deskripsi (AI)" pada form
    master data posisi. Tidak menyimpan apa pun ke database.
    """
    result = ai_service.extract_position_criteria(payload.text)

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result.get("detail") or "Gagal mengekstrak kriteria posisi.",
        )

    return ExtractCriteriaResponse(
        salary_budget=result.get("salary_budget"),
        location=result.get("location"),
        required_skills=result.get("required_skills", []),
        min_experience_years=result.get("min_experience_years"),
        message=result.get("message", ""),
    )


# ── AI Sourcing & Matching ───────────────────────────────────────────────────

@router.post("/{position_id}/recommend-candidates", response_model=RecommendCandidatesResponse)
async def recommend_candidates(
    position_id: str,
    payload: RecommendCandidatesRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    """
    Two-Stage AI Sourcing & Matching:
    1. SQL Filter (0 token): Filter kandidat berdasarkan pool_status, budget gaji, blacklist, cooldown
    2. LLM Scoring: Skor kecocokan 1-100 untuk top kandidat

    - Role HR, Manager, Admin bisa akses
    - Source: 'talent_pool' | 'database' | 'all' (default)
    - Return daftar kandidat terurut skor tertinggi
    """
    # Validasi source
    if payload.source not in ("talent_pool", "database", "all"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="source harus 'talent_pool', 'database', atau 'all'",
        )

    # Panggil service matching
    result = await ai_service.recommend_candidates_for_position(
        db=db,
        position_id=position_id,
        source=payload.source,
    )

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return RecommendCandidatesResponse(
        position_id=result["position_id"],
        candidates=[
            RecommendCandidateItem(
                candidate_id=c["candidate_id"],
                full_name=c["full_name"],
                skills=c.get("skills", []),
                experience_years=c.get("experience_years", 0),
                expected_salary=c.get("expected_salary"),
                domicile=c.get("domicile"),
                pool_status=c.get("pool_status", "database"),
                ai_score=c.get("ai_score"),
                ai_notes=c.get("ai_notes"),
            )
            for c in result["candidates"]
        ],
        message=result.get("message", ""),
    )
