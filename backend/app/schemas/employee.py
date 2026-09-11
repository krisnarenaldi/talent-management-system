from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from app.core.pydantic_utils import AutoStrUUID
from app.models.employee import EMPLOYEE_STATUSES, LEAVE_STATUSES, CONTRACT_STATUSES


class EmployeeBase(BaseModel):
    candidate_id: AutoStrUUID
    application_id: Optional[AutoStrUUID] = None
    employee_nip: Optional[str] = None
    full_name: str
    birth_date: Optional[date] = None
    birth_place: Optional[str] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    personal_email: Optional[str] = None
    office_email: Optional[str] = None
    phone_number: Optional[str] = None
    identity_no: Optional[str] = None
    placement: Optional[str] = None
    role_level: Optional[str] = None
    employee_status: Optional[str] = Field(None, enum=EMPLOYEE_STATUSES)
    leave_status: Optional[str] = Field(None, enum=LEAVE_STATUSES)
    resign_date: Optional[date] = None
    resign_reason: Optional[str] = None
    notes: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    birth_date: Optional[date] = None
    birth_place: Optional[str] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    personal_email: Optional[str] = None
    office_email: Optional[str] = None
    phone_number: Optional[str] = None
    identity_no: Optional[str] = None
    placement: Optional[str] = None
    role_level: Optional[str] = None
    employee_status: Optional[str] = Field(None, enum=EMPLOYEE_STATUSES)
    leave_status: Optional[str] = Field(None, enum=LEAVE_STATUSES)
    resign_date: Optional[date] = None
    resign_reason: Optional[str] = None
    notes: Optional[str] = None


class EmployeeResponse(EmployeeBase):
    id: AutoStrUUID
    age: Optional[int] = None
    contract_duration_running: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EmployeeContractBase(BaseModel):
    agreement_type_id: Optional[AutoStrUUID] = None
    contract_number: Optional[str] = None
    duration_months: Optional[int] = None
    join_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = Field(None, enum=CONTRACT_STATUSES)


class EmployeeContractCreate(EmployeeContractBase):
    pass


class EmployeeContractUpdate(BaseModel):
    agreement_type_id: Optional[AutoStrUUID] = None
    contract_number: Optional[str] = None
    duration_months: Optional[int] = None
    join_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = Field(None, enum=CONTRACT_STATUSES)


class EmployeeContractResponse(EmployeeContractBase):
    id: AutoStrUUID
    employee_id: AutoStrUUID
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EmployeePayrollBase(BaseModel):
    thp: Optional[Decimal] = None
    allowance_used: Optional[str] = None
    payroll_bank: Optional[str] = None
    bank_account_number: Optional[str] = None
    bpjs_tk_status: Optional[str] = None
    bpjs_tk_number: Optional[str] = None
    bpjs_kesehatan_status: Optional[str] = None
    bpjs_kesehatan_number: Optional[str] = None
    npwp_number: Optional[str] = None


class EmployeePayrollCreate(EmployeePayrollBase):
    pass


class EmployeePayrollUpdate(BaseModel):
    thp: Optional[Decimal] = None
    allowance_used: Optional[str] = None
    payroll_bank: Optional[str] = None
    bank_account_number: Optional[str] = None
    bpjs_tk_status: Optional[str] = None
    bpjs_tk_number: Optional[str] = None
    bpjs_kesehatan_status: Optional[str] = None
    bpjs_kesehatan_number: Optional[str] = None
    npwp_number: Optional[str] = None


class EmployeePayrollResponse(EmployeePayrollBase):
    id: AutoStrUUID
    employee_id: AutoStrUUID
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EmployeeDocumentBase(BaseModel):
    doc_type: str
    file_url: Optional[str] = None
    drive_item_id: Optional[str] = None
    is_verified: Optional[bool] = None
    is_deleted: Optional[bool] = None


class EmployeeDocumentCreate(EmployeeDocumentBase):
    pass


class EmployeeDocumentUpdate(BaseModel):
    doc_type: Optional[str] = None
    file_url: Optional[str] = None
    drive_item_id: Optional[str] = None
    is_verified: Optional[bool] = None
    is_deleted: Optional[bool] = None


class EmployeeDocumentResponse(EmployeeDocumentBase):
    id: AutoStrUUID
    employee_id: AutoStrUUID
    uploaded_at: Optional[datetime] = None

    class Config:
        from_attributes = True
