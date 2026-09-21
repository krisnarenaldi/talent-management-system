// Tipe-tipe TypeScript utama — diselaraskan dengan model database

export type UserRole = "admin" | "hr" | "manager" | "pm";

export interface AuthUser {
  id?: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Client ---
export interface Client {
  id: string;
  name: string;
  industry: string | null;
  pic_name: string | null;
  pic_contact: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Position ---
export interface AIScoringConfig {
  threshold_auto_recommend?: number;
  threshold_manual_review?: number;
  weights?: {
    education?: number;
    experience_years?: number;
    skill_match?: number;
    domain_relevance?: number;
  };
  required_skills?: string[];
  min_experience_years?: number;
}

export interface Position {
  id: string;
  client_id: string;
  client_name: string;
  title: string;
  requirement: string | null;
  employment_type: string | null;
  contract_duration_months: number | null;
  is_active: boolean;
  ai_scoring_config: AIScoringConfig | null;
  created_at: string;
  updated_at: string;
}

// --- Master data ---
export interface BlacklistStatusType {
  id: string;
  label: string;
  is_active: boolean;
}

export interface AgreementType {
  id: string;
  label: string;
  is_active: boolean;
}

// --- Source Channel ---
export interface SourceChannel {
  id: string;
  label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SourceChannelCreate {
  label: string;
}

export interface SourceChannelUpdate {
  label?: string;
  is_active?: boolean;
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
  birth_date?: string;
  birth_place?: string;
  gender?: string;
  blood_type?: string;
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
  skills?: string[];
  is_blacklisted?: boolean;
  is_deleted?: boolean;
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
  candidate_name?: string;
  position_id: string;
  position_title?: string;
  client_name?: string;
  recruiter_id?: string;
  recruiter_name?: string;
  current_stage: string;
  status: ApplicationStatus;
  last_result?: string | null;
  cv_submitted_to_pm_date?: string;
  created_at: string;
  updated_at?: string;
  candidate?: Pick<Candidate, "id" | "full_name" | "email">;
  ai_score?: number | null;
  ai_screening_status?: string | null;
  ai_screening?: {
    ai_score?: number | null;
    ai_screening_status?: string | null;
    score?: number | null;
    notes?: string | null;
    extracted_summary?: Record<string, unknown> | null;
  } | null;
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
  handler_id?: string | null;
  handler_name?: string | null;
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
  identity_no?: string;
  placement?: string;
  role_level?: string;
  employee_status: EmployeeStatus;
  leave_status: string;
  resign_date?: string;
  resign_reason?: string;
  notes?: string;
  // Computed
  age?: number;
  contract_duration_running?: number;
  is_blacklisted?: boolean;
  created_at?: string;
  updated_at?: string;
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
  contract_duration_running?: number;
  created_at?: string;
}

export interface EmployeePayroll {
  id: string;
  employee_id: string;
  thp?: number;
  allowance_used?: string;
  payroll_bank?: string;
  bank_account_number?: string;
  bpjs_tk_status?: string;
  bpjs_tk_number?: string;
  bpjs_kesehatan_status?: string;
  bpjs_kesehatan_number?: string;
  npwp_number?: string;
  updated_at?: string;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  doc_type: string;
  file_url?: string;
  drive_item_id?: string;
  is_verified: boolean;
  is_deleted?: boolean;
  uploaded_at?: string;
}

// --- Analytics / Dashboard ---
export interface PipelineBreakdown {
  stage: string;
  count: number;
}

export interface AnalyticsSummary {
  total_active_candidates: number;
  pipeline_breakdown: PipelineBreakdown[];
  total_active_employees: number;
  contracts_expiring_30d: number;
}

export interface RecentApplication {
  id: string;
  candidate_name: string | null;
  position_title: string | null;
  client_name: string | null;
  current_stage: string;
  status: string;
  recruiter_name: string | null;
  created_at: string | null;
}

export interface ContractExpiring {
  contract_id: string;
  employee_name: string | null;
  placement: string | null;
  end_date: string | null;
  days_remaining: number | null;
}

export interface PipelineAnalyticsItem {
  stage: string;
  position_id?: string;
  position_title?: string;
  client_name?: string;
  period: string;
  count: number;
}

export interface PositionSuccessRate {
  position_id: string;
  position_title: string;
  client_name: string;
  total_applications: number;
  passed_user_interview: number;
  success_rate: number;
}

export interface SourceSuccessRate {
  source_channel: string;
  total_applications: number;
  passed_user_interview: number;
  success_rate: number;
}

export interface RecruiterWorkload {
  recruiter_id: string;
  recruiter_name: string;
  total_applications_all_time: number;
  active_candidates: number;
  hired_count: number;
  rejected_count: number;
}

export interface ApplicationByPosition {
  position_title: string;
  total_applications: number;
}

export interface ApplicationByCompany {
  client_name: string;
  total_applications: number;
}

// --- Blacklist ---
export interface Blacklist {
  id: string;
  candidate_id?: string;
  employee_id?: string;
  status_type_id: string;
  reason: string | null;
  notes: string | null;
  blacklisted_date: string | null;
  pic_user_id: string | null;
  is_approved: boolean;
  approved_by: string | null;
  is_active: boolean;
  created_at: string;
  target_name: string;
  target_email?: string | null;
  target_phone?: string | null;
  target_type: "candidate" | "employee";
  status_type_label: string;
  pic_name?: string | null;
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

// --- AI Natural Language Search (TASK-14) ---
export interface NLSearchFilters {
  skills?: string[];
  domicile?: string;
  gender?: string;
  source_channel?: string;
  completeness_status?: string;
  contact_status?: string;
  min_current_salary?: number;
  max_current_salary?: number;
  min_expected_salary?: number;
  max_expected_salary?: number;
  max_notice_period_days?: number;
  education_major?: string;
  education_institution?: string;
  min_gpa?: number;
  experience_job_title?: string;
  experience_company?: string;
  keyword?: string;
}

export interface NLSearchResponse {
  query: string;
  filters_applied: NLSearchFilters;
  description: string;
  results: Candidate[];
  results_count: number;
  has_more: boolean;
}

// --- AI Screening ---
export interface AIScreeningResult {
  id: string;
  application_id?: string | null;
  candidate_id?: string | null;
  position_id: string;
  uploaded_by?: string | null;
  cv_file_url?: string | null;
  cv_drive_item_id?: string | null;
  ai_score?: number | null;
  ai_notes?: string | null;
  extracted_json?: Record<string, unknown> | null;
  status: "menunggu_screening_ai" | "sedang_diproses" | "siap_review" | "sudah_direview" | "error";
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  position_title?: string;
  client_name?: string;
  uploaded_by_name?: string;
}

// --- Notification ---
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
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

// --- Generated CV (TASK-10) ---
export type CVLanguage = "ID" | "EN";
export type CVSummarySource = "AI" | "HR";

export interface GeneratedCV {
  id: string;
  candidate_id: string;
  application_id?: string | null;
  template_used?: string | null;
  language?: CVLanguage | null;
  summary_source?: CVSummarySource | null;
  summary_text?: string | null;
  file_url?: string | null;
  drive_item_id?: string | null;
  generated_at: string;
  /** True if candidate data was updated after this CV was generated. */
  is_stale: boolean;
}

export interface CVGenerateRequest {
  language: CVLanguage;
  summary_text?: string | null;
  force_regenerate?: boolean;
}

export interface CVGenerateResponse extends GeneratedCV {
  /** True if the existing cached CV was returned without regeneration. */
  was_cached: boolean;
  message: string;
}
