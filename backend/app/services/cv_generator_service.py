"""
cv_generator_service.py — TASK-10: Generate CV Standar Altek
=============================================================

Alur generate:
  1. Cek staleness: bandingkan candidate.updated_at vs generated_cv.generated_at
     - Jika existing CV masih fresh (tidak stale) → return record + file_url langsung
     - Jika stale atau belum ada → generate ulang
  2. Muat data kandidat (education, experience, photo)
  3. Generate summary:
     - summary_source == "HR" → pakai summary_text yang sudah ada (TIDAK di-overwrite)
     - summary_source == "AI" atau belum ada → panggil LLM (fallback ke heuristik)
  4. Render HTML via Jinja2 → convert ke PDF via WeasyPrint
  5. Upload PDF ke storage (local/OneDrive)
  6. Upsert record GeneratedCV di DB
  7. Return GeneratedCV record

Staleness rule:
  candidate.updated_at > generated_cv.generated_at  →  stale
  (cascade trigger on candidate_experience/education menjamin updated_at ikut berubah)
"""
from __future__ import annotations

import base64
import datetime
import logging
import mimetypes
import os
import re
import tempfile
import uuid
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.candidate import Candidate, CandidateEducation, CandidateExperience
from app.models.generated_cv import GeneratedCV
from app.services.storage_service import get_storage_service

logger = logging.getLogger(__name__)

# Path ke folder template
_TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates" / "cv"
_LOGO_PATH = Path(__file__).resolve().parents[1] / "assets" / "altek_logo.png"

# Skill keyword classification — dipakai untuk split skills ke 4 kategori
_PROGRAMMING_KEYWORDS = {
    "python", "java", "javascript", "typescript", "php", "ruby", "go", "golang",
    "c#", "c++", "c", "swift", "kotlin", "dart", "r", "scala", "rust",
    "html", "css", "sass", "less", "bash", "shell", "perl",
    "react", "vue", "angular", "next.js", "nuxt", "express", "fastapi",
    "django", "flask", "laravel", "spring", "rails", "nodejs", "node.js",
}
_DATABASE_KEYWORDS = {
    "mysql", "postgresql", "postgres", "sqlite", "oracle", "mssql", "sql server",
    "mongodb", "redis", "elasticsearch", "cassandra", "dynamodb", "firebase",
    "bigquery", "snowflake", "tableau", "power bi", "looker", "grafana",
    "metabase", "kibana", "superset",
}
_SOFT_KEYWORDS = {
    "communication", "leadership", "teamwork", "problem solving", "adaptability",
    "time management", "critical thinking", "creativity", "collaboration",
    "presentation", "negotiation", "mentoring", "coaching",
    "komunikasi", "kepemimpinan", "kerjasama", "manajemen waktu",
}


# ── Jinja2 env setup ─────────────────────────────────────────────────────────

def _make_jinja_env() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=select_autoescape(["html"]),
    )

    def _format_date(value: datetime.date | None) -> str:
        if value is None:
            return "-"
        try:
            MONTHS_ID = [
                "", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
                "Jul", "Ags", "Sep", "Okt", "Nov", "Des",
            ]
            return f"{MONTHS_ID[value.month]} {value.year}"
        except Exception:
            return str(value)

    env.filters["format_date"] = _format_date
    return env


_JINJA_ENV = _make_jinja_env()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _load_image_as_base64(path: Path | None, url: str | None) -> tuple[str | None, str]:
    """
    Load gambar dari path lokal atau URL relatif ke storage, encode ke base64.
    Return (base64_string, mime_type). Jika gagal, return (None, "image/png").
    """
    # Coba path lokal dulu
    target_path: Path | None = None

    if path and path.exists():
        target_path = path
    elif url:
        # Strip "/api/v1/files/" prefix → relative path di UPLOAD_DIR
        rel = url
        for prefix in ["/api/v1/files/", "/api/v1/candidates/files/"]:
            if rel.startswith(prefix):
                rel = rel[len(prefix):]
                break
        candidate_path = Path(settings.UPLOAD_DIR) / rel
        if candidate_path.exists():
            target_path = candidate_path

    if target_path is None:
        return None, "image/png"

    try:
        mime, _ = mimetypes.guess_type(str(target_path))
        mime = mime or "image/png"
        with open(target_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8"), mime
    except Exception as exc:
        logger.warning("Gagal load gambar %s: %s", target_path, exc)
        return None, "image/png"


def _classify_skills(skills: list[str]) -> dict[str, list[str]]:
    """Bagi skills ke 4 kategori berdasarkan keyword matching."""
    programming, database, other_tech, soft = [], [], [], []
    for skill in skills:
        key = skill.lower().strip()
        if key in _PROGRAMMING_KEYWORDS or any(kw in key for kw in _PROGRAMMING_KEYWORDS):
            programming.append(skill)
        elif key in _DATABASE_KEYWORDS or any(kw in key for kw in _DATABASE_KEYWORDS):
            database.append(skill)
        elif key in _SOFT_KEYWORDS or any(kw in key for kw in _SOFT_KEYWORDS):
            soft.append(skill)
        else:
            other_tech.append(skill)
    return {
        "programming": programming,
        "database": database,
        "other_tech": other_tech,
        "soft": soft,
    }


def _compute_age(birth_date: datetime.date | None) -> str | None:
    if birth_date is None:
        return None
    today = datetime.date.today()
    years = today.year - birth_date.year - (
        (today.month, today.day) < (birth_date.month, birth_date.day)
    )
    return f"{years} tahun"


def _is_stale(
    candidate: Candidate,
    existing_cv: GeneratedCV | None,
) -> bool:
    """
    Return True jika generated CV sudah outdated.
    Stale jika: existing_cv tidak ada, ATAU candidate.updated_at > generated_at.
    """
    if existing_cv is None:
        return True
    if candidate.updated_at is None or existing_cv.generated_at is None:
        return True
    # Pastikan kedua nilai timezone-aware sebelum dibandingkan
    c_updated = candidate.updated_at
    g_generated = existing_cv.generated_at
    if c_updated.tzinfo is None:
        import pytz
        c_updated = pytz.utc.localize(c_updated)
    if g_generated.tzinfo is None:
        import pytz
        g_generated = pytz.utc.localize(g_generated)
    return c_updated > g_generated


# ── LLM summary generation ───────────────────────────────────────────────────

_SUMMARY_SYSTEM_PROMPT_ID = """\
Kamu adalah penulis CV profesional. Tugas: buat "Candidates Summary" singkat (3–5 kalimat)
dalam Bahasa Indonesia untuk CV kandidat berikut.

Aturan:
- Gunakan orang ketiga ("Kandidat memiliki...", "Beliau berpengalaman...")
- Fokus pada pengalaman, skill utama, dan nilai tambah kandidat
- Jangan sebut gaji, nomor HP, email, atau NIK
- Hindari kalimat promosi berlebihan; tetap realistis dan profesional
- Output hanya teks summary, tidak perlu JSON, tidak perlu heading
"""

_SUMMARY_SYSTEM_PROMPT_EN = """\
You are a professional CV writer. Task: write a concise "Candidates Summary" (3–5 sentences)
in English for the following candidate.

Rules:
- Use third person ("The candidate has...", "They bring...")
- Focus on experience, key skills, and value the candidate brings
- Do NOT mention salary, phone number, email, or national ID
- Stay realistic and professional; avoid over-the-top superlatives
- Output only the summary text, no JSON, no headings
"""


def _generate_summary_with_llm(
    candidate: Candidate,
    experiences: list[CandidateExperience],
    educations: list[CandidateEducation],
    language: str,
) -> str | None:
    """Call LLM (OpenAI) to generate a candidate summary. Returns None on failure."""
    if not settings.OPENAI_API_KEY:
        logger.debug("OPENAI_API_KEY tidak diset, skip LLM summary")
        return None

    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # Build user content
        parts: list[str] = [f"Nama: {candidate.full_name}"]
        if candidate.gender:
            parts.append(f"Gender: {candidate.gender}")
        if candidate.skills:
            parts.append(f"Skills: {', '.join(candidate.skills)}")
        if educations:
            edu_parts = []
            for edu in educations:
                e = []
                if edu.institution:
                    e.append(edu.institution)
                if edu.major:
                    e.append(edu.major)
                if edu.graduation_year:
                    e.append(str(edu.graduation_year))
                if e:
                    edu_parts.append(", ".join(e))
            if edu_parts:
                parts.append("Pendidikan: " + "; ".join(edu_parts))
        if experiences:
            exp_parts = []
            for exp in experiences[:4]:
                e = []
                if exp.job_title:
                    e.append(exp.job_title)
                if exp.company_name:
                    e.append(f"di {exp.company_name}")
                if exp.start_date:
                    end = "sekarang" if exp.end_date is None else str(exp.end_date.year)
                    e.append(f"({exp.start_date.year}–{end})")
                if exp.description:
                    short = (exp.description[:120] + "...") if len(exp.description) > 120 else exp.description
                    e.append(f"— {short}")
                if e:
                    exp_parts.append(" ".join(e))
            if exp_parts:
                parts.append("Pengalaman kerja:\n" + "\n".join(f"  - {x}" for x in exp_parts))

        user_content = "\n".join(parts)
        system_prompt = _SUMMARY_SYSTEM_PROMPT_EN if language.upper() == "EN" else _SUMMARY_SYSTEM_PROMPT_ID

        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=0.6,
            max_tokens=300,
        )
        text = (resp.choices[0].message.content or "").strip()
        return text if text else None
    except Exception as exc:
        logger.warning("LLM summary generation gagal: %s", exc)
        return None


def _heuristic_summary(
    candidate: Candidate,
    experiences: list[CandidateExperience],
    language: str,
) -> str:
    """Fallback summary jika LLM tidak tersedia."""
    years_exp = 0
    if experiences:
        today = datetime.date.today()
        for exp in experiences:
            sd = exp.start_date
            ed = exp.end_date or today
            if sd:
                years_exp += max(0, (ed - sd).days // 365)

    skills_str = ", ".join(candidate.skills[:5]) if candidate.skills else "-"

    if language.upper() == "EN":
        return (
            f"{candidate.full_name} is a professional with approximately "
            f"{years_exp} year(s) of working experience. "
            f"Key skills include: {skills_str}. "
            "Seeking to contribute effectively in a dynamic organisation."
        )
    return (
        f"{candidate.full_name} merupakan profesional dengan sekitar "
        f"{years_exp} tahun pengalaman kerja. "
        f"Memiliki kemampuan utama di bidang {skills_str}. "
        "Siap berkontribusi optimal dalam lingkungan kerja yang dinamis."
    )


# ── Core render + generate ────────────────────────────────────────────────────

def _render_pdf(template_context: dict[str, Any]) -> bytes:
    """Render HTML template → PDF bytes via WeasyPrint."""
    try:
        from weasyprint import HTML as WeasyprintHTML
    except ImportError as exc:
        raise RuntimeError(
            "WeasyPrint tidak terinstall. Jalankan: pip install weasyprint"
        ) from exc

    template = _JINJA_ENV.get_template("altek_standard.html")
    html_str = template.render(**template_context)

    with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w", encoding="utf-8") as f:
        f.write(html_str)
        tmp_html = f.name

    try:
        pdf_bytes = WeasyprintHTML(filename=tmp_html).write_pdf()
    finally:
        try:
            os.unlink(tmp_html)
        except OSError:
            pass

    return pdf_bytes


async def generate_cv(
    *,
    db: Session,
    candidate_id: str,
    application_id: str | None = None,
    language: str = "ID",
    summary_text: str | None = None,
    summary_source: str | None = None,
    position_title: str | None = None,
    force_regenerate: bool = False,
) -> GeneratedCV:
    """
    Main entry point. Called by the endpoint.

    Args:
        db              : SQLAlchemy session
        candidate_id    : UUID str
        application_id  : UUID str | None
        language        : "ID" atau "EN"
        summary_text    : Jika diisi oleh HR → pakai ini, set summary_source="HR"
        summary_source  : "HR" atau "AI"; override otomatis jika summary_text diisi
        position_title  : Ditampilkan di cover halaman CV
        force_regenerate: Paksa generate ulang meskipun tidak stale

    Returns:
        GeneratedCV record (baru atau yang sudah ada jika masih fresh)
    """
    # 1. Load candidate dengan relasi
    candidate: Candidate | None = (
        db.query(Candidate)
        .options(
            joinedload(Candidate.educations),
            joinedload(Candidate.experiences),
        )
        .filter(Candidate.id == candidate_id, Candidate.is_deleted == False)
        .first()
    )
    if candidate is None:
        raise ValueError(f"Kandidat {candidate_id} tidak ditemukan")

    # 2. Ambil existing CV (paling baru untuk kombinasi candidate+language)
    existing_cv: GeneratedCV | None = (
        db.query(GeneratedCV)
        .filter(
            GeneratedCV.candidate_id == candidate_id,
            GeneratedCV.language == language.upper(),
        )
        .order_by(GeneratedCV.generated_at.desc())
        .first()
    )

    # 3. Staleness check
    if not force_regenerate and not _is_stale(candidate, existing_cv):
        # CV masih fresh → return tanpa regenerate
        logger.info("CV kandidat %s masih fresh, skip regenerate", candidate_id)
        return existing_cv  # type: ignore[return-value]

    # 4. Tentukan summary
    final_summary_source = (summary_source or "AI").upper()
    final_summary_text = summary_text

    if final_summary_text:
        final_summary_source = "HR"
    else:
        # Jika CV lama ada dan sumber-nya HR → jangan overwrite
        if existing_cv and existing_cv.summary_source == "HR" and existing_cv.summary_text:
            final_summary_text = existing_cv.summary_text
            final_summary_source = "HR"
        else:
            # Generate via LLM
            final_summary_text = _generate_summary_with_llm(
                candidate,
                candidate.experiences,
                candidate.educations,
                language,
            )
            if not final_summary_text:
                final_summary_text = _heuristic_summary(candidate, candidate.experiences, language)
            final_summary_source = "AI"

    # 5. Sort experiences (terbaru dulu, yang masih berjalan paling atas)
    sorted_exp = sorted(
        candidate.experiences,
        key=lambda e: (
            e.end_date is None,                      # None (still working) → True → sort first
            e.start_date or datetime.date.min,
        ),
        reverse=True,
    )

    # 6. Load logo
    logo_b64, _ = _load_image_as_base64(_LOGO_PATH, None)

    # 7. Load photo
    photo_b64, photo_mime = _load_image_as_base64(None, candidate.photo_url)

    # 8. Classify skills
    skills = candidate.skills or []
    skill_cats = _classify_skills(skills)

    # 9. Build template context
    context: dict[str, Any] = {
        "language": "id" if language.upper() == "ID" else "en",
        "candidate": candidate,
        "educations": candidate.educations,
        "experiences": sorted_exp,
        "summary_text": final_summary_text,
        "position_title": position_title or "-",
        "age": _compute_age(candidate.birth_date),
        "logo_base64": logo_b64,
        "photo_base64": photo_b64,
        "photo_mime": photo_mime,
        "skills_programming": skill_cats["programming"],
        "skills_database": skill_cats["database"],
        "skills_other_tech": skill_cats["other_tech"],
        "skills_soft": skill_cats["soft"],
    }

    # 10. Render → PDF
    pdf_bytes = _render_pdf(context)

    # 11. Upload to storage
    storage = get_storage_service()
    safe_name = re.sub(r"[^\w\-]", "_", candidate.full_name.lower())
    filename = f"cv_{safe_name}_{language.lower()}_{uuid.uuid4().hex[:6]}.pdf"
    folder = f"candidates/{candidate_id}/generated_cvs"
    upload_result = await storage.upload(pdf_bytes, filename, folder)
    file_url = upload_result.get("file_url", "")
    drive_item_id = upload_result.get("drive_item_id", "")

    # 12. Hapus file lama dari storage (jika ada dan berbeda URL)
    if existing_cv and existing_cv.file_url and existing_cv.file_url != file_url:
        try:
            await storage.delete(existing_cv.file_url)
        except Exception as exc:
            logger.warning("Gagal hapus file CV lama %s: %s", existing_cv.file_url, exc)

    # 13. Upsert record GeneratedCV
    if existing_cv:
        existing_cv.template_used = "altek_standard"
        existing_cv.language = language.upper()
        existing_cv.summary_source = final_summary_source
        existing_cv.summary_text = final_summary_text
        existing_cv.file_url = file_url
        existing_cv.drive_item_id = drive_item_id
        existing_cv.generated_at = datetime.datetime.now(datetime.timezone.utc)
        if application_id:
            existing_cv.application_id = application_id
        db.flush()
        return existing_cv
    else:
        new_cv = GeneratedCV(
            candidate_id=candidate_id,
            application_id=application_id,
            template_used="altek_standard",
            language=language.upper(),
            summary_source=final_summary_source,
            summary_text=final_summary_text,
            file_url=file_url,
            drive_item_id=drive_item_id,
            generated_at=datetime.datetime.now(datetime.timezone.utc),
        )
        db.add(new_cv)
        db.flush()
        return new_cv
