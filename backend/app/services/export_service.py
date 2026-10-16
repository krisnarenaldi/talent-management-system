"""Business logic untuk export data."""
from datetime import datetime, timedelta
from decimal import Decimal
from io import BytesIO
from typing import Optional
import uuid

from fastapi import HTTPException
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application, StageHistory, STAGE_NAMES
from app.models.candidate import Candidate, CandidateDocument, CandidateEducation, CandidateExperience
from app.models.employee import Employee
from app.models.position import Position


class ExportError(Exception):
    pass


def _get_excel_response_for_candidates(
    db: Session,
    position_id: Optional[str] = None,
    completeness_status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    search: Optional[str] = None,
    source_channel: Optional[str] = None,
    city: Optional[str] = None,
    experience_level: Optional[str] = None,
    education: Optional[str] = None,
    min_current_salary: Optional[Decimal] = None,
    max_current_salary: Optional[Decimal] = None,
    min_expected_salary: Optional[Decimal] = None,
    max_expected_salary: Optional[Decimal] = None,
) -> bytes:
    """
    Generate Excel file with candidates data.
    Returns bytes of the Excel file.
    """
    from sqlalchemy import select

    # Build query with joins
    query = (
        db.query(Candidate)
        .options(
            joinedload(Candidate.educations),
            joinedload(Candidate.experiences),
            joinedload(Candidate.documents),
            joinedload(Candidate.applications).joinedload(Application.stage_histories),
            joinedload(Candidate.applications).joinedload(Application.position),
        )
        .filter(Candidate.is_deleted == False)
    )

    # Exclude candidates who are already active employees
    query = query.filter(
        ~Candidate.id.in_(
            db.query(Employee.candidate_id).filter(Employee.employee_status == "aktif")
        )
    )

    # Apply filters
    if position_id:
        # Candidates yang punya application ke posisi tertentu
        try:
            val_uuid = uuid.UUID(position_id)
            query = query.join(Application, Candidate.id == Application.candidate_id).filter(
                Application.position_id == str(val_uuid)
            )
        except (ValueError, AttributeError):
            query = (
                query.join(Application, Candidate.id == Application.candidate_id)
                .join(Position, Application.position_id == Position.id)
                .filter(Position.title.ilike(f"%{position_id}%"))
            )

    if completeness_status:
        query = query.filter(Candidate.completeness_status == completeness_status)

    if start_date:
        query = query.filter(Candidate.created_at >= start_date)
    if end_date:
        query = query.filter(Candidate.created_at <= end_date + timedelta(days=1))

    if search:
        from sqlalchemy import String
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Candidate.full_name.ilike(pattern),
                Candidate.email.ilike(pattern),
                Candidate.phone.ilike(pattern),
                Candidate.domicile.ilike(pattern),
                Candidate.notes.ilike(pattern),
                Candidate.skills.cast(String).ilike(pattern),
                Candidate.educations.any(
                    or_(
                        CandidateEducation.institution.ilike(pattern),
                        CandidateEducation.major.ilike(pattern),
                    )
                ),
                Candidate.experiences.any(
                    or_(
                        CandidateExperience.company_name.ilike(pattern),
                        CandidateExperience.job_title.ilike(pattern),
                        CandidateExperience.description.ilike(pattern),
                    )
                ),
                Candidate.applications.any(
                    Application.stage_histories.any(
                        StageHistory.notes.ilike(pattern)
                    )
                ),
            )
        )

    if source_channel:
        query = query.filter(Candidate.source_channel == source_channel)

    if city:
        city_lower = city.lower()
        jabotabek = ["jakarta", "bogor", "depok", "tangerang", "bekasi"]
        conditions = [Candidate.domicile.ilike(f"%{c}%") for c in jabotabek]
        if city_lower == "jabotabek":
            query = query.filter(or_(*conditions))
        elif city_lower == "non_jabotabek":
            query = query.filter(~or_(*conditions))
        else:
            query = query.filter(Candidate.domicile.ilike(f"%{city}%"))

    if experience_level:
        exp_stmt = select(
            CandidateExperience.candidate_id,
            func.sum(
                func.coalesce(CandidateExperience.end_date, func.current_date()) - CandidateExperience.start_date
            ).label("total_days")
        ).group_by(CandidateExperience.candidate_id).subquery()
        query = query.outerjoin(exp_stmt, Candidate.id == exp_stmt.c.candidate_id)
        if experience_level == "junior":
            query = query.filter(or_(exp_stmt.c.total_days == None, exp_stmt.c.total_days <= 1095))
        elif experience_level == "intermediate":
            query = query.filter(exp_stmt.c.total_days > 1095, exp_stmt.c.total_days <= 1825)
        elif experience_level == "senior":
            query = query.filter(exp_stmt.c.total_days > 1825)

    if education:
        query = query.filter(
            Candidate.educations.any(
                or_(
                    CandidateEducation.institution.ilike(f"%{education}%"),
                    CandidateEducation.major.ilike(f"%{education}%"),
                )
            )
        )

    if min_current_salary is not None:
        query = query.filter(Candidate.current_salary >= min_current_salary)
    if max_current_salary is not None:
        query = query.filter(Candidate.current_salary <= max_current_salary)
    if min_expected_salary is not None:
        query = query.filter(Candidate.expected_salary >= min_expected_salary)
    if max_expected_salary is not None:
        query = query.filter(Candidate.expected_salary <= max_expected_salary)

    candidates = query.all()

    # ── Determine dynamic column counts ─────────────────────────────────────
    max_educations = max((len(c.educations) for c in candidates), default=0)
    max_experiences = max((len(c.experiences) for c in candidates), default=0)
    # At least 1 slot each so headers always appear
    max_educations = max(max_educations, 1)
    max_experiences = max(max_experiences, 1)

    # ── Create workbook with two sheets ─────────────────────────────────────
    wb = Workbook()

    # ── Sheet 1: Kandidat ────────────────────────────────────────────────────
    ws = wb.active
    ws.title = "Kandidat"

    header_font = Font(bold=True)
    header_fill_green = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
    header_fill_blue = PatternFill(start_color="DDEEFF", end_color="DDEEFF", fill_type="solid")
    header_fill_orange = PatternFill(start_color="FFE0CC", end_color="FFE0CC", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    wrap_align = Alignment(wrap_text=True, vertical="top")

    # Build headers dynamically
    base_headers = [
        ("No", "green"),
        ("Nama", "green"),
        ("Email", "green"),
        ("Phone", "green"),
        ("NIK (KTP)", "green"),
        ("TTL", "green"),
        ("Jenis Kelamin", "green"),
        ("Golongan Darah", "green"),
        ("Domisili", "green"),
        ("Gaji Saat Ini", "green"),
        ("Gaji Ekspektasi", "green"),
        ("Notice Period (hari)", "green"),
        ("Tanggal Dibuat", "green"),
        ("Tanggal Diperbarui", "green"),
        ("Catatan Kandidat", "green"),
    ]

    edu_headers = []
    for i in range(1, max_educations + 1):
        edu_headers += [
            (f"Pendidikan {i} (Institusi)", "blue"),
            (f"Pendidikan {i} Jurusan", "blue"),
            (f"Pendidikan {i} Tahun Lulus", "blue"),
            (f"Pendidikan {i} IPK", "blue"),
        ]

    exp_headers = []
    for i in range(1, max_experiences + 1):
        exp_headers += [
            (f"Pengalaman {i} (Perusahaan)", "orange"),
            (f"Pengalaman {i} Posisi", "orange"),
            (f"Pengalaman {i} Mulai Kerja", "orange"),
            (f"Pengalaman {i} Akhir Kerja", "orange"),
        ]

    all_headers = base_headers + edu_headers + exp_headers

    # Write header row
    for col_num, (header, color) in enumerate(all_headers, 1):
        cell = ws.cell(row=1, column=col_num, value=header)
        cell.font = header_font
        cell.fill = header_fill_blue if color == "blue" else (
            header_fill_orange if color == "orange" else header_fill_green
        )
        cell.alignment = header_alignment

    ws.row_dimensions[1].height = 30

    # Sort educations/experiences by year desc / start_date desc for consistency
    for idx, candidate in enumerate(candidates, 1):
        sorted_edus = sorted(
            candidate.educations or [],
            key=lambda x: x.graduation_year or 0,
            reverse=True,
        )
        sorted_exps = sorted(
            candidate.experiences or [],
            key=lambda x: x.start_date or datetime.min.date(),
            reverse=True,
        )

        birth_str = ""
        if candidate.birth_place and candidate.birth_date:
            bd = candidate.birth_date
            birth_str = f"{candidate.birth_place}, {bd.strftime('%d-%m-%Y') if hasattr(bd, 'strftime') else bd}"
        elif candidate.birth_date:
            bd = candidate.birth_date
            birth_str = bd.strftime('%d-%m-%Y') if hasattr(bd, 'strftime') else str(bd)

        row: list = [
            idx,
            candidate.full_name or "",
            candidate.email or "",
            candidate.phone or "",
            candidate.identity_no or "",
            birth_str,
            candidate.gender or "",
            candidate.blood_type or "",
            candidate.domicile or "",
            float(candidate.current_salary) if candidate.current_salary else "",
            float(candidate.expected_salary) if candidate.expected_salary else "",
            candidate.notice_period_days or "",
            candidate.created_at.strftime("%d-%m-%Y") if candidate.created_at else "",
            candidate.updated_at.strftime("%d-%m-%Y") if candidate.updated_at else "",
            candidate.notes or "",
        ]

        # Education columns (padded to max_educations)
        for i in range(max_educations):
            if i < len(sorted_edus):
                edu = sorted_edus[i]
                row += [
                    edu.institution or "",
                    edu.major or "",
                    edu.graduation_year or "",
                    "",  # IPK — not stored yet, placeholder
                ]
            else:
                row += ["", "", "", ""]

        # Experience columns (padded to max_experiences)
        for i in range(max_experiences):
            if i < len(sorted_exps):
                exp = sorted_exps[i]
                start_str = exp.start_date.strftime("%d-%m-%Y") if exp.start_date else ""
                end_str = exp.end_date.strftime("%d-%m-%Y") if exp.end_date else "Sekarang"
                row += [
                    exp.company_name or "",
                    exp.job_title or "",
                    start_str,
                    end_str,
                ]
            else:
                row += ["", "", "", ""]

        ws.append(row)
        ws.row_dimensions[idx + 1].height = 15

    # Auto-adjust column widths for Sheet 1
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                cell_len = len(str(cell.value)) if cell.value else 0
                if cell_len > max_length:
                    max_length = cell_len
            except Exception:
                pass
        ws.column_dimensions[column_letter].width = min(max_length + 2, 45)

    ws.freeze_panes = "B2"

    # ── Sheet 2: Catatan ─────────────────────────────────────────────────────
    ws2 = wb.create_sheet(title="Catatan")

    note_header_fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
    note_headers = [
        "No",
        "Nama Kandidat",
        "Sumber Catatan",
        "Posisi Lamaran",
        "Tahap Seleksi",
        "Tanggal",
        "Isi Catatan",
    ]

    for col_num, header in enumerate(note_headers, 1):
        cell = ws2.cell(row=1, column=col_num, value=header)
        cell.font = header_font
        cell.fill = note_header_fill
        cell.alignment = header_alignment

    ws2.row_dimensions[1].height = 30

    note_row_idx = 2
    for candidate in candidates:
        # Row: catatan dari tabel candidate (Catatan Recruiter)
        if candidate.notes and candidate.notes.strip():
            ws2.append([
                note_row_idx - 1,
                candidate.full_name or "",
                "Catatan Recruiter",
                "",
                "",
                candidate.updated_at.strftime("%d-%m-%Y") if candidate.updated_at else "",
                candidate.notes,
            ])
            ws2.cell(row=note_row_idx, column=7).alignment = wrap_align
            note_row_idx += 1

        # Rows: catatan dari stage_history
        for app in (candidate.applications or []):
            position_title = app.position.title if app.position else ""
            sorted_histories = sorted(
                app.stage_histories or [],
                key=lambda h: h.created_at or datetime.min,
            )
            for h in sorted_histories:
                if h.notes and h.notes.strip():
                    date_str = h.created_at.strftime("%d-%m-%Y") if h.created_at else ""
                    ws2.append([
                        note_row_idx - 1,
                        candidate.full_name or "",
                        "Catatan Tahapan Seleksi",
                        position_title,
                        h.stage_name,
                        date_str,
                        h.notes,
                    ])
                    ws2.cell(row=note_row_idx, column=7).alignment = wrap_align
                    note_row_idx += 1

    # Auto-adjust column widths for Sheet 2
    col_widths = [5, 25, 25, 25, 25, 15, 60]
    for col_num, width in enumerate(col_widths, 1):
        ws2.column_dimensions[ws2.cell(row=1, column=col_num).column_letter].width = width

    ws2.freeze_panes = "A2"

    # Save to bytes buffer
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    return buffer.read()


def _get_excel_response_for_pipeline(
    db: Session,
    status_filter: Optional[str] = None,
    current_stage: Optional[str] = None,
    position_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> bytes:
    """
    Generate Excel file with pipeline data.
    Returns bytes of the Excel file.
    """
    # Build query with joins
    query = (
        db.query(Application)
        .options(
            joinedload(Application.candidate),
            joinedload(Application.position).joinedload(Position.client),
            joinedload(Application.recruiter),
            joinedload(Application.stage_histories),
            joinedload(Application.ai_screening_result),
        )
    )

    # Apply filters
    if status_filter:
        query = query.filter(Application.status == status_filter)
    if current_stage:
        query = query.filter(Application.current_stage == current_stage)
    if position_id:
        query = query.filter(Application.position_id == position_id)

    if start_date:
        query = query.filter(Application.created_at >= start_date)
    if end_date:
        query = query.filter(Application.created_at <= end_date)

    applications = query.all()

    # Create workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Pipeline"

    # Header row
    headers = [
        "No",
        "ID Lamaran",
        "Nama Kandidat",
        "Email Kandidat",
        "Phone Kandidat",
        "Posisi",
        "Client",
        "Stage Saat Ini",
        "Status Lamaran",
        "Tanggal Dibuat",
        "Tanggal Diperbarui",
        "Terakhir Update Stage",
        "Rekruter",
        "Hasil Terakhir",
    ]

    ws.append(headers)

    # Style header
    header_font = Font(bold=True)
    header_fill = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")

    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment

    # Data rows
    for idx, app in enumerate(applications, 1):
        # Get last stage history
        last_stage_history = None
        if app.stage_histories:
            last_stage_history = sorted(
                app.stage_histories,
                key=lambda x: x.created_at or datetime.min.replace(tzinfo=app.created_at.tzinfo),
            )[-1]

        row_data = [
            idx,
            str(app.id),
            app.candidate_name or "",
            app.candidate.email if app.candidate else "",
            app.candidate.phone if app.candidate else "",
            app.position_title if app.position else "",
            app.client_name if app.position and app.position.client else "",
            app.current_stage,
            app.status,
            app.created_at.strftime("%Y-%m-%d %H:%M:%S") if app.created_at else "",
            app.updated_at.strftime("%Y-%m-%d %H:%M:%S") if app.updated_at else "",
            last_stage_history.created_at.strftime("%Y-%m-%d %H:%M:%S") if last_stage_history and last_stage_history.created_at else "",
            app.recruiter_name if app.recruiter else "",
            last_stage_history.result if last_stage_history else "",
        ]

        ws.append(row_data)

    # Auto-adjust column widths
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width

    # Save to bytes buffer
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    return buffer.read()


def _get_excel_response_for_incomplete_candidates(
    db: Session,
    position_id: Optional[str] = None,
) -> bytes:
    """
    Generate Excel file with candidates that have incomplete data.
    Returns bytes of the Excel file.
    """
    # Build query with joins
    query = (
        db.query(Candidate)
        .options(
            joinedload(Candidate.documents),
            joinedload(Candidate.educations),
            joinedload(Candidate.experiences),
        )
        .filter(Candidate.is_deleted == False)
        .filter(Candidate.completeness_status == "belum_lengkap")
    )

    # Apply position filter
    if position_id:
        query = query.join(Application, Candidate.id == Application.candidate_id).filter(
            Application.position_id == position_id
        )

    candidates = query.all()

    # Create workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Incomplete Candidates"

    # Header row
    headers = [
        "No",
        "ID",
        "Nama",
        "Email",
        "Phone",
        "NIK (KTP)",
        "Dokumen Lengkap",
        "Dokumen Upload",
        "Dokumen KTP",
        "Dokumen Ijazah",
        "Dokumen Transkrip",
        "Dokumen CV_asli",
        "Dokumen Sertifikat",
        "Dokumen BPJS_TK",
        "Dokumen BPJS_Kesehatan",
        "Dokumen NPWP",
        "Catatan",
        "Tanggal Dibuat",
        "Tanggal Diperbarui",
    ]

    ws.append(headers)

    # Style header
    header_font = Font(bold=True)
    header_fill = PatternFill(start_color="FFE699", end_color="FFE699", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")

    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment

    # Data rows
    for idx, candidate in enumerate(candidates, 1):
        # Check which required documents are present
        docs = {doc.doc_type: doc for doc in candidate.documents}

        required_docs = {
            "Foto": False,
            "KTP": False,
            "Ijazah": False,
            "Transkrip": False,
            "CV_asli": False,
            "Sertifikat": False,
            "BPJS_TK": False,
            "BPJS_Kesehatan": False,
            "NPWP": False,
        }

        for doc_type in required_docs:
            if doc_type in docs:
                required_docs[doc_type] = True

        row_data = [
            idx,
            str(candidate.id),
            candidate.full_name or "",
            candidate.email or "",
            candidate.phone or "",
            candidate.identity_no or "",
            f"{sum(required_docs.values())}/{len(required_docs)} dokumen lengkap",
            "✓" if required_docs.get("Foto", False) else "✗",
            "✓" if required_docs.get("KTP", False) else "✗",
            "✓" if required_docs.get("Ijazah", False) else "✗",
            "✓" if required_docs.get("Transkrip", False) else "✗",
            "✓" if required_docs.get("CV_asli", False) else "✗",
            "✓" if required_docs.get("Sertifikat", False) else "✗",
            "✓" if required_docs.get("BPJS_TK", False) else "✗",
            "✓" if required_docs.get("BPJS_Kesehatan", False) else "✗",
            "✓" if required_docs.get("NPWP", False) else "✗",
            candidate.notes or "",
            candidate.created_at.strftime("%Y-%m-%d %H:%M:%S") if candidate.created_at else "",
            candidate.updated_at.strftime("%Y-%m-%d %H:%M:%S") if candidate.updated_at else "",
        ]

        ws.append(row_data)

    # Auto-adjust column widths
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width

    # Save to bytes buffer
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    return buffer.read()