/**
 * API layer untuk modul karyawan.
 */
import api from "@/lib/api";
import type {
  Employee,
  EmployeeContract,
  EmployeePayroll,
  EmployeeDocument,
} from "@/types";

// ── List / Detail / Update ───────────────────────────────────────────────────────
export async function fetchEmployees(params?: {
  status?: string;
  placement?: string;
  contract_expiry_within_days?: number;
  skip?: number;
  limit?: number;
}): Promise<Employee[]> {
  const response = await api.get("/api/v1/employees/", { params });
  return response.data as Employee[];
}

export async function fetchEmployee(id: string): Promise<Employee> {
  const response = await api.get(`/api/v1/employees/${id}`);
  return response.data as Employee;
}

export async function updateEmployee(
  id: string,
  payload: Partial<Employee>,
): Promise<Employee> {
  const response = await api.put(`/api/v1/employees/${id}`, payload);
  return response.data as Employee;
}

// ── Contracts ────────────────────────────────────────────────────────────────────
export async function fetchContracts(employeeId: string): Promise<EmployeeContract[]> {
  const response = await api.get(`/api/v1/employees/${employeeId}/contracts/`);
  return response.data as EmployeeContract[];
}

export async function addContract(
  employeeId: string,
  payload: Partial<EmployeeContract>,
): Promise<EmployeeContract> {
  const response = await api.post(
    `/api/v1/employees/${employeeId}/contracts/`,
    payload,
  );
  return response.data as EmployeeContract;
}

export async function updateContract(
  employeeId: string,
  contractId: string,
  payload: Partial<EmployeeContract>,
): Promise<EmployeeContract> {
  const response = await api.put(
    `/api/v1/employees/${employeeId}/contracts/${contractId}`,
    payload,
  );
  return response.data as EmployeeContract;
}

export async function deleteContract(employeeId: string, contractId: string): Promise<void> {
  await api.delete(`/api/v1/employees/${employeeId}/contracts/${contractId}`);
}

// ── Payroll (Manager/Admin only) ────────────────────────────────────────────────
export async function fetchPayroll(employeeId: string): Promise<EmployeePayroll> {
  const response = await api.get(`/api/v1/employees/${employeeId}/payroll`);
  return response.data as EmployeePayroll;
}

export async function updatePayroll(
  employeeId: string,
  payload: Partial<EmployeePayroll>,
): Promise<EmployeePayroll> {
  const response = await api.put(
    `/api/v1/employees/${employeeId}/payroll`,
    payload,
  );
  return response.data as EmployeePayroll;
}

// ── Documents ────────────────────────────────────────────────────────────────────
export async function fetchDocuments(employeeId: string): Promise<EmployeeDocument[]> {
  const response = await api.get(`/api/v1/employees/${employeeId}/documents/`);
  return response.data as EmployeeDocument[];
}

export async function uploadDocument(
  employeeId: string,
  docType: string,
  file: File,
): Promise<EmployeeDocument> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post(
    `/api/v1/employees/${employeeId}/documents/?doc_type=${encodeURIComponent(docType)}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data as EmployeeDocument;
}

export async function verifyDocument(
  employeeId: string,
  documentId: string,
): Promise<EmployeeDocument> {
  const response = await api.patch(
    `/api/v1/employees/${employeeId}/documents/${documentId}/verify`,
  );
  return response.data as EmployeeDocument;
}

export async function deleteDocument(
  employeeId: string,
  documentId: string,
): Promise<void> {
  await api.delete(`/api/v1/employees/${employeeId}/documents/${documentId}`);
}
