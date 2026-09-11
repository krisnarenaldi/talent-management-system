from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy import and_
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, get_current_user, require_role
from app.models.employee import Employee, EmployeeContract, EmployeePayroll, EmployeeDocument
from app.schemas.employee import (
    EmployeeUpdate,
    EmployeeResponse,
    EmployeeContractCreate,
    EmployeeContractUpdate,
    EmployeeContractResponse,
    EmployeePayrollUpdate,
    EmployeePayrollResponse,
    EmployeeDocumentResponse,
)
from app.services import employee_service
from app.services.storage_service import get_storage_service

router = APIRouter()


# Helper function to raise 404
def _raise_404(msg: str) -> None:
    raise HTTPException(status_code=404, detail=msg)


# ── List employees ───────────────────────────────────────────────────────────────
@router.get("", response_model=list[EmployeeResponse])
def list_employees(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    placement: Optional[str] = Query(None),
    contract_expiry_within_days: Optional[int] = Query(
        None, description="Filter employees whose active contract expires within N days"
    ),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    query = (
        db.query(Employee)
        .options(joinedload(Employee.contracts))
    )
    if status:
        query = query.filter(Employee.employee_status == status)
    if placement:
        query = query.filter(Employee.placement == placement)
    if contract_expiry_within_days is not None:
        # Gunakan JOIN untuk filter by contract end_date + distinct() agar tidak duplikat
        query = (
            query.join(Employee.contracts)
            .filter(
                and_(
                    EmployeeContract.status == "aktif",
                    EmployeeContract.end_date >= date.today(),
                    EmployeeContract.end_date <= date.today() + timedelta(days=contract_expiry_within_days),
                )
            )
        )
    employees = query.distinct().offset(skip).limit(limit).all()

    # Compute age and contract duration running for each employee
    for emp in employees:
        emp.age = employee_service.calculate_age(emp.birth_date)
        # Find active contract (using eager-loaded contracts collection)
        contract_duration = None
        for contract in emp.contracts:
            if contract.status == "aktif":
                contract_duration = employee_service.calculate_contract_duration(contract.join_date)
                break
        emp.contract_duration_running = contract_duration

    return employees


# ── Get employee detail ───────────────────────────────────────────────────────────
@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    employee = employee_service.get_employee_details(db, employee_id)
    if not employee:
        _raise_404("Karyawan tidak ditemukan")
    return employee


# ── Update employee ───────────────────────────────────────────────────────────────
@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: str,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        _raise_404("Karyawan tidak ditemukan")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(employee, key, value)

    db.commit()

    # Re-query dengan eager-load contracts agar tidak lazy-load + compute fields
    employee = (
        db.query(Employee)
        .options(joinedload(Employee.contracts))
        .filter(Employee.id == employee_id)
        .first()
    )
    employee.age = employee_service.calculate_age(employee.birth_date)
    contract_duration = None
    for contract in employee.contracts:
        if contract.status == "aktif":
            contract_duration = employee_service.calculate_contract_duration(contract.join_date)
            break
    employee.contract_duration_running = contract_duration

    return employee


# ── Contracts CRUD ───────────────────────────────────────────────────────────────
@router.get("/{employee_id}/contracts/", response_model=list[EmployeeContractResponse])
def list_contracts(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first() or _raise_404("Karyawan tidak ditemukan")
    return db.query(EmployeeContract).filter(EmployeeContract.employee_id == employee_id).all()


@router.post("/{employee_id}/contracts/", response_model=EmployeeContractResponse, status_code=status.HTTP_201_CREATED)
def add_contract(
    employee_id: str,
    payload: EmployeeContractCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first() or _raise_404("Karyawan tidak ditemukan")
    contract = EmployeeContract(employee_id=employee_id, **payload.model_dump())
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


@router.put("/{employee_id}/contracts/{contract_id}", response_model=EmployeeContractResponse)
def update_contract(
    employee_id: str,
    contract_id: str,
    payload: EmployeeContractUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    contract = (
        db.query(EmployeeContract)
        .filter(EmployeeContract.id == contract_id, EmployeeContract.employee_id == employee_id)
        .first()
    ) or _raise_404("Kontrak tidak ditemukan")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(contract, key, value)

    db.commit()
    db.refresh(contract)
    return contract


@router.delete("/{employee_id}/contracts/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contract(
    employee_id: str,
    contract_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    contract = (
        db.query(EmployeeContract)
        .filter(EmployeeContract.id == contract_id, EmployeeContract.employee_id == employee_id)
        .first()
    ) or _raise_404("Kontrak tidak ditemukan")
    db.delete(contract)
    db.commit()


# ── Payroll (Manager & Admin only) ───────────────────────────────────────────────
@router.get("/{employee_id}/payroll", response_model=EmployeePayrollResponse)
def get_payroll(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("manager", "admin")),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first() or _raise_404("Karyawan tidak ditemukan")
    payroll = db.query(EmployeePayroll).filter(EmployeePayroll.employee_id == employee_id).first()
    if not payroll:
        _raise_404("Data payroll tidak ditemukan untuk karyawan ini")
    return payroll


@router.put("/{employee_id}/payroll", response_model=EmployeePayrollResponse)
def update_payroll(
    employee_id: str,
    payload: EmployeePayrollUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("manager", "admin")),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first() or _raise_404("Karyawan tidak ditemukan")
    payroll = db.query(EmployeePayroll).filter(EmployeePayroll.employee_id == employee_id).first()
    if not payroll:
        _raise_404("Data payroll tidak ditemukan untuk karyawan ini")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(payroll, key, value)

    db.commit()
    db.refresh(payroll)
    return payroll


# ── Documents CRUD ───────────────────────────────────────────────────────────────
@router.get("/{employee_id}/documents/", response_model=list[EmployeeDocumentResponse])
def list_documents(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first() or _raise_404("Karyawan tidak ditemukan")
    return (
        db.query(EmployeeDocument)
        .filter(
            EmployeeDocument.employee_id == employee_id,
            EmployeeDocument.is_deleted == False,
        )
        .all()
    )


@router.post("/{employee_id}/documents/", response_model=EmployeeDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    employee_id: str,
    doc_type: str = Query(..., description="KTP/Ijazah/Transkrip/CV_asli/Foto/Sertifikat/BPJS_TK/BPJS_Kesehatan/NPWP"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    # Validasi karyawan
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # max 10MB
        raise HTTPException(status_code=413, detail="Ukuran file maksimal 10MB")

    folder = f"Employees/{employee_id}"
    storage = get_storage_service()
    result = await storage.upload(
        file_content=content,
        filename=file.filename or f"{doc_type}.pdf",
        folder=folder,
    )

    doc = EmployeeDocument(
        employee_id=employee_id,
        doc_type=doc_type,
        file_url=result["file_url"],
        drive_item_id=None,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return doc


@router.get("/{employee_id}/documents/{document_id}/download-url", response_model=dict)
async def get_download_url(
    employee_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    doc = (
        db.query(EmployeeDocument)
        .filter(
            EmployeeDocument.id == document_id,
            EmployeeDocument.employee_id == employee_id,
            EmployeeDocument.is_deleted == False,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    if not doc.file_url:
        raise HTTPException(status_code=400, detail="File belum diupload")

    storage = get_storage_service()
    if doc.drive_item_id:
        url = await storage.get_download_url(doc.drive_item_id)
    else:
        url = doc.file_url
    return {"download_url": url}


@router.patch("/{employee_id}/documents/{document_id}/verify", response_model=EmployeeDocumentResponse)
def toggle_verify_document(
    employee_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    doc = (
        db.query(EmployeeDocument)
        .filter(
            EmployeeDocument.id == document_id,
            EmployeeDocument.employee_id == employee_id,
            EmployeeDocument.is_deleted == False,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    doc.is_verified = not doc.is_verified
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{employee_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    employee_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("hr", "manager", "admin")),
):
    doc = (
        db.query(EmployeeDocument)
        .filter(
            EmployeeDocument.id == document_id,
            EmployeeDocument.employee_id == employee_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    doc.is_deleted = True
    storage = get_storage_service()
    if not doc.drive_item_id and doc.file_url:
        try:
            await storage.delete(doc.file_url)
        except Exception:
            pass
    elif doc.drive_item_id:
        try:
            await storage.delete_file(doc.drive_item_id)
        except Exception:
            pass
    db.commit()
