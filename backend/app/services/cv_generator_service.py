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
from app.models.candidate import Candidate, CandidateDocument, CandidateEducation, CandidateExperience
from app.models.candidate_project import CandidateProject
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

    def _format_date_full(value: datetime.date | None) -> str:
        """Return full date like '5 Desember 1998'."""
        if value is None:
            return "-"
        try:
            MONTHS_FULL = [
                "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                "Juli", "Agustus", "September", "Oktober", "November", "Desember",
            ]
            return f"{value.day} {MONTHS_FULL[value.month]} {value.year}"
        except Exception:
            return str(value)

    env.filters["format_date"] = _format_date
    env.filters["format_date_full"] = _format_date_full
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


# ── Attachment docs (Ijazah / Sertifikat / Transkrip) ────────────────────────

# doc_type values that get embedded as images in the generated CV
_ATTACHMENT_DOC_TYPES = {"Ijazah", "Sertifikat", "Transkrip"}

# Sort order for display: Ijazah first, then Transkrip, then Sertifikat
_ATTACHMENT_SORT_ORDER = {"Ijazah": 0, "Transkrip": 1, "Sertifikat": 2}

_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}


def _load_attachment_docs(
    db: Session,
    candidate_id: str,
) -> list[dict]:
    """
    Load Ijazah, Transkrip and Sertifikat documents from DB, encode image files as base64.
    Only image formats (jpg/jpeg/png/webp/gif/bmp) are supported — PDF is skipped.

    Label priority:
      1. doc.label  — user-supplied keterangan (e.g. "Ijazah S1 Universitas Indonesia")
      2. doc.doc_type — fallback (e.g. "Ijazah")

    Returns list of dicts: {label, img_base64, img_mime}, sorted by doc_type order
    then upload time.
    """
    docs: list[CandidateDocument] = (
        db.query(CandidateDocument)
        .filter(
            CandidateDocument.candidate_id == candidate_id,
            CandidateDocument.is_deleted == False,
            CandidateDocument.doc_type.in_(list(_ATTACHMENT_DOC_TYPES)),
        )
        .order_by(CandidateDocument.uploaded_at)
        .all()
    )

    # Sort: Ijazah → Transkrip → Sertifikat, preserving upload order within each group
    docs.sort(key=lambda d: (_ATTACHMENT_SORT_ORDER.get(d.doc_type, 99), d.uploaded_at or ""))

    result = []
    for doc in docs:
        file_url = doc.file_url or ""
        ext = Path(file_url).suffix.lower()
        if ext not in _IMAGE_EXTENSIONS:
            # PDF / unknown — not embeddable in HTML→PDF via WeasyPrint
            logger.debug("Skip non-image attachment %s (%s)", file_url, ext)
            continue

        img_b64, img_mime = _load_image_as_base64(None, file_url)
        # Use user-supplied label if present, fall back to doc_type
        display_label = (doc.label or "").strip() or doc.doc_type
        result.append({
            "label": display_label,
            "doc_type": doc.doc_type,
            "img_base64": img_b64,
            "img_mime": img_mime,
        })

    return result


# ── Position title helpers ────────────────────────────────────────────────────

# Regex to extract a meaningful title from an original CV filename.
# Patterns like:  "EMAIL QA - Muhammad Ikhsan.pdf"
#                 "DATABASE_Rivaldo Antonend P_ ACC.pdf"
#                 "GLINTS PROGRAMMER - DWI WAHYU.pdf"
#                 "Achmad Sholeh - Programmer or IT Helpdesk.pdf"
_CV_FILENAME_TITLE_RE = re.compile(
    r"""
    (?:
      # "EMAIL <TITLE> - Name"  or  "GLINTS <TITLE> - Name"
      (?:email|glints|linkedin|tapker|taploker|jobstreet|web)\s+(.+?)\s*[-–]\s
      |
      # "<CATEGORY>_<TITLE>_Name" or "<CATEGORY> <TITLE> - Name"
      [A-Z][A-Z_]+[_ ]+(.+?)[_\s]+[-–\s]
      |
      # "Name - <TITLE>" or "Name — <TITLE>"
      .+?\s+[-–]\s+(.+?)
    )
    (?:\.pdf|\.docx)?$
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Source keywords that prefix the actual position (skip these)
_SKIP_PREFIXES = {
    "email", "glints", "linkedin", "tapker", "taploker",
    "jobstreet", "database", "web", "acc", "approved",
}


def _extract_position_from_filename(filename: str) -> str | None:
    """
    Try to infer a position/job title from the original CV filename.

    Handles naming patterns used in the system:
      "EMAIL QA - Muhammad Ikhsan.pdf"          → "QA"
      "EMAIL QA AUTO - Sendi Septian.pdf"        → "QA Auto"
      "GLINTS PROGRAMMER - DWI WAHYU.pdf"        → "Programmer"
      "EMAIL MOB DEV - FAJAR RIANTO.pdf"         → "Mobile Dev"
      "EMAIL UAT Tester - Abdul Karman.pdf"      → "UAT Tester"
      "EMAIL SA or FD or DE - RICKY.pdf"         → "SA / FD / DE"
      "Achmad Sholeh - Programmer or IT Helpdesk.pdf" → "Programmer or IT Helpdesk"
      "DATABASE_Rivaldo Antonend P_ ACC.pdf"     → from last experience title (fallback)

    Returns the extracted title string (title-cased) or None.
    """
    if not filename:
        return None

    stem = Path(filename).stem.strip()

    # ── Pattern A: "SOURCE TITLE - Name"  (dash separates title from name)
    # e.g. "EMAIL QA AUTO - Sendi Septian Hadi"
    # e.g. "GLINTS PROGRAMMER - DWI"
    parts = re.split(r"\s[-–]\s", stem, maxsplit=1)
    if len(parts) == 2:
        left, right = parts[0].strip(), parts[1].strip()
        left_words = left.split()

        # If left starts with a source keyword, strip it to get the title
        if left_words and left_words[0].upper() in {w.upper() for w in _SKIP_PREFIXES}:
            title_words = left_words[1:]
            if title_words:
                return " ".join(title_words).title()
            # Only one word after stripping (too short?) → skip, handled by right side
        else:
            # Left has no source keyword → right side might be the title
            # e.g. "Achmad Sholeh - Programmer or IT Helpdesk"
            # Check if right looks like a title (has job-like words) rather than a plain name
            if right and not re.match(r"^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$", right):
                # Right has job keywords (uppercase words / abbreviations / slashes)
                return right.title()
            # Otherwise left is likely a name → return right if it looks title-like
            if right and len(right.split()) >= 1:
                return right.title()

    # ── Pattern B: "DATABASE_Title_Name_ACC" (underscore-separated, first is source)
    parts_us = [p.strip() for p in stem.split("_") if p.strip()]
    if len(parts_us) >= 2:
        first_up = parts_us[0].upper()
        # Known source/category prefixes in underscore filenames
        if first_up in {"DATABASE", "MOB", "SA", "FD", "DE"} or first_up in {w.upper() for w in _SKIP_PREFIXES}:
            # Title is the second segment — but verify it's not just a person name
            candidate_title = parts_us[1]
            # Person names are typically "Firstname" (single capitalised word)
            # Titles tend to be multi-word or abbreviations
            is_probably_name = bool(re.match(r"^[A-Z][a-z]+$", candidate_title))
            if not is_probably_name and len(candidate_title) >= 2:
                return candidate_title.title()

    return None


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
    cv_original_filename: str | None = None,
) -> GeneratedCV:
    """
    Main entry point. Called by the endpoint.

    Args:
        db                    : SQLAlchemy session
        candidate_id          : UUID str
        application_id        : UUID str | None
        language              : "ID" atau "EN"
        summary_text          : Jika diisi oleh HR → pakai ini, set summary_source="HR"
        summary_source        : "HR" atau "AI"; override otomatis jika summary_text diisi
        position_title        : Ditampilkan di cover halaman CV (dari application.position.title)
        force_regenerate      : Paksa generate ulang meskipun tidak stale
        cv_original_filename  : Nama file CV asli kandidat; dipakai sebagai fallback
                                untuk menebak position title.

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

    # 1b. Load approved projects
    approved_projects: list[CandidateProject] = (
        db.query(CandidateProject)
        .filter(
            CandidateProject.candidate_id == candidate_id,
            CandidateProject.is_draft == False,
        )
        .order_by(CandidateProject.created_at.asc())
        .all()
    )

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
        # Jika CV lama ada dan ada summary tersimpan (HR maupun AI) → pakai, jangan generate ulang
        if existing_cv and existing_cv.summary_text:
            final_summary_text = existing_cv.summary_text
            final_summary_source = existing_cv.summary_source or "AI"
        else:
            # Belum ada summary sama sekali → generate via LLM
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

    # 5b. Resolve position title with fallback chain:
    #   1. Explicit position_title (from application.position.title) — highest priority
    #   2. Extract from original CV filename (e.g. "EMAIL QA - Muhammad Ikhsan.pdf")
    #   3. Most recent job title from experience history
    #   4. Fall through to "-"
    resolved_position_title: str = position_title or ""
    if not resolved_position_title:
        # Try filename first
        if not cv_original_filename:
            # Look up CV_asli document for this candidate
            cv_doc = (
                db.query(CandidateDocument)
                .filter(
                    CandidateDocument.candidate_id == candidate_id,
                    CandidateDocument.doc_type == "CV_asli",
                    CandidateDocument.is_deleted == False,
                )
                .order_by(CandidateDocument.uploaded_at.desc())
                .first()
            )
            if cv_doc and cv_doc.file_url:
                cv_original_filename = Path(cv_doc.file_url).name

        if cv_original_filename:
            extracted = _extract_position_from_filename(cv_original_filename)
            if extracted:
                resolved_position_title = extracted
                logger.info(
                    "Position title inferred from filename '%s' → '%s'",
                    cv_original_filename, resolved_position_title,
                )

    if not resolved_position_title and sorted_exp:
        # Use most recent job title as last resort
        resolved_position_title = sorted_exp[0].job_title or ""
        if resolved_position_title:
            logger.info(
                "Position title fallback to most recent job title: '%s'",
                resolved_position_title,
            )

    if not resolved_position_title:
        resolved_position_title = "-"

    # 6. Load logo
    logo_b64, _ = _load_image_as_base64(_LOGO_PATH, None)

    # 7. Load photo
    photo_b64, photo_mime = _load_image_as_base64(None, candidate.photo_url)

    # 8. Classify skills
    skills = candidate.skills or []
    skill_cats = _classify_skills(skills)

    # 8b. Load Ijazah & Sertifikat image attachments
    attachment_docs = _load_attachment_docs(db, candidate_id)

    # 9. Build template context
    context: dict[str, Any] = {
        "language": "id" if language.upper() == "ID" else "en",
        "candidate": candidate,
        "educations": candidate.educations,
        "experiences": sorted_exp,
        "approved_projects": approved_projects,
        "summary_text": final_summary_text,
        "position_title": resolved_position_title,
        "age": _compute_age(candidate.birth_date),
        "logo_base64": logo_b64,
        "photo_base64": photo_b64,
        "photo_mime": photo_mime,
        "skills_programming": skill_cats["programming"],
        "skills_database": skill_cats["database"],
        "skills_other_tech": skill_cats["other_tech"],
        "skills_soft": skill_cats["soft"],
        "attachment_docs": attachment_docs,
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
