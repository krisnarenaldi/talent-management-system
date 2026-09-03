-- =============================================================================
-- DDL — Talent Management System (TMS)
-- Target Database : PostgreSQL 17.x
-- Sumber Kebenaran : backend/app/models/*.py (SQLAlchemy models)
-- Dibuat pada      : 2026-09-02
--
-- Cara pakai       :
--   1. CREATE DATABASE tms_db;
--   2. \c tms_db
--   3. \i docs/DDL-TMS.sql
--
-- Catatan:
--   - Untuk default UUID PK menggunakan gen_random_uuid() — native PG 13+,
--     TIDAK PERLU extension pgcrypto.
--   - Kolom `updated_at` di-auto-update oleh SQLAlchemy ORM via `onupdate=func.now()`.
--     Jika Anda menjalankan SQL di luar ORM (mis. psql), jalankan trigger tambahan
--     di bagian akhir file ini (opsional).
-- =============================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

-- =============================================================================
-- 1. POSTGRESQL ENUM TYPES  (sesuai SQLAlchemy Enum di model)
-- =============================================================================

CREATE TYPE user_role_enum AS ENUM (
    'admin',
    'hr',
    'manager'
);

CREATE TYPE completeness_status_enum AS ENUM (
    'lengkap',
    'belum_lengkap'
);

CREATE TYPE contact_status_enum AS ENUM (
    'aktif',
    'tidak_bisa_dihubungi'
);

CREATE TYPE application_status_enum AS ENUM (
    'active',
    'rejected',
    'hired',
    'withdrawn'
);

CREATE TYPE employee_status_enum AS ENUM (
    'aktif',
    'cuti',
    'resign'
);

CREATE TYPE leave_status_enum AS ENUM (
    'sudah_bisa_cuti',
    'belum'
);

CREATE TYPE contract_status_enum AS ENUM (
    'aktif',
    'berakhir',
    'diperpanjang'
);

-- =============================================================================
-- 2. TABLES  (urutan berdasarkan dependency foreign key)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 USER  (Login & RBAC)
-- -----------------------------------------------------------------------------
CREATE TABLE public."user" (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               VARCHAR(255) NOT NULL,
    email              VARCHAR(255) NOT NULL,
    hashed_password    VARCHAR(255) NOT NULL,
    role               user_role_enum NOT NULL,
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_email UNIQUE (email)
);

CREATE INDEX idx_user_email ON public."user" (email);

COMMENT ON TABLE  public."user"                IS 'Pengguna sistem (Admin, HR, Manager)';
COMMENT ON COLUMN public."user".hashed_password IS 'Password di-hash dengan bcrypt (passlib), JANGAN simpan plain text';
COMMENT ON COLUMN public."user".role           IS 'Role RBAC: admin/hr/manager';

-- -----------------------------------------------------------------------------
-- 2.2 CLIENT  (Perusahaan klien Altek, mis. Bank ABC)
-- -----------------------------------------------------------------------------
CREATE TABLE public.client (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    industry      VARCHAR(255),
    pic_name      VARCHAR(255),
    pic_contact   VARCHAR(100),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.client IS 'Perusahaan klien / perusahaan tempat talent ditempatkan (mayoritas Bank)';

-- -----------------------------------------------------------------------------
-- 2.3 BLACKLIST_STATUS_TYPE  (Master data jenis alasan blacklist)
-- -----------------------------------------------------------------------------
CREATE TABLE public.blacklist_status_type (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label       VARCHAR(255) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_by  UUID REFERENCES public."user"(id) ON DELETE SET NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  public.blacklist_status_type IS 'Master data: jenis/kategori alasan blacklist (bisa ditambah Admin tanpa deploy)';
COMMENT ON COLUMN public.blacklist_status_type.label IS 'Contoh: Menolak Offer Tanpa Alasan, No-Show, Manipulasi Data, dll';

-- -----------------------------------------------------------------------------
-- 2.4 AGREEMENT_TYPE  (Master data jenis perjanjian Altek-Klien)
-- -----------------------------------------------------------------------------
CREATE TABLE public.agreement_type (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label       VARCHAR(255) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_by  UUID REFERENCES public."user"(id) ON DELETE SET NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  public.agreement_type IS 'Master data: jenis perjanjian kontrak Altek-Klien (PKWT, PKWTT, PPJP, dll)';

-- -----------------------------------------------------------------------------
-- 2.5 POSITION  (Lowongan / posisi per client)
-- -----------------------------------------------------------------------------
CREATE TABLE public.position (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id                UUID NOT NULL REFERENCES public.client(id) ON DELETE RESTRICT,
    title                    VARCHAR(255) NOT NULL,
    requirement              TEXT,
    employment_type          VARCHAR(100),
    contract_duration_months INTEGER,
    is_active                BOOLEAN NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_position_client_id ON public.position (client_id);

COMMENT ON TABLE  public.position IS 'Lowongan / posisi terbuka per client (satu client bisa punya banyak position)';
COMMENT ON COLUMN public.position.requirement IS 'Requirement/kualifikasi posisi — dipakai AI untuk matching/scoring kandidat';

-- -----------------------------------------------------------------------------
-- 2.6 CANDIDATE  (Data pribadi kandidat / talent)
-- -----------------------------------------------------------------------------
CREATE TABLE public.candidate (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name             VARCHAR(255) NOT NULL,
    email                 VARCHAR(255),
    phone                 VARCHAR(50),
    identity_no           VARCHAR(20),
    domicile              VARCHAR(255),
    photo_url             VARCHAR(500),
    source_channel        VARCHAR(100),
    current_salary        NUMERIC(15, 2),
    expected_salary       NUMERIC(15, 2),
    notice_period_days    INTEGER,
    completeness_status   completeness_status_enum DEFAULT 'belum_lengkap',
    contact_status        contact_status_enum DEFAULT 'aktif',
    possible_duplicate    BOOLEAN NOT NULL DEFAULT FALSE,
    notes                 TEXT,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_candidate_email      ON public.candidate (email);
CREATE INDEX idx_candidate_phone      ON public.candidate (phone);
CREATE INDEX idx_candidate_identity_no ON public.candidate (identity_no);

COMMENT ON TABLE  public.candidate IS 'Data utama kandidat/talent (satu orang = 1 baris; bisa punya banyak lamaran/application)';
COMMENT ON COLUMN public.candidate.identity_no        IS 'NIK KTP — untuk deteksi duplikat & blacklist match';
COMMENT ON COLUMN public.candidate.possible_duplicate IS 'TRUE jika email / phone / NIK partial match dengan kandidat lain — perlu review manual';
COMMENT ON COLUMN public.candidate.source_channel     IS 'Sumber kandidat: LinkedIn, Glints, Email, Walk-in, Referensi, dll';

-- -----------------------------------------------------------------------------
-- 2.7 CANDIDATE_EDUCATION  (Riwayat pendidikan per kandidat)
-- -----------------------------------------------------------------------------
CREATE TABLE public.candidate_education (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL REFERENCES public.candidate(id) ON DELETE CASCADE,
    institution     VARCHAR(255),
    major           VARCHAR(255),
    graduation_year INTEGER,
    gpa             NUMERIC(3, 2)
);

CREATE INDEX idx_candidate_education_candidate_id ON public.candidate_education (candidate_id);

COMMENT ON TABLE public.candidate_education IS 'Riwayat pendidikan kandidat — 1 kandidat bisa >1 entri (SMA, S1, S2, dll)';

-- -----------------------------------------------------------------------------
-- 2.8 CANDIDATE_EXPERIENCE  (Riwayat pekerjaan per kandidat)
-- -----------------------------------------------------------------------------
CREATE TABLE public.candidate_experience (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id  UUID NOT NULL REFERENCES public.candidate(id) ON DELETE CASCADE,
    company_name  VARCHAR(255),
    job_title     VARCHAR(255),
    start_date    DATE,
    end_date      DATE,
    description   TEXT
);

CREATE INDEX idx_candidate_experience_candidate_id ON public.candidate_experience (candidate_id);

COMMENT ON TABLE  public.candidate_experience IS 'Riwayat pengalaman kerja kandidat — 1 kandidat bisa >1 entri';
COMMENT ON COLUMN public.candidate_experience.end_date IS 'NULL = masih bekerja di perusahaan tersebut (saat ini)';

-- -----------------------------------------------------------------------------
-- 2.9 CANDIDATE_DOCUMENT  (Dokumen-dokumen pendukung kandidat)
-- -----------------------------------------------------------------------------
CREATE TABLE public.candidate_document (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id   UUID NOT NULL REFERENCES public.candidate(id) ON DELETE CASCADE,
    doc_type       VARCHAR(100) NOT NULL,
    file_url       VARCHAR(500),
    drive_item_id  VARCHAR(500),
    is_verified    BOOLEAN DEFAULT FALSE,
    is_deleted     BOOLEAN DEFAULT FALSE,
    uploaded_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_candidate_document_candidate_id ON public.candidate_document (candidate_id);

COMMENT ON TABLE  public.candidate_document IS 'Semua dokumen kandidat disimpan per baris — fleksibel tambah tipe baru tanpa migrasi';
COMMENT ON COLUMN public.candidate_document.doc_type IS 'CV_asli, Foto, KTP, KK, Ijazah, Transkrip, Sertifikat, BI_Checking, dll';
COMMENT ON COLUMN public.candidate_document.drive_item_id IS 'Microsoft Graph driveItem ID (OneDrive for Business)';
COMMENT ON COLUMN public.candidate_document.is_deleted IS 'Soft delete — file di OneDrive tetap dihapus via Graph API, baris ini ditandai';

-- -----------------------------------------------------------------------------
-- 2.10 APPLICATION  (Lamaran kandidat ke suatu posisi)
-- -----------------------------------------------------------------------------
CREATE TABLE public.application (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id              UUID NOT NULL REFERENCES public.candidate(id) ON DELETE RESTRICT,
    position_id               UUID NOT NULL REFERENCES public.position(id) ON DELETE RESTRICT,
    recruiter_id              UUID REFERENCES public."user"(id) ON DELETE SET NULL,
    current_stage             VARCHAR(100) DEFAULT 'Dijadwalkan_Interview',
    status                    application_status_enum NOT NULL DEFAULT 'active',
    cv_submitted_to_pm_date   DATE,
    created_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_application_candidate_id ON public.application (candidate_id);
CREATE INDEX idx_application_position_id  ON public.application (position_id);
CREATE INDEX idx_application_current_stage ON public.application (current_stage);
CREATE INDEX idx_application_status        ON public.application (status);

COMMENT ON TABLE  public.application IS 'Lamaran — 1 kandidat bisa punya banyak application ke posisi/waktu yang berbeda';
COMMENT ON COLUMN public.application.current_stage IS 'Tahapan saat ini (Dijadwalkan_Interview, Interview_HR, Psikotest, Interview_User, Offering, Kontrak, Onboarding, Existing)';
COMMENT ON COLUMN public.application.status IS 'Status keseluruhan lamaran: active / rejected / hired / withdrawn';

-- -----------------------------------------------------------------------------
-- 2.11 STAGE_HISTORY  (Audit trail setiap perubahan tahapan per lamaran)
-- -----------------------------------------------------------------------------
CREATE TABLE public.stage_history (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id        UUID NOT NULL REFERENCES public.application(id) ON DELETE CASCADE,
    stage_name            VARCHAR(100) NOT NULL,
    scheduled_date        DATE,
    actual_date           DATE,
    result                VARCHAR(50),
    salary_current_input  NUMERIC(15, 2),
    salary_expected_input NUMERIC(15, 2),
    notes                 TEXT,
    updated_by            UUID REFERENCES public."user"(id) ON DELETE SET NULL,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stage_history_application_id ON public.stage_history (application_id);
CREATE INDEX idx_stage_history_stage_name     ON public.stage_history (stage_name);
CREATE INDEX idx_stage_history_created_at     ON public.stage_history (created_at);

COMMENT ON TABLE  public.stage_history IS 'Riwayat audit setiap perubahan tahapan — 1 perubahan = 1 baris, TIDAK PERNAH di-update';
COMMENT ON COLUMN public.stage_history.result IS 'Hasil tahapan ini: Lanjut, Not_Recommended, Lolos, Tidak_Lolos, Negosiasi_OK, Reschedule, OK, Not_OK, dll';
COMMENT ON COLUMN public.stage_history.updated_by IS 'User (HR/Manager) yang melakukan update pada tahapan ini';

-- -----------------------------------------------------------------------------
-- 2.12 AI_SCREENING_RESULT  (Hasil ekstraksi AI & scoring per application)
-- -----------------------------------------------------------------------------
CREATE TABLE public.ai_screening_result (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL UNIQUE REFERENCES public.application(id) ON DELETE CASCADE,
    match_score     NUMERIC(5, 2),
    ai_notes        TEXT,
    extracted_data  TEXT,
    model_used      VARCHAR(100),
    review_status   VARCHAR(50) DEFAULT 'pending',
    scored_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  public.ai_screening_result IS 'Hasil AI screening: ekstraksi field CV + matching score terhadap requirement posisi';
COMMENT ON COLUMN public.ai_screening_result.extracted_data IS 'JSON string (TEXT) hasil ekstraksi AI — di-review HR sebelum diterapkan ke Candidate';
COMMENT ON COLUMN public.ai_screening_result.review_status  IS 'pending = belum direview HR, reviewed = sudah disetujui, rejected = ditolak HR';

-- -----------------------------------------------------------------------------
-- 2.13 GENERATED_CV  (Hasil generate CV standar Altek per kandidat/application)
-- -----------------------------------------------------------------------------
CREATE TABLE public.generated_cv (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL REFERENCES public.candidate(id) ON DELETE CASCADE,
    application_id  UUID REFERENCES public.application(id) ON DELETE SET NULL,
    template_used   VARCHAR(255),
    language        VARCHAR(10) DEFAULT 'ID',
    summary_source  VARCHAR(20),
    summary_text    TEXT,
    file_url        VARCHAR(500),
    drive_item_id   VARCHAR(500),
    generated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_generated_cv_candidate_id   ON public.generated_cv (candidate_id);
CREATE INDEX idx_generated_cv_application_id ON public.generated_cv (application_id);

COMMENT ON TABLE  public.generated_cv IS 'CV standar Altek yang sudah digenerate (Fase 2+)';
COMMENT ON COLUMN public.generated_cv.language       IS 'Bahasa summary di CV: ID / EN';
COMMENT ON COLUMN public.generated_cv.summary_source IS 'Sumber ringkasan: AI (digenerate LLM) atau HR (ditulis manual)';

-- -----------------------------------------------------------------------------
-- 2.14 BLACKLIST  (Kandidat yang masuk daftar hitam)
-- -----------------------------------------------------------------------------
CREATE TABLE public.blacklist (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id     UUID NOT NULL REFERENCES public.candidate(id) ON DELETE RESTRICT,
    status_type_id   UUID NOT NULL REFERENCES public.blacklist_status_type(id) ON DELETE RESTRICT,
    reason           VARCHAR(500),
    notes            TEXT,
    blacklisted_date DATE,
    pic_user_id      UUID REFERENCES public."user"(id) ON DELETE SET NULL,
    is_approved      BOOLEAN DEFAULT FALSE,
    approved_by      UUID REFERENCES public."user"(id) ON DELETE SET NULL,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_blacklist_candidate_id   ON public.blacklist (candidate_id);
CREATE INDEX idx_blacklist_status_type_id ON public.blacklist (status_type_id);
CREATE INDEX idx_blacklist_is_active      ON public.blacklist (is_active);
CREATE INDEX idx_blacklist_is_approved    ON public.blacklist (is_approved);

COMMENT ON TABLE  public.blacklist IS 'Daftar hitam kandidat — input HR, perlu approval Manager (is_approved=TRUE) baru aktif dicek';
COMMENT ON COLUMN public.blacklist.is_approved IS 'HR submit → FALSE; Manager klik Approve → TRUE (default FALSE)';
COMMENT ON COLUMN public.blacklist.is_active   IS 'TRUE = masih aktif dalam blacklist; FALSE = sudah dicabut (revoke)';
COMMENT ON COLUMN public.blacklist.pic_user_id IS 'HR yang mengusulkan kandidat masuk blacklist';
COMMENT ON COLUMN public.blacklist.approved_by IS 'Manager yang menyetujui blacklist ini';

-- -----------------------------------------------------------------------------
-- 2.15 EMPLOYEE  (Karyawan outsource — status kandidat sudah "Existing")
-- -----------------------------------------------------------------------------
CREATE TABLE public.employee (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id     UUID NOT NULL REFERENCES public.candidate(id) ON DELETE RESTRICT,
    application_id   UUID UNIQUE REFERENCES public.application(id) ON DELETE SET NULL,
    employee_nip     VARCHAR(100) UNIQUE,
    full_name        VARCHAR(255) NOT NULL,
    birth_date       DATE,
    birth_place      VARCHAR(255),
    gender           VARCHAR(20),
    blood_type       VARCHAR(5),
    personal_email   VARCHAR(255),
    office_email     VARCHAR(255),
    phone_number     VARCHAR(50),
    placement        VARCHAR(255),
    role_level       VARCHAR(255),
    employee_status  employee_status_enum DEFAULT 'aktif',
    leave_status     leave_status_enum DEFAULT 'belum',
    resign_date      DATE,
    resign_reason    VARCHAR(500),
    notes            TEXT,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employee_candidate_id     ON public.employee (candidate_id);
CREATE INDEX idx_employee_employee_status  ON public.employee (employee_status);
CREATE INDEX idx_employee_placement        ON public.employee (placement);

COMMENT ON TABLE  public.employee IS 'Karyawan outsource Altek yang ditempatkan di client (terbentuk otomatis saat Application mencapai stage Existing)';
COMMENT ON COLUMN public.employee.application_id IS 'Lamaran asal yang menghasilkan status karyawan ini (UNIQUE = 1 Application cuma bisa jadi 1 Employee)';
COMMENT ON COLUMN public.employee.birth_date     IS 'Untuk hitung usia OTOMATIS — JANGAN simpan kolom usia statis';
COMMENT ON COLUMN public.employee.resign_date    IS 'Di-isi saat employee_status = resign';

-- -----------------------------------------------------------------------------
-- 2.16 EMPLOYEE_CONTRACT  (Riwayat perpanjangan kontrak per employee)
-- -----------------------------------------------------------------------------
CREATE TABLE public.employee_contract (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id       UUID NOT NULL REFERENCES public.employee(id) ON DELETE CASCADE,
    agreement_type_id UUID REFERENCES public.agreement_type(id) ON DELETE SET NULL,
    contract_number   VARCHAR(100),
    duration_months   INTEGER,
    join_date         DATE,
    end_date          DATE,
    status            contract_status_enum DEFAULT 'aktif',
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employee_contract_employee_id ON public.employee_contract (employee_id);
CREATE INDEX idx_employee_contract_end_date    ON public.employee_contract (end_date);
CREATE INDEX idx_employee_contract_status      ON public.employee_contract (status);

COMMENT ON TABLE  public.employee_contract IS 'Riwayat kontrak per employee — 1 employee bisa >1 baris (perpanjangan, resign-lalu-rehire)';
COMMENT ON COLUMN public.employee_contract.end_date IS 'Tanggal habis kontrak — untuk alert 30/14/7 hari sebelum habis';

-- -----------------------------------------------------------------------------
-- 2.17 EMPLOYEE_PAYROLL  (Data payroll SENSITIF — akses hanya Manager & Admin)
-- -----------------------------------------------------------------------------
CREATE TABLE public.employee_payroll (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id            UUID NOT NULL UNIQUE REFERENCES public.employee(id) ON DELETE CASCADE,
    thp                    NUMERIC(15, 2),
    allowance_used         TEXT,
    payroll_bank           VARCHAR(100),
    bank_account_number    VARCHAR(100),
    bpjs_tk_status         VARCHAR(50),
    bpjs_tk_number         VARCHAR(100),
    bpjs_kesehatan_status  VARCHAR(50),
    bpjs_kesehatan_number  VARCHAR(100),
    npwp_number            VARCHAR(50),
    updated_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  public.employee_payroll IS 'Data PAYROLL SENSITIF — dipisah tabel agar bisa kontrol akses RBAC lebih ketat (Manager & Admin only)';
COMMENT ON COLUMN public.employee_payroll.thp       IS 'Take Home Pay per bulan (NUMERIC = aman untuk keuangan, tidak pakai float)';
COMMENT ON COLUMN public.employee_payroll.allowance_used IS 'Tunjangan & pinjaman (TEXT bebas format sesuai HR)';

-- -----------------------------------------------------------------------------
-- 2.18 EMPLOYEE_DOCUMENT  (Dokumen-dokumen karyawan)
-- -----------------------------------------------------------------------------
CREATE TABLE public.employee_document (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id    UUID NOT NULL REFERENCES public.employee(id) ON DELETE CASCADE,
    doc_type       VARCHAR(100) NOT NULL,
    file_url       VARCHAR(500),
    drive_item_id  VARCHAR(500),
    is_verified    BOOLEAN DEFAULT FALSE,
    is_deleted     BOOLEAN DEFAULT FALSE,
    uploaded_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employee_document_employee_id ON public.employee_document (employee_id);

COMMENT ON TABLE  public.employee_document IS 'Dokumen karyawan: CV_terupdate, CV_template_Altek, Offering_Payslip, KK, KTP, BPJS, NPWP, dll';
COMMENT ON COLUMN public.employee_document.doc_type IS 'Bisa ditambah jenis baru tanpa migrasi skema — fleksibel';

-- =============================================================================
-- 3. (OPSIONAL) TRIGGER AUTO-UPDATED_AT
-- -----------------------------------------------------------------------------
-- SQLAlchemy ORM sudah menangani `updated_at` via `onupdate=func.now()`.
-- Tapi jika Anda menjalankan UPDATE SQL langsung via psql / DBeaver / raw SQL,
-- aktifkan trigger di bawah ini agar kolom `updated_at` selalu auto-update.
--
-- Uncomment block di bawah jika dibutuhkan.
-- =============================================================================

/*
CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END; $$;

-- user
CREATE TRIGGER tg_user_updated_at
    BEFORE UPDATE ON public."user"
    FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- client
CREATE TRIGGER tg_client_updated_at
    BEFORE UPDATE ON public.client
    FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- position
CREATE TRIGGER tg_position_updated_at
    BEFORE UPDATE ON public.position
    FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- candidate
CREATE TRIGGER tg_candidate_updated_at
    BEFORE UPDATE ON public.candidate
    FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- application
CREATE TRIGGER tg_application_updated_at
    BEFORE UPDATE ON public.application
    FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- employee
CREATE TRIGGER tg_employee_updated_at
    BEFORE UPDATE ON public.employee
    FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- employee_payroll
CREATE TRIGGER tg_employee_payroll_updated_at
    BEFORE UPDATE ON public.employee_payroll
    FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
*/

-- =============================================================================
-- 4. RINGKASAN INDEXES UNTUK QUERY PERFORMANCE
-- -----------------------------------------------------------------------------
-- (Indexes yang dibuat di atas mencakup 90% pola query umum. Jika nanti ada
--  query lambat di production, gunakan pg_stat_statements + EXPLAIN ANALYZE
--  untuk menambah index tambahan sesuai pola query nyata tim HR.)
--
-- Yang paling kritis untuk performa (sudah dibuat):
--   ✓ candidate (email, phone, identity_no)   — dedup + blacklist check
--   ✓ application (candidate_id, position_id, current_stage, status) — list pipeline
--   ✓ stage_history (application_id, created_at) — timeline audit
--   ✓ employee (candidate_id, employee_status)  — list karyawan aktif
--   ✓ employee_contract (employee_id, end_date) — alert kontrak habis
--   ✓ blacklist (candidate_id, is_active, is_approved) — check warning
-- =============================================================================
