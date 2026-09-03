// Tipe-tipe TypeScript utama — diselaraskan dengan model database
// TODO: generate otomatis dari OpenAPI schema FastAPI (opsional)

export type UserRole = "admin" | "hr" | "manager";

export interface AuthUser {
  name: string;
  email: string;
  role: UserRole;
}

// --- Candidate ---
export type CompletenessStatus = "lengkap" | "belum_lengkap";
export type ContactStatus = "aktif" | "tidak_bisa_dihubungi";

export interface Candidate {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  identity_no?: string;
  domicile?: string;
  photo_url?: string;
  source_channel?: string;
  current_salary?: number;
  expected_salary?: number;
  notice_period_days?: number;
  completeness_status: CompletenessStatus;
  contact_status: ContactStatus;
  possible_duplicate: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateEducation {
  id: string;
  candidate_id: string;
  institution?: string;
  major?: string;
  graduation_year?: number;
  gpa?: number;
}

export interface CandidateExperience {
  id: string;
  candidate_id: string;
  company_name?: string;
  job_title?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

export interface CandidateDocument {
  id: string;
  candidate_id: string;
  doc_type: string;
  file_url?: string;
  drive_item_id?: string;
  is_verified: boolean;
  uploaded_at: string;
}

// --- Application / Pipeline ---
export type ApplicationStatus = "active" | "rejected" | "hired" | "withdrawn";

export interface Application {
  id: string;
  candidate_id: string;
  position_id: string;
  recruiter_id?: string;
  current_stage: string;
  status: ApplicationStatus;
  cv_submitted_to_pm_date?: string;
  created_at: string;
  candidate?: Pick<Candidate, "id" | "full_name" | "email">;
}

export interface StageHistory {
  id: string;
  application_id: string;
  stage_name: string;
  scheduled_date?: string;
  actual_date?: string;
  result?: string;
  salary_current_input?: number;
  salary_expected_input?: number;
  notes?: string;
  updated_by?: string;
  created_at: string;
}

// --- Employee ---
export type EmployeeStatus = "aktif" | "cuti" | "resign";

export interface Employee {
  id: string;
  candidate_id: string;
  application_id?: string;
  employee_nip?: string;
  full_name: string;
  birth_date?: string;
  birth_place?: string;
  gender?: string;
  blood_type?: string;
  personal_email?: string;
  office_email?: string;
  phone_number?: string;
  placement?: string;
  role_level?: string;
  employee_status: EmployeeStatus;
  leave_status: string;
  resign_date?: string;
  resign_reason?: string;
  notes?: string;
  // Computed di frontend dari birth_date
  age?: number;
}

export interface EmployeeContract {
  id: string;
  employee_id: string;
  agreement_type_id?: string;
  contract_number?: string;
  duration_months?: number;
  join_date?: string;
  end_date?: string;
  status: string;
  // Computed
  months_running?: number;
}

// --- Pagination ---
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    per_page: number;
    total: number;
  };
}

// --- API Error ---
export interface APIError {
  success: false;
  error: {
    code: string;
    message: string;
    detail?: Record<string, unknown>;
  };
}
