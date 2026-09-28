--
-- PostgreSQL database dump
--

\restrict 4sOdU8NNW4ffNIN6g00Pzm1j6xoEAqD9I93Rck9pBSeeAGblwtZWkegg5g5UjsM

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ai_screening_status_enum; Type: TYPE; Schema: public; Owner: talent26
--

CREATE TYPE public.ai_screening_status_enum AS ENUM (
    'menunggu_screening_ai',
    'sedang_diproses',
    'siap_review',
    'sudah_direview',
    'error'
);


ALTER TYPE public.ai_screening_status_enum OWNER TO talent26;

--
-- Name: application_status_enum; Type: TYPE; Schema: public; Owner: talent26
--

CREATE TYPE public.application_status_enum AS ENUM (
    'active',
    'rejected',
    'hired',
    'withdrawn'
);


ALTER TYPE public.application_status_enum OWNER TO talent26;

--
-- Name: completeness_status_enum; Type: TYPE; Schema: public; Owner: talent26
--

CREATE TYPE public.completeness_status_enum AS ENUM (
    'lengkap',
    'belum_lengkap'
);


ALTER TYPE public.completeness_status_enum OWNER TO talent26;

--
-- Name: contact_status_enum; Type: TYPE; Schema: public; Owner: talent26
--

CREATE TYPE public.contact_status_enum AS ENUM (
    'aktif',
    'tidak_bisa_dihubungi'
);


ALTER TYPE public.contact_status_enum OWNER TO talent26;

--
-- Name: contract_status_enum; Type: TYPE; Schema: public; Owner: talent26
--

CREATE TYPE public.contract_status_enum AS ENUM (
    'aktif',
    'berakhir',
    'diperpanjang'
);


ALTER TYPE public.contract_status_enum OWNER TO talent26;

--
-- Name: employee_status_enum; Type: TYPE; Schema: public; Owner: talent26
--

CREATE TYPE public.employee_status_enum AS ENUM (
    'aktif',
    'cuti',
    'resign'
);


ALTER TYPE public.employee_status_enum OWNER TO talent26;

--
-- Name: leave_status_enum; Type: TYPE; Schema: public; Owner: talent26
--

CREATE TYPE public.leave_status_enum AS ENUM (
    'sudah_bisa_cuti',
    'belum'
);


ALTER TYPE public.leave_status_enum OWNER TO talent26;

--
-- Name: user_role_enum; Type: TYPE; Schema: public; Owner: talent26
--

CREATE TYPE public.user_role_enum AS ENUM (
    'admin',
    'hr',
    'manager',
    'pm'
);


ALTER TYPE public.user_role_enum OWNER TO talent26;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agreement_type; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.agreement_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label character varying(255) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.agreement_type OWNER TO talent26;

--
-- Name: TABLE agreement_type; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.agreement_type IS 'Master data: jenis perjanjian kontrak Altek-Klien (PKWT, PKWTT, PPJP, dll)';


--
-- Name: ai_screening_result; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.ai_screening_result (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid,
    match_score numeric(5,2),
    ai_notes text,
    extracted_data text,
    model_used character varying(100),
    review_status character varying(50) DEFAULT 'pending'::character varying,
    scored_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    candidate_id uuid,
    position_id uuid,
    uploaded_by uuid,
    cv_file_url character varying(500),
    cv_drive_item_id character varying(500),
    extracted_json text,
    ai_score double precision,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(50) DEFAULT 'menunggu_screening_ai'::character varying,
    source_channel character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ai_screening_result OWNER TO talent26;

--
-- Name: TABLE ai_screening_result; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.ai_screening_result IS 'Hasil AI screening: ekstraksi field CV + matching score terhadap requirement posisi';


--
-- Name: COLUMN ai_screening_result.extracted_data; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.ai_screening_result.extracted_data IS 'JSON string (TEXT) hasil ekstraksi AI — di-review HR sebelum diterapkan ke Candidate';


--
-- Name: COLUMN ai_screening_result.review_status; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.ai_screening_result.review_status IS 'pending = belum direview HR, reviewed = sudah disetujui, rejected = ditolak HR';


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO talent26;

--
-- Name: application; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.application (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    position_id uuid NOT NULL,
    recruiter_id uuid,
    current_stage character varying(100) DEFAULT 'Dijadwalkan_Interview'::character varying,
    status public.application_status_enum DEFAULT 'active'::public.application_status_enum NOT NULL,
    cv_submitted_to_pm_date date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.application OWNER TO talent26;

--
-- Name: TABLE application; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.application IS 'Lamaran — 1 kandidat bisa punya banyak application ke posisi/waktu yang berbeda';


--
-- Name: COLUMN application.current_stage; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.application.current_stage IS 'Tahapan saat ini (Dijadwalkan_Interview, Interview_HR, Psikotest, Interview_User, Offering, Kontrak, Onboarding, Existing)';


--
-- Name: COLUMN application.status; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.application.status IS 'Status keseluruhan lamaran: active / rejected / hired / withdrawn';


--
-- Name: blacklist; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.blacklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    status_type_id uuid NOT NULL,
    reason character varying(500),
    notes text,
    blacklisted_date date,
    pic_user_id uuid,
    is_approved boolean DEFAULT false,
    approved_by uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    employee_id uuid
);


ALTER TABLE public.blacklist OWNER TO talent26;

--
-- Name: TABLE blacklist; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.blacklist IS 'Daftar hitam kandidat — input HR, perlu approval Manager (is_approved=TRUE) baru aktif dicek';


--
-- Name: COLUMN blacklist.pic_user_id; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.blacklist.pic_user_id IS 'HR yang mengusulkan kandidat masuk blacklist';


--
-- Name: COLUMN blacklist.is_approved; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.blacklist.is_approved IS 'HR submit → FALSE; Manager klik Approve → TRUE (default FALSE)';


--
-- Name: COLUMN blacklist.approved_by; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.blacklist.approved_by IS 'Manager yang menyetujui blacklist ini';


--
-- Name: COLUMN blacklist.is_active; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.blacklist.is_active IS 'TRUE = masih aktif dalam blacklist; FALSE = sudah dicabut (revoke)';


--
-- Name: blacklist_status_type; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.blacklist_status_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label character varying(255) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.blacklist_status_type OWNER TO talent26;

--
-- Name: TABLE blacklist_status_type; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.blacklist_status_type IS 'Master data: jenis/kategori alasan blacklist (bisa ditambah Admin tanpa deploy)';


--
-- Name: COLUMN blacklist_status_type.label; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.blacklist_status_type.label IS 'Contoh: Menolak Offer Tanpa Alasan, No-Show, Manipulasi Data, dll';


--
-- Name: candidate; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.candidate (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    identity_no character varying(20),
    domicile character varying(255),
    photo_url character varying(500),
    source_channel character varying(100),
    current_salary numeric(15,2),
    expected_salary numeric(15,2),
    notice_period_days integer,
    completeness_status public.completeness_status_enum DEFAULT 'belum_lengkap'::public.completeness_status_enum,
    contact_status public.contact_status_enum DEFAULT 'aktif'::public.contact_status_enum,
    possible_duplicate boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    birth_date date,
    birth_place character varying(255),
    gender character varying(20),
    blood_type character varying(5),
    skills jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.candidate OWNER TO talent26;

--
-- Name: TABLE candidate; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.candidate IS 'Data utama kandidat/talent (satu orang = 1 baris; bisa punya banyak lamaran/application)';


--
-- Name: COLUMN candidate.identity_no; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.candidate.identity_no IS 'NIK KTP — untuk deteksi duplikat & blacklist match';


--
-- Name: COLUMN candidate.source_channel; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.candidate.source_channel IS 'Sumber kandidat: LinkedIn, Glints, Email, Walk-in, Referensi, dll';


--
-- Name: COLUMN candidate.possible_duplicate; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.candidate.possible_duplicate IS 'TRUE jika email / phone / NIK partial match dengan kandidat lain — perlu review manual';


--
-- Name: candidate_document; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.candidate_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    doc_type character varying(100) NOT NULL,
    file_url character varying(500),
    drive_item_id character varying(500),
    is_verified boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    uploaded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.candidate_document OWNER TO talent26;

--
-- Name: TABLE candidate_document; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.candidate_document IS 'Semua dokumen kandidat disimpan per baris — fleksibel tambah tipe baru tanpa migrasi';


--
-- Name: COLUMN candidate_document.doc_type; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.candidate_document.doc_type IS 'CV_asli, Foto, KTP, KK, Ijazah, Transkrip, Sertifikat, BI_Checking, dll';


--
-- Name: COLUMN candidate_document.drive_item_id; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.candidate_document.drive_item_id IS 'Microsoft Graph driveItem ID (OneDrive for Business)';


--
-- Name: COLUMN candidate_document.is_deleted; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.candidate_document.is_deleted IS 'Soft delete — file di OneDrive tetap dihapus via Graph API, baris ini ditandai';


--
-- Name: candidate_education; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.candidate_education (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    institution character varying(255),
    major character varying(255),
    graduation_year integer,
    gpa numeric(3,2)
);


ALTER TABLE public.candidate_education OWNER TO talent26;

--
-- Name: TABLE candidate_education; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.candidate_education IS 'Riwayat pendidikan kandidat — 1 kandidat bisa >1 entri (SMA, S1, S2, dll)';


--
-- Name: candidate_experience; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.candidate_experience (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    company_name character varying(255),
    job_title character varying(255),
    start_date date,
    end_date date,
    description text
);


ALTER TABLE public.candidate_experience OWNER TO talent26;

--
-- Name: TABLE candidate_experience; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.candidate_experience IS 'Riwayat pengalaman kerja kandidat — 1 kandidat bisa >1 entri';


--
-- Name: COLUMN candidate_experience.end_date; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.candidate_experience.end_date IS 'NULL = masih bekerja di perusahaan tersebut (saat ini)';


--
-- Name: candidate_project; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.candidate_project (
    id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    project_name character varying(255) NOT NULL,
    role character varying(255),
    summary text,
    impact text,
    tech_stack jsonb,
    duration character varying(100),
    is_draft boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.candidate_project OWNER TO talent26;

--
-- Name: client; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.client (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    industry character varying(255),
    pic_name character varying(255),
    pic_contact character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.client OWNER TO talent26;

--
-- Name: TABLE client; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.client IS 'Perusahaan klien / perusahaan tempat talent ditempatkan (mayoritas Bank)';


--
-- Name: employee; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.employee (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    application_id uuid,
    employee_nip character varying(100),
    full_name character varying(255) NOT NULL,
    birth_date date,
    birth_place character varying(255),
    gender character varying(20),
    blood_type character varying(5),
    personal_email character varying(255),
    office_email character varying(255),
    phone_number character varying(50),
    placement character varying(255),
    role_level character varying(255),
    employee_status public.employee_status_enum DEFAULT 'aktif'::public.employee_status_enum,
    leave_status public.leave_status_enum DEFAULT 'belum'::public.leave_status_enum,
    resign_date date,
    resign_reason character varying(500),
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    identity_no character varying(20)
);


ALTER TABLE public.employee OWNER TO talent26;

--
-- Name: TABLE employee; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.employee IS 'Karyawan outsource Altek yang ditempatkan di client (terbentuk otomatis saat Application mencapai stage Existing)';


--
-- Name: COLUMN employee.application_id; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.employee.application_id IS 'Lamaran asal yang menghasilkan status karyawan ini (UNIQUE = 1 Application cuma bisa jadi 1 Employee)';


--
-- Name: COLUMN employee.birth_date; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.employee.birth_date IS 'Untuk hitung usia OTOMATIS — JANGAN simpan kolom usia statis';


--
-- Name: COLUMN employee.resign_date; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.employee.resign_date IS 'Di-isi saat employee_status = resign';


--
-- Name: employee_contract; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.employee_contract (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    agreement_type_id uuid,
    contract_number character varying(100),
    duration_months integer,
    join_date date,
    end_date date,
    status public.contract_status_enum DEFAULT 'aktif'::public.contract_status_enum,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.employee_contract OWNER TO talent26;

--
-- Name: TABLE employee_contract; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.employee_contract IS 'Riwayat kontrak per employee — 1 employee bisa >1 baris (perpanjangan, resign-lalu-rehire)';


--
-- Name: COLUMN employee_contract.end_date; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.employee_contract.end_date IS 'Tanggal habis kontrak — untuk alert 30/14/7 hari sebelum habis';


--
-- Name: employee_document; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.employee_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    doc_type character varying(100) NOT NULL,
    file_url character varying(500),
    drive_item_id character varying(500),
    is_verified boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    uploaded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.employee_document OWNER TO talent26;

--
-- Name: TABLE employee_document; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.employee_document IS 'Dokumen karyawan: CV_terupdate, CV_template_Altek, Offering_Payslip, KK, KTP, BPJS, NPWP, dll';


--
-- Name: COLUMN employee_document.doc_type; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.employee_document.doc_type IS 'Bisa ditambah jenis baru tanpa migrasi skema — fleksibel';


--
-- Name: employee_payroll; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.employee_payroll (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    thp numeric(15,2),
    allowance_used text,
    payroll_bank character varying(100),
    bank_account_number character varying(100),
    bpjs_tk_status character varying(50),
    bpjs_tk_number character varying(100),
    bpjs_kesehatan_status character varying(50),
    bpjs_kesehatan_number character varying(100),
    npwp_number character varying(50),
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.employee_payroll OWNER TO talent26;

--
-- Name: TABLE employee_payroll; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.employee_payroll IS 'Data PAYROLL SENSITIF — dipisah tabel agar bisa kontrol akses RBAC lebih ketat (Manager & Admin only)';


--
-- Name: COLUMN employee_payroll.thp; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.employee_payroll.thp IS 'Take Home Pay per bulan (NUMERIC = aman untuk keuangan, tidak pakai float)';


--
-- Name: COLUMN employee_payroll.allowance_used; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.employee_payroll.allowance_used IS 'Tunjangan & pinjaman (TEXT bebas format sesuai HR)';


--
-- Name: generated_cv; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.generated_cv (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    application_id uuid,
    template_used character varying(255),
    language character varying(10) DEFAULT 'ID'::character varying,
    summary_source character varying(20),
    summary_text text,
    file_url character varying(500),
    drive_item_id character varying(500),
    generated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.generated_cv OWNER TO talent26;

--
-- Name: TABLE generated_cv; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.generated_cv IS 'CV standar Altek yang sudah digenerate (Fase 2+)';


--
-- Name: COLUMN generated_cv.language; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.generated_cv.language IS 'Bahasa summary di CV: ID / EN';


--
-- Name: COLUMN generated_cv.summary_source; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.generated_cv.summary_source IS 'Sumber ringkasan: AI (digenerate LLM) atau HR (ditulis manual)';


--
-- Name: notification; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.notification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(100) NOT NULL,
    message text NOT NULL,
    link character varying(500),
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notification OWNER TO talent26;

--
-- Name: position; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public."position" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    requirement text,
    employment_type character varying(100),
    contract_duration_months integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ai_scoring_config jsonb,
    job_description text
);


ALTER TABLE public."position" OWNER TO talent26;

--
-- Name: TABLE "position"; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public."position" IS 'Lowongan / posisi terbuka per client (satu client bisa punya banyak position)';


--
-- Name: COLUMN "position".requirement; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public."position".requirement IS 'Requirement/kualifikasi posisi — dipakai AI untuk matching/scoring kandidat';


--
-- Name: refresh_token; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.refresh_token (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token character varying(512) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.refresh_token OWNER TO talent26;

--
-- Name: source_channel; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.source_channel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.source_channel OWNER TO talent26;

--
-- Name: stage_history; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public.stage_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    stage_name character varying(100) NOT NULL,
    scheduled_date date,
    actual_date date,
    result character varying(50),
    salary_current_input numeric(15,2),
    salary_expected_input numeric(15,2),
    notes text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    handler_id uuid
);


ALTER TABLE public.stage_history OWNER TO talent26;

--
-- Name: TABLE stage_history; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public.stage_history IS 'Riwayat audit setiap perubahan tahapan — 1 perubahan = 1 baris, TIDAK PERNAH di-update';


--
-- Name: COLUMN stage_history.result; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.stage_history.result IS 'Hasil tahapan ini: Lanjut, Not_Recommended, Lolos, Tidak_Lolos, Negosiasi_OK, Reschedule, OK, Not_OK, dll';


--
-- Name: COLUMN stage_history.updated_by; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public.stage_history.updated_by IS 'User (HR/Manager) yang melakukan update pada tahapan ini';


--
-- Name: user; Type: TABLE; Schema: public; Owner: talent26
--

CREATE TABLE public."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    hashed_password character varying(255) NOT NULL,
    role public.user_role_enum NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    reset_token character varying(255),
    reset_token_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."user" OWNER TO talent26;

--
-- Name: TABLE "user"; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON TABLE public."user" IS 'Pengguna sistem (Admin, HR, Manager)';


--
-- Name: COLUMN "user".hashed_password; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public."user".hashed_password IS 'Password di-hash dengan bcrypt (passlib), JANGAN simpan plain text';


--
-- Name: COLUMN "user".role; Type: COMMENT; Schema: public; Owner: talent26
--

COMMENT ON COLUMN public."user".role IS 'Role RBAC: admin/hr/manager/pm';


--
-- Data for Name: agreement_type; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.agreement_type (id, label, is_active, created_by, created_at) FROM stdin;
57f1644f-4bb6-4b24-8f0a-7611f4f4cf97	PKWT (Perjanjian Kerja Waktu Tertentu)	t	\N	2026-09-20 09:43:53.373724+00
2e81606b-1b6e-4f08-a07b-51646a363eae	PKWTT (Perjanjian Kerja Waktu Tidak Tertentu)	t	\N	2026-09-20 09:43:53.373724+00
94772c77-41f7-4e63-bf88-07963cae2ddb	PPJP (Perjanjian Pemborongan Jasa Pekerjaan)	t	\N	2026-09-20 09:43:53.373724+00
8c0cf076-77a1-40c1-803b-d763a8500eb7	Perjanjian Outsourcing	t	\N	2026-09-20 09:43:53.373724+00
\.


--
-- Data for Name: ai_screening_result; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.ai_screening_result (id, application_id, match_score, ai_notes, extracted_data, model_used, review_status, scored_at, candidate_id, position_id, uploaded_by, cv_file_url, cv_drive_item_id, extracted_json, ai_score, reviewed_by, reviewed_at, updated_at, status, source_channel, created_at) FROM stdin;
92b58aa9-0ae0-4d43-9bbb-4d4a106692f5	48847554-b953-468a-9b7f-68d89e892606	\N	Kandidat memiliki latar belakang pendidikan yang relevan serta pengalaman kerja sebagai IT Support selama 7 tahun. Namun, tidak ada informasi spesifik tentang proyek atau pencapaian yang dapat meningkatkan nilai kelayakan.	\N	\N	pending	2026-09-22 14:11:39.602652+00	b54c2fd5-846d-480e-9c34-1b5adad0c342	6aa5ab8d-0720-4ec7-a3d5-4e619e2e6499	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	/api/v1/files/6aa5ab8d-0720-4ec7-a3d5-4e619e2e6499/Pinhome/cv_uploads/Achmad Sholeh - Programmer or IT Helpdesk_16d778fa.pdf	6aa5ab8d-0720-4ec7-a3d5-4e619e2e6499/Pinhome/cv_uploads/Achmad Sholeh - Programmer or IT Helpdesk_16d778fa.pdf	{"nama": "Achmad Sholeh", "email": "ach.nichole@mail.com", "telepon": "+62 8777 2656", "pendidikan": [{"institusi": "SMK KEJURUTERAAN MA'ARIF 4", "jurusan": "Rekayasa Perangkat Lunak", "tahun_lulus": 2012, "gpa": null}, {"institusi": "UNIVERSITAS SILIWANGI", "jurusan": "Sistem Komputer", "tahun_lulus": 2016, "gpa": null}], "pengalaman_kerja": [{"perusahaan": "PT KELOLA MINA", "jabatan": "IT Support", "mulai": "2016", "selesai": "Sekarang", "deskripsi": "Instalasi dan perawatan hardware, troubleshooting masalah jaringan dan software."}], "skills": ["Networking LAN", "Windows", "Linux", "Troubleshooting", "PABX dan CCTV"], "total_experience_years": 7}	70	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	2026-09-22 14:12:51.548115+00	2026-09-22 14:12:51.54274+00	sudah_direview	email	2026-09-22 14:11:39.602652+00
c384a316-3c7e-4549-b6e2-3be8952c5e4c	48847554-b953-468a-9b7f-68d89e892606	\N	Kandidat memiliki pengalaman yang relevan sebagai IT Support selama 5 tahun dengan keterampilan yang sesuai. Namun, tidak ada informasi tentang pendidikan S1 yang spesifik, yang sedikit mengurangi kelayakan.	\N	\N	pending	2026-09-22 14:14:06.315437+00	b54c2fd5-846d-480e-9c34-1b5adad0c342	6aa5ab8d-0720-4ec7-a3d5-4e619e2e6499	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	/api/v1/files/6aa5ab8d-0720-4ec7-a3d5-4e619e2e6499/Pinhome/cv_uploads/Achmad Sholeh - Programmer or IT Helpdesk_61a67d23.pdf	6aa5ab8d-0720-4ec7-a3d5-4e619e2e6499/Pinhome/cv_uploads/Achmad Sholeh - Programmer or IT Helpdesk_61a67d23.pdf	{"nama": "Achmad Sholeh", "email": "ach.nichole@gmail.com", "telepon": "+62 8777 2656", "pendidikan": [{"institusi": "SMK Ma'arif 4", "jurusan": "Rekayasa Perangkat Lunak", "tahun_lulus": 2012, "gpa": null}, {"institusi": "Universitas", "jurusan": "S1", "tahun_lulus": 2016, "gpa": null}], "pengalaman_kerja": [{"perusahaan": "PT Kencana", "jabatan": "IT Support", "mulai": "2016", "selesai": "2017", "deskripsi": "Pemeliharaan dan instalasi aplikasi komputer, troubleshooting masalah perangkat keras dan perangkat lunak."}, {"perusahaan": "PT Subang Mandiri", "jabatan": "IT Support", "mulai": "2012", "selesai": "2016", "deskripsi": "Mendukung komunikasi dan maintenance sistem komputer serta menyelesaikan masalah jaringan."}], "skills": ["Networking LAN", "Software Hardware", "Windows", "Linux", "Troubleshooting", "PABX", "CCTV", "Remote/VNC", "Proxmox", "Router"], "total_experience_years": 5}	70	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	2026-09-22 14:23:56.734592+00	2026-09-22 14:23:56.730613+00	sudah_direview	Linkedin	2026-09-22 14:14:06.315437+00
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.alembic_version (version_num) FROM stdin;
562fb83ffa70
\.


--
-- Data for Name: application; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.application (id, candidate_id, position_id, recruiter_id, current_stage, status, cv_submitted_to_pm_date, created_at, updated_at) FROM stdin;
499c4402-3e06-45f2-b00f-d7523914298a	75e30690-8cbc-4320-86a2-9c076a34f5ad	daf8582e-dfb0-4633-876c-805193f87b62	54b45fdd-9c13-497e-b4fd-d98215991a1d	Existing	hired	\N	2026-09-21 07:01:17.273038+00	2026-09-21 09:15:55.133794+00
48847554-b953-468a-9b7f-68d89e892606	b54c2fd5-846d-480e-9c34-1b5adad0c342	6aa5ab8d-0720-4ec7-a3d5-4e619e2e6499	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	Dijadwalkan_Interview	active	\N	2026-09-22 14:12:51.447076+00	2026-09-22 14:12:51.447076+00
\.


--
-- Data for Name: blacklist; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.blacklist (id, candidate_id, status_type_id, reason, notes, blacklisted_date, pic_user_id, is_approved, approved_by, is_active, created_at, employee_id) FROM stdin;
59d79223-1e53-46fd-a49e-8e7a74fda554	cd6d2e13-dd04-44c4-8bd6-0dae3633ab50	fd5b6820-eeb6-4abf-a4d0-bc364d900255	Seed data for testing blacklist menu	Testing blacklist feature from seed script	2026-09-20	54b45fdd-9c13-497e-b4fd-d98215991a1d	t	54b45fdd-9c13-497e-b4fd-d98215991a1d	t	2026-09-20 13:21:57.510783+00	\N
851cafe5-8524-4ff4-9a55-16d662a4856d	09292f5c-6441-46e3-8f8b-a6fcc2670c3c	fd5b6820-eeb6-4abf-a4d0-bc364d900255	Seed data for testing blacklist menu	Testing blacklist feature from seed script	2026-09-20	54b45fdd-9c13-497e-b4fd-d98215991a1d	t	54b45fdd-9c13-497e-b4fd-d98215991a1d	t	2026-09-20 13:21:57.510783+00	\N
6c226a4b-fb80-4596-b5d1-0d49e78adfb6	d72ea725-27a4-414b-b3ce-7666e771a9ed	762af550-9818-4447-8940-423d471fb437	Seed data for testing blacklist menu	Testing blacklist feature from seed script	2026-09-20	54b45fdd-9c13-497e-b4fd-d98215991a1d	t	54b45fdd-9c13-497e-b4fd-d98215991a1d	t	2026-09-20 13:21:57.510783+00	\N
\.


--
-- Data for Name: blacklist_status_type; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.blacklist_status_type (id, label, is_active, created_by, created_at) FROM stdin;
432d998b-c952-4905-b940-767ba232d29b	Menolak Offer Tanpa Alasan Jelas	t	\N	2026-09-20 09:43:53.366565+00
e8e04455-4cd6-444e-acdc-c8fef8000636	Tidak Hadir Interview Tanpa Konfirmasi (No-Show)	t	\N	2026-09-20 09:43:53.366565+00
762af550-9818-4447-8940-423d471fb437	Terbukti Manipulasi Data	t	\N	2026-09-20 09:43:53.366565+00
5f028061-dec8-46f7-af2c-b62c7d516d07	Bermasalah di Tempat Kerja Client	t	\N	2026-09-20 09:43:53.366565+00
fd5b6820-eeb6-4abf-a4d0-bc364d900255	Referensi Negatif	t	\N	2026-09-20 09:43:53.366565+00
\.


--
-- Data for Name: candidate; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.candidate (id, full_name, email, phone, identity_no, domicile, photo_url, source_channel, current_salary, expected_salary, notice_period_days, completeness_status, contact_status, possible_duplicate, is_deleted, notes, created_at, updated_at, birth_date, birth_place, gender, blood_type, skills) FROM stdin;
09292f5c-6441-46e3-8f8b-a6fcc2670c3c	Rina Kartika	rina.kartika@email.com	086123456789	3201017429627935	Yogyakarta	\N	JobStreet	10000000.00	18000000.00	30	belum_lengkap	aktif	f	f	\N	2026-09-20 13:21:57.510783+00	2026-09-20 13:21:57.510783+00	1996-08-26	Yogyakarta	Perempuan	\N	["UI/UX Design", "Figma", "Adobe XD", "Prototyping"]
f581aaec-6d5f-4b5d-9a8f-18bc614501b8	Siska Putri	siska.putri@email.com	092123456789	3201012981768484	Manado	\N	LinkedIn	9000000.00	15000000.00	30	belum_lengkap	aktif	f	f	\N	2026-09-20 13:21:57.510783+00	2026-09-20 13:21:57.510783+00	1994-12-02	Manado	Laki-laki	\N	["HR Management", "Recruitment", "Microsoft Excel", "Bahasa Inggris Aktif"]
2aa3d0e0-50bb-4c02-995d-4f4a6c1eb82c	Joko Susilo	joko.susilo@email.com	093123456789	3201019599965407	Solo	\N	Glints	13000000.00	10000000.00	30	belum_lengkap	aktif	f	f	\N	2026-09-20 13:21:57.510783+00	2026-09-20 13:21:57.510783+00	1999-12-11	Solo	Laki-laki	\N	["DevOps", "AWS", "CI/CD", "Terraform", "Linux"]
6cfbfbc6-7dfc-4f0b-9e85-4b614c4be01b	Anita Wijaya	anita.wijaya@email.com	094123456789	3201018732220525	Malang	\N	Referral	6000000.00	20000000.00	30	belum_lengkap	aktif	f	f	\N	2026-09-20 13:21:57.510783+00	2026-09-20 13:21:57.510783+00	1998-10-22	Malang	Perempuan	\N	["Machine Learning", "TensorFlow", "Python", "Data Science"]
0b1a510a-3806-4155-9603-8922cc8afc0a	Andi Wijaya	andi.wijaya@email.com	083123456789	3201018459660135	Surabaya	\N	Glints	10000000.00	19000000.00	30	belum_lengkap	aktif	f	f	\N	2026-09-20 13:21:57.510783+00	2026-09-20 13:22:25.229592+00	1997-02-01	Surabaya	Perempuan	\N	["Python", "Django", "PostgreSQL", "Docker"]
13969dcf-b288-4cdd-a6b4-c796499a17e8	Ferry Irawan	ferry.irawan@email.com	095123456789	3201013400519943	Pontianak	\N	LinkedIn	14000000.00	12000000.00	30	belum_lengkap	aktif	f	f	\N	2026-09-20 13:21:57.510783+00	2026-09-20 13:22:25.229592+00	1990-11-04	Pontianak	Laki-laki	\N	["Project Management", "Scrum", "JIRA", "Agile"]
5919c96e-6fae-4f86-ae6c-2c690352e1d8	Dewi Lestari	dewi.lestari@email.com	084123456789	3201013798272658	Medan	\N	JobStreet	15000000.00	10000000.00	30	belum_lengkap	aktif	f	f	\N	2026-09-20 13:21:57.510783+00	2026-09-20 13:22:25.229592+00	2000-10-18	Medan	Laki-laki	\N	["Java", "Spring Boot", "Microservices", "Kubernetes"]
67115bd7-9a81-42ba-a272-9ed7f25ebdfe	Agus Setiawan	agus.setiawan@email.com	087123456789	3201015869144503	Makassar	\N	Referral	15000000.00	20000000.00	30	belum_lengkap	aktif	f	f	\N	2026-09-20 13:21:57.510783+00	2026-09-20 13:22:25.229592+00	1994-02-21	Makassar	Laki-laki	\N	["Node.js", "Express.js", "MongoDB", "REST API"]
7390a36e-847c-4bf9-8693-8b3f7e6c1340	Siti Aminah	siti.aminah@email.com	082123456789	3201016055640421	Bandung	\N	JobStreet	9000000.00	15000000.00	30	belum_lengkap	aktif	f	f	\N	2026-09-20 13:21:57.510783+00	2026-09-20 13:22:25.229592+00	1991-06-27	Bandung	Perempuan	\N	["Next.js", "React", "TypeScript", "Tailwind CSS"]
7f4a62b5-ce6c-48e1-9e37-8d6800b3922b	Maya Indah	maya.indah@email.com	088123456789	3201015108723108	Denpasar	\N	Glints	5000000.00	7000000.00	30	belum_lengkap	aktif	f	f	\N	2026-09-20 13:21:57.510783+00	2026-09-20 13:22:25.229592+00	1996-03-14	Denpasar	Perempuan	\N	["Data Analysis", "Python", "Tableau", "SQL", "Fluent English"]
cd6d2e13-dd04-44c4-8bd6-0dae3633ab50	Budi Santoso	budi.santoso@email.com	081234567890	3201011985229448	Jakarta	\N	Referral	5000000.00	8000000.00	30	belum_lengkap	aktif	f	f	\N	2026-09-20 13:21:57.510783+00	2026-09-20 13:22:25.229592+00	1997-06-10	Jakarta	Perempuan	\N	["PHP", "Laravel", "MySQL", "Git"]
d72ea725-27a4-414b-b3ce-7666e771a9ed	Rizky Pratama	rizky.pratama@email.com	091123456789	3201019513180366	Banjarmasin	\N	Referral	7000000.00	10000000.00	30	belum_lengkap	aktif	f	f	\N	2026-09-20 13:21:57.510783+00	2026-09-20 13:22:25.229592+00	2000-12-13	Banjarmasin	Laki-laki	\N	["Vue.js", "Nuxt.js", "JavaScript", "CSS3"]
15895c8b-a235-4cf8-88aa-9ffd0914c182	Heri Kurniawan	heri.kurniawan@email.com	089123456789	3201011790925546	Palembang	\N	\N	8000000.00	11000000.00	30	belum_lengkap	aktif	f	f	\N	2026-09-20 13:21:57.510783+00	2026-09-20 13:50:09.732782+00	1999-08-15	Palembang	Laki-laki	B	["PHP", "CodeIgniter", "jQuery", "Bootstrap"]
2b188ffe-023d-410d-8187-b129e6004bec	Linda Sari	linda.sari@email.com	090123456789	3201016064147844	Balikpapan	/api/v1/files/Candidates/2b188ffe-023d-410d-8187-b129e6004bec/kandidat3_tms_7692843a.jpeg	LinkedIn	10000000.00	20000000.00	30	belum_lengkap	aktif	f	f	\N	2026-09-20 13:21:57.510783+00	2026-09-21 07:59:33.937973+00	1997-12-13	Balikpapan	Perempuan	\N	["Golang", "Gin", "Redis", "gRPC", "Docker"]
75e30690-8cbc-4320-86a2-9c076a34f5ad	Eko Prasetyo	eko.prasetyo@email.com	085123456789	3201012502064199	Semarang	/api/v1/files/Candidates/75e30690-8cbc-4320-86a2-9c076a34f5ad/kandidat6_tms_2394579e.jpeg	Jobstreet	6000000.00	17000000.00	30	belum_lengkap	aktif	f	f	pengalaman > 3 tahun sebagai mobile programmer	2026-09-20 13:21:57.510783+00	2026-09-21 08:00:17.020753+00	1992-07-24	Semarang	Laki-laki	B	["React Native", "Flutter", "iOS", "Android"]
b54c2fd5-846d-480e-9c34-1b5adad0c342	Achmad Sholeh	ach.nichole@mail.com	+62 8777 2656	\N	\N	\N	\N	\N	\N	\N	belum_lengkap	aktif	f	f	\N	2026-09-22 14:12:51.008425+00	2026-09-22 14:12:51.008425+00	\N	\N	\N	\N	["Networking LAN", "Windows", "Linux", "Troubleshooting", "PABX dan CCTV"]
\.


--
-- Data for Name: candidate_document; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.candidate_document (id, candidate_id, doc_type, file_url, drive_item_id, is_verified, is_deleted, uploaded_at) FROM stdin;
c34e0a91-4d53-45d2-9c0c-4f129f299802	2b188ffe-023d-410d-8187-b129e6004bec	Foto	/api/v1/files/Candidates/2b188ffe-023d-410d-8187-b129e6004bec/kandidat3_tms_7692843a.jpeg	\N	f	f	2026-09-21 07:59:33.885748+00
fb716f58-7200-4a13-acf1-afa8247fc373	75e30690-8cbc-4320-86a2-9c076a34f5ad	Foto	/api/v1/files/Candidates/75e30690-8cbc-4320-86a2-9c076a34f5ad/kandidat6_tms_2394579e.jpeg	\N	f	f	2026-09-21 08:00:16.983715+00
\.


--
-- Data for Name: candidate_education; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.candidate_education (id, candidate_id, institution, major, graduation_year, gpa) FROM stdin;
228f7e92-f555-4d9a-b51a-ac6ae1b95336	75e30690-8cbc-4320-86a2-9c076a34f5ad	universitas unggul jaya	Teknik Informatika	2022	\N
db2c2f35-dd96-42ff-aabc-cafa0a14396e	75e30690-8cbc-4320-86a2-9c076a34f5ad	sma	fisika	2017	\N
e15202a8-18e0-41cb-93dc-bb102ee4d12f	b54c2fd5-846d-480e-9c34-1b5adad0c342	SMK KEJURUTERAAN MA'ARIF 4	Rekayasa Perangkat Lunak	2012	\N
3001cb95-b076-467f-acfd-37137aba4b9d	b54c2fd5-846d-480e-9c34-1b5adad0c342	UNIVERSITAS SILIWANGI	Sistem Komputer	2016	\N
\.


--
-- Data for Name: candidate_experience; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.candidate_experience (id, candidate_id, company_name, job_title, start_date, end_date, description) FROM stdin;
1a19e588-7e70-48d2-9690-1f72a2eb74a9	75e30690-8cbc-4320-86a2-9c076a34f5ad	pt unggul teknologi	Junior mobile developer	2023-05-23	2025-01-01	buat aplikasi untuk pemeritah daerah tentang layanan publik dalam satu aplikasi
6d87826b-7579-4d88-81c0-00b025d8cabf	b54c2fd5-846d-480e-9c34-1b5adad0c342	PT KELOLA MINA	IT Support	2016-01-01	\N	Instalasi dan perawatan hardware, troubleshooting masalah jaringan dan software.
\.


--
-- Data for Name: candidate_project; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.candidate_project (id, candidate_id, project_name, role, summary, impact, tech_stack, duration, is_draft, created_at, updated_at) FROM stdin;
308afb14-f879-4016-8a39-9e7822f18c43	75e30690-8cbc-4320-86a2-9c076a34f5ad	Aplikasi Layanan Publik Daerah	Junior Mobile Developer	Mengembangkan aplikasi mobile untuk pemerintah daerah yang mengintegrasikan berbagai layanan publik dalam satu platform. Aplikasi ini memudahkan masyarakat dalam mengakses informasi dan layanan yang tersedia.	Aplikasi ini berhasil meningkatkan akses masyarakat terhadap layanan publik hingga 30% dalam periode peluncuran awal.	["react native", "flutter", "ios", "android"]	1 tahun 8 bulan	f	2026-09-21 10:24:31.348433+00	2026-09-21 10:24:40.320225+00
\.


--
-- Data for Name: client; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.client (id, name, industry, pic_name, pic_contact, is_active, created_at, updated_at) FROM stdin;
1bccf19e-d668-40f3-9d0b-341f932bc25a	Pinhome	Furniture	John Pinhome	08123734198	t	2026-09-20 13:39:00.560749+00	2026-09-20 13:39:00.560749+00
1ffb89c8-dbd5-4227-baf5-e1c4dc39fd67	Atlas Capture	Logistic	John Atlas	081973434311	t	2026-09-20 13:39:24.995214+00	2026-09-20 13:39:24.995214+00
\.


--
-- Data for Name: employee; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.employee (id, candidate_id, application_id, employee_nip, full_name, birth_date, birth_place, gender, blood_type, personal_email, office_email, phone_number, placement, role_level, employee_status, leave_status, resign_date, resign_reason, notes, created_at, updated_at, identity_no) FROM stdin;
37695a2b-69a8-48cb-9f5f-4e35ec607ae8	75e30690-8cbc-4320-86a2-9c076a34f5ad	499c4402-3e06-45f2-b00f-d7523914298a	\N	Eko Prasetyo	1992-07-24	Semarang	Laki-laki	B	eko.prasetyo@email.com	\N	085123456789	Atlas Capture	Mobile Engineer	aktif	belum	\N	\N	\N	2026-09-21 09:15:55.133794+00	2026-09-21 09:15:55.133794+00	3201012502064199
\.


--
-- Data for Name: employee_contract; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.employee_contract (id, employee_id, agreement_type_id, contract_number, duration_months, join_date, end_date, status, created_at) FROM stdin;
457a7620-8fe9-49df-8128-eb078280088c	37695a2b-69a8-48cb-9f5f-4e35ec607ae8	57f1644f-4bb6-4b24-8f0a-7611f4f4cf97	8723	12	2026-09-30	2027-09-29	aktif	2026-09-21 09:18:06.984487+00
\.


--
-- Data for Name: employee_document; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.employee_document (id, employee_id, doc_type, file_url, drive_item_id, is_verified, is_deleted, uploaded_at) FROM stdin;
\.


--
-- Data for Name: employee_payroll; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.employee_payroll (id, employee_id, thp, allowance_used, payroll_bank, bank_account_number, bpjs_tk_status, bpjs_tk_number, bpjs_kesehatan_status, bpjs_kesehatan_number, npwp_number, updated_at) FROM stdin;
3e76cd92-9bd2-4c70-a484-b6f795f62f64	37695a2b-69a8-48cb-9f5f-4e35ec607ae8	7500000.00	100000	MANDIRI	98324	8439	4234	ON	4234798	47239437	2026-09-21 09:16:41.789084+00
\.


--
-- Data for Name: generated_cv; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.generated_cv (id, candidate_id, application_id, template_used, language, summary_source, summary_text, file_url, drive_item_id, generated_at) FROM stdin;
03584f1c-acbe-45cd-9a4c-5d18192f2912	75e30690-8cbc-4320-86a2-9c076a34f5ad	\N	altek_standard	ID	HR	tes aja ya	/api/v1/files/candidates/75e30690-8cbc-4320-86a2-9c076a34f5ad/generated_cvs/cv_eko_prasetyo_id_8147ee_e0960aad.pdf	candidates/75e30690-8cbc-4320-86a2-9c076a34f5ad/generated_cvs/cv_eko_prasetyo_id_8147ee_e0960aad.pdf	2026-09-21 14:29:48.720084+00
\.


--
-- Data for Name: notification; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.notification (id, user_id, type, message, link, is_read, created_at) FROM stdin;
249f7c76-d192-4437-99ac-d76fcb9ebfef	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	ai_screening_done	Batch selesai: 1 CV gagal diproses — cek halaman pending review	/applications/pending-review	t	2026-09-22 10:07:55.766146+00
4c26cc93-039b-405e-9b4b-eaf0fb4c7a98	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	ai_screening_done	Batch selesai: 1 CV gagal diproses — cek halaman pending review	/applications/pending-review	t	2026-09-22 09:56:23.742418+00
c8a72b56-83ce-48dc-b400-9ba6acf935cd	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	ai_screening_done	Batch selesai: 1 CV gagal diproses — cek halaman pending review	/applications/pending-review	t	2026-09-22 09:59:23.087803+00
28e326d3-573d-48b1-8567-2e9696f0473b	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	ai_screening_done	Batch selesai: 1 CV gagal diproses — cek halaman pending review	/applications/pending-review	t	2026-09-22 09:59:39.983472+00
ee3dea11-9ec2-4873-a058-50ecac347fba	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	ai_screening_done	Batch selesai: 1 CV gagal diproses — cek halaman pending review	/applications/pending-review	t	2026-09-22 10:08:26.35994+00
f29a1818-92c7-4fa6-8dc6-d4ef9f0782f8	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	ai_screening_done	Batch selesai diproses: 1 CV siap direview, 1 gagal	/applications/pending-review	t	2026-09-22 13:08:24.265108+00
74d23b76-b0f0-4f4c-a44a-97cab93ca19d	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	ai_screening_done	Batch selesai diproses: 2 CV siap direview, 1 gagal	/applications/pending-review	t	2026-09-22 13:37:30.159311+00
89610a00-2674-44ee-9ff5-afcadd521355	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	ai_screening_done	Batch selesai diproses: 2 CV siap direview, 1 gagal	/applications/pending-review	t	2026-09-22 14:04:09.509037+00
7a6916de-ef98-4f02-ae19-0dfff548dc38	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	ai_screening_done	Batch selesai diproses: 3 CV siap direview, 1 gagal	/applications/pending-review	t	2026-09-22 14:11:48.197518+00
4ac4eebe-fe39-46a4-8937-3e04600fb84b	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	ai_screening_done	Batch selesai diproses: 1 CV siap direview	/applications/pending-review	t	2026-09-22 14:14:14.924859+00
\.


--
-- Data for Name: position; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public."position" (id, client_id, title, requirement, employment_type, contract_duration_months, is_active, created_at, updated_at, ai_scoring_config, job_description) FROM stdin;
6aa5ab8d-0720-4ec7-a3d5-4e619e2e6499	1bccf19e-d668-40f3-9d0b-341f932bc25a	Senior Fullstack Developer	next js, sql, ci/cd, postgresql	PKWT (Perjanjian Kerja Waktu Tertentu)	12	t	2026-09-20 13:47:58.739689+00	2026-09-20 13:47:58.739689+00	null	\N
ad06e570-37f3-4cc5-a220-1999258dc051	1ffb89c8-dbd5-4227-baf5-e1c4dc39fd67	Tech Lead	pengalaman lead programmer 2 tahun minial, sql, javascript , html, css, sql, next js	PPJP (Perjanjian Pemborongan Jasa Pekerjaan)	12	t	2026-09-20 13:48:50.122141+00	2026-09-20 13:48:50.122141+00	null	\N
daf8582e-dfb0-4633-876c-805193f87b62	1ffb89c8-dbd5-4227-baf5-e1c4dc39fd67	Mobile Engineer	android, react native, ci/cd	PKWT (Perjanjian Kerja Waktu Tertentu)	24	f	2026-09-21 07:01:00.581827+00	2026-09-22 02:19:45.805568+00	null	\N
\.


--
-- Data for Name: refresh_token; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.refresh_token (id, user_id, token, expires_at, revoked, created_at) FROM stdin;
013a4766-6130-440f-9fc0-fb2b7a7b4366	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA1MTUzNDAsInR5cGUiOiJyZWZyZXNoIn0.zjbXrYy0zB0KMpmx38oW15ISu7TfR5oXEPLJLBQZpMU	2026-09-27 13:22:20.442648+00	t	2026-09-20 13:22:19.794482+00
08b8f2fb-c7c0-45b6-a678-bb9429fb8d33	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA1MTYzMDksInR5cGUiOiJyZWZyZXNoIn0.D06cFdvG5N15HNjkNYZF6jRT7cu7yM7Rk9a-xPIQNjc	2026-09-27 13:38:29.961142+00	t	2026-09-20 13:38:29.716312+00
759b034e-9826-405c-8e1f-3f68c65bc369	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA1MTY0MDMsInR5cGUiOiJyZWZyZXNoIn0.QXa4d7QW2il_SVYkwo5m9ItIF83RjQEtr2FaphfFJI4	2026-09-27 13:40:03.154518+00	t	2026-09-20 13:40:02.882306+00
3cca358c-bd8a-4061-b848-e8309e7a88f7	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWRkMGNiZC1hYTYzLTRlMzktOTZiMi1iOTZjNDRlNGFmNzMiLCJyb2xlIjoiaHIiLCJleHAiOjE3OTA1MTY4MTUsInR5cGUiOiJyZWZyZXNoIn0.0W_QafdPwxg1jmhteyOgVwnSkD47hnkeHOMr5BcXD-c	2026-09-27 13:46:55.229073+00	t	2026-09-20 13:46:54.957986+00
21d748b3-3a1d-4935-853a-9b4a22e63018	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDUxNjgzNCwidHlwZSI6InJlZnJlc2gifQ.bg8z6r5UKA8lK-2Rj4FXPb3bCsb_AScPmZ6SN_Ghdlk	2026-09-27 13:47:14.302718+00	t	2026-09-20 13:47:14.030559+00
e2619bd2-768e-4b50-8f22-a06feb65ae52	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA1Nzc0NjYsInR5cGUiOiJyZWZyZXNoIn0.SSt4sxHG4qa6Vms5zJN6EI9F_wUpjW-aMDr9YDgGr04	2026-09-28 06:37:46.253668+00	t	2026-09-21 06:37:45.9118+00
64f1b9ed-5fee-439a-af95-c135bbe22c9f	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA1Nzg0MjUsInR5cGUiOiJyZWZyZXNoIn0.Dq9U1lsYiMaGozF7HBxMpf9RSKWI4GB1v1A1RDGRa-k	2026-09-28 06:53:45.968317+00	t	2026-09-21 06:53:45.967468+00
4c630219-6ffe-4afd-9324-2a452509c6f1	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA1NzkzNTYsInR5cGUiOiJyZWZyZXNoIn0.CGZbXSWuI1ZOqQGBbRE62GiNXadrVK8qYACUf53Gsq0	2026-09-28 07:09:16.014784+00	t	2026-09-21 07:09:16.009778+00
b66c03cf-6771-4a4d-bc48-ad23dfcf6d6a	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA1Nzk5MTIsInR5cGUiOiJyZWZyZXNoIn0.mvLfRFHJE3pBibXk96FYOitD_ii1kdrlCG-Q0pO6xEY	2026-09-28 07:18:32.23759+00	f	2026-09-21 07:18:31.969688+00
734b7814-380e-4f51-ad67-57a667016cf0	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA1ODIzNTIsInR5cGUiOiJyZWZyZXNoIn0.HuhqGeBW5vtfZVl-8c5_4OkLYt4BXksOdOno15_BmFY	2026-09-28 07:59:12.516796+00	t	2026-09-21 07:59:12.24493+00
bc8993e6-d714-4125-ad95-178681036890	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA1ODI4MjQsInR5cGUiOiJyZWZyZXNoIn0.hFGohJ1vQP5vc_nfGxB3wa8DDL3JczvXaLTU6zbBLaU	2026-09-28 08:07:04.574492+00	t	2026-09-21 08:07:04.571042+00
43efe97e-6275-4a5b-a60d-c73240fa07d0	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA1ODQzNTksInR5cGUiOiJyZWZyZXNoIn0.tmxcNLgXELJ2ym5TQCms_ufch_MU8utBX2eJKBB1jN0	2026-09-28 08:32:39.60914+00	t	2026-09-21 08:32:39.607548+00
608404f9-615a-4f77-9a00-02cb2d2b50c3	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA1ODU2MjgsInR5cGUiOiJyZWZyZXNoIn0.OD7qhAywh32rO7DhnOG48hX0va0XulJSqMr6Ezyi2bo	2026-09-28 08:53:48.651599+00	t	2026-09-21 08:53:48.650188+00
c9c0840c-56ea-4774-ad5c-c9e133ef5fdb	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA1ODY1NzcsInR5cGUiOiJyZWZyZXNoIn0.VnO7elyhFz7Xzc4p30xlkWaZHF8JrYi9kHdjE3xwh2c	2026-09-28 09:09:37.422129+00	t	2026-09-21 09:09:37.419997+00
c3d95527-caec-4cd9-973f-8e4b7fcb2e81	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA1ODcwMjcsInR5cGUiOiJyZWZyZXNoIn0.OcNlkMg6R5KhdlLDR_lzFOYVO7P_bPn3w_hqF8DdO44	2026-09-28 09:17:07.941263+00	t	2026-09-21 09:17:07.683+00
c1b66367-6c48-4fb0-8777-320e16160882	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWRkMGNiZC1hYTYzLTRlMzktOTZiMi1iOTZjNDRlNGFmNzMiLCJyb2xlIjoiaHIiLCJleHAiOjE3OTA1ODcwNTMsInR5cGUiOiJyZWZyZXNoIn0.Z4w6kgElVsq6Kybasn50Mu0OcEruquWVtZ0IdjkqEtc	2026-09-28 09:17:33.555352+00	t	2026-09-21 09:17:33.305614+00
adf06a2f-ce56-4f2d-b6cc-54180ca91a25	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDU4NzE2MiwidHlwZSI6InJlZnJlc2gifQ.NY7_vThD20u_DHLLr-8pw2KDofLwgUVD8b9dXWuq7wM	2026-09-28 09:19:22.721603+00	t	2026-09-21 09:19:22.45681+00
8cfd5d61-74d3-4cfe-a458-979e05a4ab92	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDU4ODA2NiwidHlwZSI6InJlZnJlc2gifQ.SA4jCySb1UV4FicKQTLhXLWanL23IipnS43EQ2Gdk8g	2026-09-28 09:34:26.212792+00	t	2026-09-21 09:34:26.210812+00
61d7b126-6260-4326-a0e6-d685b2131d4f	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDU4ODk2MywidHlwZSI6InJlZnJlc2gifQ.sZhBGqnJWwHfO2DWbECWSKo7rXm2D-ORJKmH4Sz5ZUE	2026-09-28 09:49:23.753004+00	t	2026-09-21 09:49:23.751259+00
36ae53f6-9c44-4d55-86e6-0e41e2ad9c83	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDU4OTg3MSwidHlwZSI6InJlZnJlc2gifQ.6mrlOo4OM3ag3SOQg_754-bv2ZcT1JXIe-DeJnoFBW0	2026-09-28 10:04:31.699544+00	t	2026-09-21 10:04:31.694736+00
9cd83c06-dd2e-4983-8ec1-6c2990480c8d	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDU5MDc5OSwidHlwZSI6InJlZnJlc2gifQ.QmwLHsjXPqDY8usc8A8yHQFxl7jNH-4MLE3ZDW1jc0U	2026-09-28 10:19:59.300545+00	t	2026-09-21 10:19:59.299434+00
dc3f8eaf-b012-438f-8286-44c7f97a9987	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDU5MDgxOCwidHlwZSI6InJlZnJlc2gifQ.KVw7HZDxcFOl6S9EZ18sYMPBYMtH8qjYyZh_GM0jPQw	2026-09-28 10:20:18.070714+00	t	2026-09-21 10:20:18.069651+00
5f051ba2-075e-448e-86de-5b716b608405	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDU5MTczMCwidHlwZSI6InJlZnJlc2gifQ.hhgA_72Y7BqSXQ0DkOhiGs66gHk9WDHMkM3DdRRQRJk	2026-09-28 10:35:30.862422+00	t	2026-09-21 10:35:30.858153+00
351f448d-4c58-4754-8ae6-eb32173714b9	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDU5MjY0MSwidHlwZSI6InJlZnJlc2gifQ.QKPul8CmM3fWoLSi-0NSNF4r91Ucnu20U_bzPURciQE	2026-09-28 10:50:41.093768+00	f	2026-09-21 10:50:41.089415+00
3f943e98-e702-4557-91aa-2fb8b0afea99	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA2MDQ5NTYsInR5cGUiOiJyZWZyZXNoIn0.w8zmxF-3o3Ugh_t3KjGlrIliyMpkLlsYcquokugPv_o	2026-09-28 14:15:56.402715+00	t	2026-09-21 14:15:55.948979+00
7a8d9082-1fff-46cb-b365-87b5ec7fe3bf	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA2MzE5NDQsInR5cGUiOiJyZWZyZXNoIn0.SsRzpB0TuddwWLmFPOcHZgTbYhWGZkMRPPCKmwcBwpY	2026-09-28 21:45:44.32024+00	f	2026-09-21 21:45:44.315747+00
c0029fba-1d2b-4b4c-93d5-eb72ef22149f	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA2NDgzMzIsInR5cGUiOiJyZWZyZXNoIn0.VN6vWcCRJ68cQiQkAAotwGT3kGzOlEsFCuPjPvodj5M	2026-09-29 02:18:52.250969+00	t	2026-09-22 02:18:52.004374+00
6b50f665-f780-4336-8e3b-bc477f2f79d8	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDY0ODk3OCwidHlwZSI6InJlZnJlc2gifQ.kKSV7f_H42RsMMhOpY2ygIhGE9Y2HHU4xHeXcGJEDWk	2026-09-29 02:29:38.521+00	t	2026-09-22 02:29:38.26807+00
d043816e-c062-4d92-912b-ee5a262b704c	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDY1MDE4NCwidHlwZSI6InJlZnJlc2gifQ.DsR8N70Gx2KEAqN6pIJN6S0pU89ptuqw2_sx4mxBHL4	2026-09-29 02:49:44.663082+00	t	2026-09-22 02:49:44.660029+00
511af0bc-75f5-4b6d-9273-2cc9d205af46	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDY1MDc3OSwidHlwZSI6InJlZnJlc2gifQ.l93WHf2kgkpaVuIe9mR2659lpng-d3aOXrTsxU-JDhI	2026-09-29 02:59:39.543461+00	t	2026-09-22 02:59:39.541858+00
02d4c190-a5d1-43e4-8543-c6de102009b6	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDY1MTY5MSwidHlwZSI6InJlZnJlc2gifQ.Vez5_m5B-L0hOsCKloeRpsCwBxnvL-Z4hJoUbT-126E	2026-09-29 03:14:51.056676+00	t	2026-09-22 03:14:51.055204+00
b7796d6a-bf85-4a6b-a9f5-9ed77c207ec1	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDY1MjU3OSwidHlwZSI6InJlZnJlc2gifQ.1N_IVYsv8DqxDZ1QoEoSYGwhl51mOdNMRDrw8uhbXgI	2026-09-29 03:29:39.638054+00	t	2026-09-22 03:29:39.636242+00
54a36989-819a-4011-827a-c013df94c24a	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWRkMGNiZC1hYTYzLTRlMzktOTZiMi1iOTZjNDRlNGFmNzMiLCJyb2xlIjoiaHIiLCJleHAiOjE3OTA2NTMxNDgsInR5cGUiOiJyZWZyZXNoIn0.aYDp-dNoXloh43n55TmeJAnPQruqrB55OKO2NsLAExM	2026-09-29 03:39:08.94941+00	t	2026-09-22 03:39:08.681162+00
ee7e20c8-43d6-4170-9b94-a0ae3cc25d0e	5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTEzZTlkZC0yYzhhLTQxNjEtYjg4Zi04YWVhZmE4M2JhMmUiLCJyb2xlIjoibWFuYWdlciIsImV4cCI6MTc5MDY1MzE5OCwidHlwZSI6InJlZnJlc2gifQ.m1yqyXdWgEIDXy0-fwC5ohfOOb4meixhbfTQ4N9v_EM	2026-09-29 03:39:58.098148+00	f	2026-09-22 03:39:57.835758+00
e6e40b92-b302-44d9-992d-4a3167a6940f	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA2Njg4OTcsInR5cGUiOiJyZWZyZXNoIn0.fjGfyNt9SWIjUXrYKBjYqZ6A2YxEtffq4Ow5hcjKoI4	2026-09-29 08:01:37.473034+00	f	2026-09-22 08:01:37.056245+00
d0d61b12-8427-4b11-aa88-1b65f7fece43	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA2Njg5MTIsInR5cGUiOiJyZWZyZXNoIn0.prZxouxrLJ8WUHPQPc9ePoiCQrADlFghuqWaunxyAA8	2026-09-29 08:01:52.278721+00	f	2026-09-22 08:01:52.034395+00
5d63c902-66cc-4470-adc7-66432e3b4b7a	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA2NzA0NTMsInR5cGUiOiJyZWZyZXNoIn0.sgrL0oNP7xrFv118JOLd90IkegG_VublbHdYzlBw71w	2026-09-29 08:27:33.964189+00	f	2026-09-22 08:27:33.701711+00
a8465ca0-a559-49e7-95a0-cf31f406d22e	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA2NzQzMjQsInR5cGUiOiJyZWZyZXNoIn0.YzYl1Oc5nHyVqyzgaYz2IB391lfIgSBojWdBo21mrbA	2026-09-29 09:32:04.455735+00	t	2026-09-22 09:32:04.164926+00
563b4601-5640-453f-b456-640f31e26a00	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWRkMGNiZC1hYTYzLTRlMzktOTZiMi1iOTZjNDRlNGFmNzMiLCJyb2xlIjoiaHIiLCJleHAiOjE3OTA2NzQ5MDQsInR5cGUiOiJyZWZyZXNoIn0.hq4VHCcWHNMUflemfTkhzBZArEg7ScDsJ_2i1c567es	2026-09-29 09:41:44.808914+00	t	2026-09-22 09:41:44.513825+00
7735c80a-5992-4137-b5b1-0a470aa976f6	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWRkMGNiZC1hYTYzLTRlMzktOTZiMi1iOTZjNDRlNGFmNzMiLCJyb2xlIjoiaHIiLCJleHAiOjE3OTA2NzU4MjQsInR5cGUiOiJyZWZyZXNoIn0.w_awtZe-uCoedpybnlDONlboPO4JsIdzcyk6h18DvLY	2026-09-29 09:57:04.296667+00	f	2026-09-22 09:57:04.293293+00
12fd3213-f053-4fc7-a879-1264532dc148	54b45fdd-9c13-497e-b4fd-d98215991a1d	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NGI0NWZkZC05YzEzLTQ5N2UtYjRmZC1kOTgyMTU5OTFhMWQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTA2ODcyNDcsInR5cGUiOiJyZWZyZXNoIn0.dRWkSW79iOcr4WppRdU78dWZ0JIn5tgkbDb_R1bVaKc	2026-09-29 13:07:27.675438+00	t	2026-09-22 13:07:27.41029+00
ad6c3413-860a-4702-96cf-866bae7e6f4d	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWRkMGNiZC1hYTYzLTRlMzktOTZiMi1iOTZjNDRlNGFmNzMiLCJyb2xlIjoiaHIiLCJleHAiOjE3OTA2ODcyNjEsInR5cGUiOiJyZWZyZXNoIn0.Zg7L8_Ab8WO1_ZMIdbwgTmKDCoF1k39Ypj3uwqT6WOg	2026-09-29 13:07:41.933626+00	f	2026-09-22 13:07:41.670413+00
a6e5c1f9-a38d-440b-b084-89d958ff22fc	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWRkMGNiZC1hYTYzLTRlMzktOTZiMi1iOTZjNDRlNGFmNzMiLCJyb2xlIjoiaHIiLCJleHAiOjE3OTA2ODkwMDksInR5cGUiOiJyZWZyZXNoIn0.vVe0y-QzdVPXDOC_neILelM_UcwcMpe4DV8v6rZO8To	2026-09-29 13:36:49.062683+00	f	2026-09-22 13:36:48.80135+00
9b70a06f-4e54-47e8-917f-deadcefba1c8	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWRkMGNiZC1hYTYzLTRlMzktOTZiMi1iOTZjNDRlNGFmNzMiLCJyb2xlIjoiaHIiLCJleHAiOjE3OTA2OTA2MDMsInR5cGUiOiJyZWZyZXNoIn0.wsjgRpcV07nlyVXYtXo-c6dJhpDADyR54Iit85hsod0	2026-09-29 14:03:23.867491+00	t	2026-09-22 14:03:23.579708+00
5ad25214-9c40-4c02-bb1f-9ba873791cf0	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWRkMGNiZC1hYTYzLTRlMzktOTZiMi1iOTZjNDRlNGFmNzMiLCJyb2xlIjoiaHIiLCJleHAiOjE3OTA2OTEwMDQsInR5cGUiOiJyZWZyZXNoIn0.HRJekY0ZMIw1dxeurIr1zhuc4883Azs6Ig8rfPuKjB4	2026-09-29 14:10:04.405951+00	t	2026-09-22 14:10:04.146948+00
a96dc4cd-1b04-4abd-a66c-ac2a8272a81d	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWRkMGNiZC1hYTYzLTRlMzktOTZiMi1iOTZjNDRlNGFmNzMiLCJyb2xlIjoiaHIiLCJleHAiOjE3OTA2OTE5MTUsInR5cGUiOiJyZWZyZXNoIn0.FVgIh7nyLaNtUrDGrxZ20WWnMZOCjJCX8RCiNge2McM	2026-09-29 14:25:15.603727+00	t	2026-09-22 14:25:15.597993+00
66966e5a-c1bb-41c8-b425-52338c9d3332	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWRkMGNiZC1hYTYzLTRlMzktOTZiMi1iOTZjNDRlNGFmNzMiLCJyb2xlIjoiaHIiLCJleHAiOjE3OTA2OTI4MDUsInR5cGUiOiJyZWZyZXNoIn0.xo7wN_tfZy0E6isenWR33IRWprrgnAzWIweGnXvVBuc	2026-09-29 14:40:05.719475+00	t	2026-09-22 14:40:05.718544+00
\.


--
-- Data for Name: source_channel; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.source_channel (id, label, is_active, created_at, updated_at) FROM stdin;
64ccb98d-e044-4d85-8504-b96c698db447	Linkedin	t	2026-09-21 06:55:52.402467+00	2026-09-21 06:55:52.402467+00
54b7ca8f-e223-44c9-a552-fb3e3c437420	Glints	t	2026-09-21 06:55:57.511518+00	2026-09-21 06:55:57.511518+00
4b65bb51-4d18-4a73-9ff0-97641f32a73b	Jobstreet	t	2026-09-21 06:56:01.987271+00	2026-09-21 06:56:01.987271+00
a52bd385-33f7-4e05-82d3-3f46ef1229ee	indeed	t	2026-09-21 06:56:06.289361+00	2026-09-21 06:56:06.289361+00
67cd8018-9dc1-48af-8f12-734a2a361676	email	t	2026-09-21 06:56:08.697189+00	2026-09-21 06:56:08.697189+00
ded7dc20-582c-45a7-92a3-f14cd44ba740	web perusahaan	t	2026-09-21 06:56:17.962831+00	2026-09-21 06:56:17.962831+00
\.


--
-- Data for Name: stage_history; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public.stage_history (id, application_id, stage_name, scheduled_date, actual_date, result, salary_current_input, salary_expected_input, notes, updated_by, created_at, handler_id) FROM stdin;
008577fd-f0fc-4191-9b71-58beff31ca6f	499c4402-3e06-45f2-b00f-d7523914298a	Dijadwalkan_Interview	\N	\N	\N	\N	\N	Lamaran dibuat	54b45fdd-9c13-497e-b4fd-d98215991a1d	2026-09-21 07:01:17.273038+00	\N
2f02df4a-c885-4135-98f5-43ae07957713	499c4402-3e06-45f2-b00f-d7523914298a	Konfirmasi_Kehadiran	\N	\N	ok	\N	\N	\N	54b45fdd-9c13-497e-b4fd-d98215991a1d	2026-09-21 09:13:18.300296+00	54b45fdd-9c13-497e-b4fd-d98215991a1d
f47a44d3-a991-442c-8aaf-67db23d3feff	499c4402-3e06-45f2-b00f-d7523914298a	Interview_HR	2026-09-24	2026-09-24	pass	5000000.00	7000000.00	\N	54b45fdd-9c13-497e-b4fd-d98215991a1d	2026-09-21 09:13:41.767616+00	54b45fdd-9c13-497e-b4fd-d98215991a1d
a29e51fd-d1db-4754-9481-2b5a54552dce	499c4402-3e06-45f2-b00f-d7523914298a	Psikotest	2026-09-30	2026-09-30	\N	\N	\N	\N	54b45fdd-9c13-497e-b4fd-d98215991a1d	2026-09-21 09:14:00.380265+00	54b45fdd-9c13-497e-b4fd-d98215991a1d
b257268c-2f5c-4dc1-b7e3-36129cf35fec	499c4402-3e06-45f2-b00f-d7523914298a	Psikotest	\N	\N	lolos	\N	\N	skor 90/100	54b45fdd-9c13-497e-b4fd-d98215991a1d	2026-09-21 09:14:19.001775+00	54b45fdd-9c13-497e-b4fd-d98215991a1d
f234d289-94e7-4870-8aa3-7f78b9660495	499c4402-3e06-45f2-b00f-d7523914298a	Interview_User	2026-09-30	2026-09-30	\N	\N	\N	\N	54b45fdd-9c13-497e-b4fd-d98215991a1d	2026-09-21 09:14:29.500886+00	54b45fdd-9c13-497e-b4fd-d98215991a1d
1d383203-35f7-4f2f-9a63-d8ec549c363d	499c4402-3e06-45f2-b00f-d7523914298a	Offering	2026-10-02	2026-10-02	\N	5000000.00	7000000.00	\N	54b45fdd-9c13-497e-b4fd-d98215991a1d	2026-09-21 09:14:57.609133+00	54b45fdd-9c13-497e-b4fd-d98215991a1d
bb063bbf-a288-4be2-937c-f303777f8d51	499c4402-3e06-45f2-b00f-d7523914298a	Offering	\N	\N	lolos_kontrak	5000000.00	7000000.00	\N	54b45fdd-9c13-497e-b4fd-d98215991a1d	2026-09-21 09:15:15.341707+00	54b45fdd-9c13-497e-b4fd-d98215991a1d
268c071c-d9fb-4b7b-b129-b90edbe28ccd	499c4402-3e06-45f2-b00f-d7523914298a	Tanda_Tangan_Kontrak	\N	\N	signed	\N	\N	\N	54b45fdd-9c13-497e-b4fd-d98215991a1d	2026-09-21 09:15:24.830589+00	54b45fdd-9c13-497e-b4fd-d98215991a1d
09d9d796-7134-4194-9f78-0ef5e62541ef	499c4402-3e06-45f2-b00f-d7523914298a	Onboarding	2026-10-16	2026-10-16	\N	\N	\N	\N	54b45fdd-9c13-497e-b4fd-d98215991a1d	2026-09-21 09:15:39.947855+00	54b45fdd-9c13-497e-b4fd-d98215991a1d
86ec2166-b7f7-4aa0-8be9-9a4a4c6f4e04	499c4402-3e06-45f2-b00f-d7523914298a	Existing	2026-10-12	2026-10-12	\N	\N	\N	\N	54b45fdd-9c13-497e-b4fd-d98215991a1d	2026-09-21 09:15:55.133794+00	54b45fdd-9c13-497e-b4fd-d98215991a1d
cdcd27e8-04b1-4790-b853-d5411fec0dfd	48847554-b953-468a-9b7f-68d89e892606	Dijadwalkan_Interview	\N	\N	\N	\N	\N	Lamaran dibuat	9edd0cbd-aa63-4e39-96b2-b96c44e4af73	2026-09-22 14:12:51.447076+00	\N
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: talent26
--

COPY public."user" (id, name, email, hashed_password, role, is_active, reset_token, reset_token_expires_at, created_at, updated_at) FROM stdin;
54b45fdd-9c13-497e-b4fd-d98215991a1d	Admin Altek	admin@altek.id	$2b$12$Bv2k12thxwNhyNIRVpFffO3xMwWlgXf4dcGMEyZkjlYfvpkidno3O	admin	t	\N	\N	2026-09-20 09:43:53.118978+00	2026-09-20 09:43:53.118978+00
5513e9dd-2c8a-4161-b88f-8aeafa83ba2e	Krisna Manager	krisna@altekcitra.id	$2b$12$Pe4zUlfI2KyX.Gxmp/BM3evWFoUNbC2SaU2fw8bWXSytvbmX/NxY.	manager	t	\N	\N	2026-09-20 13:40:25.79241+00	2026-09-20 13:40:25.79241+00
9edd0cbd-aa63-4e39-96b2-b96c44e4af73	John Doe	john.doe@altekcitra.id	$2b$12$igRB.PVrdM92Og.dQ5lsNuJIf3mtrWklPGFx7HnaXt2LTE07rn2tW	hr	t	\N	\N	2026-09-20 13:46:37.556453+00	2026-09-20 13:46:37.556453+00
\.


--
-- Name: agreement_type agreement_type_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.agreement_type
    ADD CONSTRAINT agreement_type_pkey PRIMARY KEY (id);


--
-- Name: ai_screening_result ai_screening_result_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.ai_screening_result
    ADD CONSTRAINT ai_screening_result_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: application application_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT application_pkey PRIMARY KEY (id);


--
-- Name: blacklist blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.blacklist
    ADD CONSTRAINT blacklist_pkey PRIMARY KEY (id);


--
-- Name: blacklist_status_type blacklist_status_type_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.blacklist_status_type
    ADD CONSTRAINT blacklist_status_type_pkey PRIMARY KEY (id);


--
-- Name: candidate_document candidate_document_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.candidate_document
    ADD CONSTRAINT candidate_document_pkey PRIMARY KEY (id);


--
-- Name: candidate_education candidate_education_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.candidate_education
    ADD CONSTRAINT candidate_education_pkey PRIMARY KEY (id);


--
-- Name: candidate_experience candidate_experience_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.candidate_experience
    ADD CONSTRAINT candidate_experience_pkey PRIMARY KEY (id);


--
-- Name: candidate candidate_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.candidate
    ADD CONSTRAINT candidate_pkey PRIMARY KEY (id);


--
-- Name: candidate_project candidate_project_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.candidate_project
    ADD CONSTRAINT candidate_project_pkey PRIMARY KEY (id);


--
-- Name: client client_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT client_pkey PRIMARY KEY (id);


--
-- Name: employee employee_application_id_key; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_application_id_key UNIQUE (application_id);


--
-- Name: employee_contract employee_contract_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.employee_contract
    ADD CONSTRAINT employee_contract_pkey PRIMARY KEY (id);


--
-- Name: employee_document employee_document_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.employee_document
    ADD CONSTRAINT employee_document_pkey PRIMARY KEY (id);


--
-- Name: employee employee_employee_nip_key; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_employee_nip_key UNIQUE (employee_nip);


--
-- Name: employee_payroll employee_payroll_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.employee_payroll
    ADD CONSTRAINT employee_payroll_employee_id_key UNIQUE (employee_id);


--
-- Name: employee_payroll employee_payroll_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.employee_payroll
    ADD CONSTRAINT employee_payroll_pkey PRIMARY KEY (id);


--
-- Name: employee employee_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_pkey PRIMARY KEY (id);


--
-- Name: generated_cv generated_cv_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.generated_cv
    ADD CONSTRAINT generated_cv_pkey PRIMARY KEY (id);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- Name: position position_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_pkey PRIMARY KEY (id);


--
-- Name: refresh_token refresh_token_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.refresh_token
    ADD CONSTRAINT refresh_token_pkey PRIMARY KEY (id);


--
-- Name: refresh_token refresh_token_token_key; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.refresh_token
    ADD CONSTRAINT refresh_token_token_key UNIQUE (token);


--
-- Name: source_channel source_channel_label_key; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.source_channel
    ADD CONSTRAINT source_channel_label_key UNIQUE (label);


--
-- Name: source_channel source_channel_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.source_channel
    ADD CONSTRAINT source_channel_pkey PRIMARY KEY (id);


--
-- Name: stage_history stage_history_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.stage_history
    ADD CONSTRAINT stage_history_pkey PRIMARY KEY (id);


--
-- Name: user uq_user_email; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT uq_user_email UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: idx_application_candidate_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_application_candidate_id ON public.application USING btree (candidate_id);


--
-- Name: idx_application_current_stage; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_application_current_stage ON public.application USING btree (current_stage);


--
-- Name: idx_application_position_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_application_position_id ON public.application USING btree (position_id);


--
-- Name: idx_application_status; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_application_status ON public.application USING btree (status);


--
-- Name: idx_blacklist_candidate_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_blacklist_candidate_id ON public.blacklist USING btree (candidate_id);


--
-- Name: idx_blacklist_is_active; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_blacklist_is_active ON public.blacklist USING btree (is_active);


--
-- Name: idx_blacklist_is_approved; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_blacklist_is_approved ON public.blacklist USING btree (is_approved);


--
-- Name: idx_blacklist_status_type_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_blacklist_status_type_id ON public.blacklist USING btree (status_type_id);


--
-- Name: idx_candidate_document_candidate_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_candidate_document_candidate_id ON public.candidate_document USING btree (candidate_id);


--
-- Name: idx_candidate_education_candidate_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_candidate_education_candidate_id ON public.candidate_education USING btree (candidate_id);


--
-- Name: idx_candidate_email; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_candidate_email ON public.candidate USING btree (email);


--
-- Name: idx_candidate_experience_candidate_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_candidate_experience_candidate_id ON public.candidate_experience USING btree (candidate_id);


--
-- Name: idx_candidate_identity_no; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_candidate_identity_no ON public.candidate USING btree (identity_no);


--
-- Name: idx_candidate_phone; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_candidate_phone ON public.candidate USING btree (phone);


--
-- Name: idx_employee_candidate_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_employee_candidate_id ON public.employee USING btree (candidate_id);


--
-- Name: idx_employee_contract_employee_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_employee_contract_employee_id ON public.employee_contract USING btree (employee_id);


--
-- Name: idx_employee_contract_end_date; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_employee_contract_end_date ON public.employee_contract USING btree (end_date);


--
-- Name: idx_employee_contract_status; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_employee_contract_status ON public.employee_contract USING btree (status);


--
-- Name: idx_employee_document_employee_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_employee_document_employee_id ON public.employee_document USING btree (employee_id);


--
-- Name: idx_employee_employee_status; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_employee_employee_status ON public.employee USING btree (employee_status);


--
-- Name: idx_employee_placement; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_employee_placement ON public.employee USING btree (placement);


--
-- Name: idx_generated_cv_application_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_generated_cv_application_id ON public.generated_cv USING btree (application_id);


--
-- Name: idx_generated_cv_candidate_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_generated_cv_candidate_id ON public.generated_cv USING btree (candidate_id);


--
-- Name: idx_position_client_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_position_client_id ON public."position" USING btree (client_id);


--
-- Name: idx_stage_history_application_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_stage_history_application_id ON public.stage_history USING btree (application_id);


--
-- Name: idx_stage_history_created_at; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_stage_history_created_at ON public.stage_history USING btree (created_at);


--
-- Name: idx_stage_history_stage_name; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_stage_history_stage_name ON public.stage_history USING btree (stage_name);


--
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX idx_user_email ON public."user" USING btree (email);


--
-- Name: ix_candidate_project_candidate_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX ix_candidate_project_candidate_id ON public.candidate_project USING btree (candidate_id);


--
-- Name: ix_notification_user_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX ix_notification_user_id ON public.notification USING btree (user_id);


--
-- Name: ix_refresh_token_token; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX ix_refresh_token_token ON public.refresh_token USING btree (token);


--
-- Name: ix_refresh_token_user_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX ix_refresh_token_user_id ON public.refresh_token USING btree (user_id);


--
-- Name: ix_stage_history_handler_id; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX ix_stage_history_handler_id ON public.stage_history USING btree (handler_id);


--
-- Name: ix_user_reset_token; Type: INDEX; Schema: public; Owner: talent26
--

CREATE INDEX ix_user_reset_token ON public."user" USING btree (reset_token);


--
-- Name: agreement_type agreement_type_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.agreement_type
    ADD CONSTRAINT agreement_type_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: ai_screening_result ai_screening_result_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.ai_screening_result
    ADD CONSTRAINT ai_screening_result_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.application(id) ON DELETE CASCADE;


--
-- Name: ai_screening_result ai_screening_result_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.ai_screening_result
    ADD CONSTRAINT ai_screening_result_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate(id) ON DELETE SET NULL;


--
-- Name: ai_screening_result ai_screening_result_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.ai_screening_result
    ADD CONSTRAINT ai_screening_result_position_id_fkey FOREIGN KEY (position_id) REFERENCES public."position"(id) ON DELETE SET NULL;


--
-- Name: ai_screening_result ai_screening_result_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.ai_screening_result
    ADD CONSTRAINT ai_screening_result_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: ai_screening_result ai_screening_result_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.ai_screening_result
    ADD CONSTRAINT ai_screening_result_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: application application_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT application_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate(id) ON DELETE RESTRICT;


--
-- Name: application application_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT application_position_id_fkey FOREIGN KEY (position_id) REFERENCES public."position"(id) ON DELETE RESTRICT;


--
-- Name: application application_recruiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT application_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: blacklist blacklist_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.blacklist
    ADD CONSTRAINT blacklist_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: blacklist blacklist_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.blacklist
    ADD CONSTRAINT blacklist_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate(id) ON DELETE RESTRICT;


--
-- Name: blacklist blacklist_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.blacklist
    ADD CONSTRAINT blacklist_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employee(id) ON DELETE SET NULL;


--
-- Name: blacklist blacklist_pic_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.blacklist
    ADD CONSTRAINT blacklist_pic_user_id_fkey FOREIGN KEY (pic_user_id) REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: blacklist_status_type blacklist_status_type_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.blacklist_status_type
    ADD CONSTRAINT blacklist_status_type_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: blacklist blacklist_status_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.blacklist
    ADD CONSTRAINT blacklist_status_type_id_fkey FOREIGN KEY (status_type_id) REFERENCES public.blacklist_status_type(id) ON DELETE RESTRICT;


--
-- Name: candidate_document candidate_document_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.candidate_document
    ADD CONSTRAINT candidate_document_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate(id) ON DELETE CASCADE;


--
-- Name: candidate_education candidate_education_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.candidate_education
    ADD CONSTRAINT candidate_education_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate(id) ON DELETE CASCADE;


--
-- Name: candidate_experience candidate_experience_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.candidate_experience
    ADD CONSTRAINT candidate_experience_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate(id) ON DELETE CASCADE;


--
-- Name: candidate_project candidate_project_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.candidate_project
    ADD CONSTRAINT candidate_project_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate(id) ON DELETE CASCADE;


--
-- Name: employee employee_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.application(id) ON DELETE SET NULL;


--
-- Name: employee employee_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate(id) ON DELETE RESTRICT;


--
-- Name: employee_contract employee_contract_agreement_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.employee_contract
    ADD CONSTRAINT employee_contract_agreement_type_id_fkey FOREIGN KEY (agreement_type_id) REFERENCES public.agreement_type(id) ON DELETE SET NULL;


--
-- Name: employee_contract employee_contract_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.employee_contract
    ADD CONSTRAINT employee_contract_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employee(id) ON DELETE CASCADE;


--
-- Name: employee_document employee_document_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.employee_document
    ADD CONSTRAINT employee_document_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employee(id) ON DELETE CASCADE;


--
-- Name: employee_payroll employee_payroll_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.employee_payroll
    ADD CONSTRAINT employee_payroll_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employee(id) ON DELETE CASCADE;


--
-- Name: generated_cv generated_cv_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.generated_cv
    ADD CONSTRAINT generated_cv_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.application(id) ON DELETE SET NULL;


--
-- Name: generated_cv generated_cv_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.generated_cv
    ADD CONSTRAINT generated_cv_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate(id) ON DELETE CASCADE;


--
-- Name: notification notification_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: position position_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.client(id) ON DELETE RESTRICT;


--
-- Name: stage_history stage_history_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.stage_history
    ADD CONSTRAINT stage_history_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.application(id) ON DELETE CASCADE;


--
-- Name: stage_history stage_history_handler_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.stage_history
    ADD CONSTRAINT stage_history_handler_id_fkey FOREIGN KEY (handler_id) REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: stage_history stage_history_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: talent26
--

ALTER TABLE ONLY public.stage_history
    ADD CONSTRAINT stage_history_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 4sOdU8NNW4ffNIN6g00Pzm1j6xoEAqD9I93Rck9pBSeeAGblwtZWkegg5g5UjsM

