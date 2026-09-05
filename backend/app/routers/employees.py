from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, require_role

router = APIRouter()


@router.get("")
def list_employees(current_user=Depends(require_role("hr", "manager", "admin"))):
    return {"message": "TODO: list employees"}


@router.get("/{employee_id}")
def get_employee(employee_id: str, current_user=Depends(require_role("hr", "manager", "admin"))):
    # Tidak termasuk payroll — endpoint terpisah
    return {"message": f"TODO: get employee {employee_id}"}


@router.put("/{employee_id}")
def update_employee(employee_id: str, current_user=Depends(require_role("hr", "manager", "admin"))):
    return {"message": "TODO"}


# --- Contracts ---
@router.get("/{employee_id}/contracts/")
def list_contracts(employee_id: str, current_user=Depends(require_role("hr", "manager", "admin"))):
    return {"message": "TODO"}


@router.post("/{employee_id}/contracts/")
def add_contract(employee_id: str, current_user=Depends(require_role("hr", "manager", "admin"))):
    return {"message": "TODO"}


# --- Payroll (Manager & Admin only) ---
@router.get("/{employee_id}/payroll")
def get_payroll(employee_id: str, current_user=Depends(require_role("manager", "admin"))):
    return {"message": "TODO: get payroll"}


@router.put("/{employee_id}/payroll")
def update_payroll(employee_id: str, current_user=Depends(require_role("manager", "admin"))):
    return {"message": "TODO: update payroll"}


# --- Documents ---
@router.get("/{employee_id}/documents/")
def list_documents(employee_id: str, current_user=Depends(require_role("hr", "manager", "admin"))):
    return {"message": "TODO"}


@router.post("/{employee_id}/documents/")
def upload_document(employee_id: str, current_user=Depends(require_role("hr", "manager", "admin"))):
    return {"message": "TODO: upload employee document"}
