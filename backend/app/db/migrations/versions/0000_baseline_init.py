"""0000_baseline_init

Full schema baseline — single migration mencakup semua tabel dan kolom dari model terkini.
Idempotent: menggunakan raw SQL dengan IF NOT EXISTS / DO NOTHING agar aman di-run ulang.

Revision ID: 0000baseline0001
Revises:
Create Date: 2026-10-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0000baseline0001"
down_revision: Union[str, None] = "x2y3z4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Jalankan seluruh DDL sebagai raw SQL dengan IF NOT EXISTS agar idempotent
    op.execute("""
    -- ── ENUM TYPES ────────────────────────────────────────────────────────────
    DO $$ BEGIN CREATE TYPE user_role_enum AS ENUM ('admin', 'hr', 'manager', 'pm');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN CREATE TYPE completeness_status_enum AS ENUM ('lengkap', 'belum_lengkap');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN CREATE TYPE contact_status_enum AS ENUM ('aktif', 'tidak_bisa_dihubungi');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN CREATE TYPE application_status_enum AS ENUM ('active', 'rejected', 'hired', 'withdrawn');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN CREATE TYPE employee_status_enum AS ENUM ('aktif', 'cuti', 'resign', 'nonaktif');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN CREATE TYPE leave_status_enum AS ENUM ('sudah_bisa_cuti', 'belum');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN CREATE TYPE contract_status_enum AS ENUM ('aktif', 'berakhir', 'diperpanjang');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN CREATE TYPE pool_status_enum AS ENUM ('database', 'talent_pool', 'future_lead');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- ── user ──────────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "user" (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        hashed_password VARCHAR(255) NOT NULL,
        role user_role_enum NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        reset_token VARCHAR(255),
        reset_token_expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ix_user_email ON "user" (email);

    -- ── refresh_token ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS refresh_token (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        token VARCHAR(512) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_refresh_token_token ON refresh_token (token);
    CREATE INDEX IF NOT EXISTS ix_refresh_token_user_id ON refresh_token (user_id);

    -- ── client ────────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS client (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        industry VARCHAR(255),
        pic_name VARCHAR(255),
        pic_contact VARCHAR(500),
        pics JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- ── source_channel ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS source_channel (
        id UUID PRIMARY KEY,
        label VARCHAR(100) NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- ── blacklist_status_type ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS blacklist_status_type (
        id UUID PRIMARY KEY,
        label VARCHAR(255) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by UUID REFERENCES "user"(id),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- ── agreement_type ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS agreement_type (
        id UUID PRIMARY KEY,
        label VARCHAR(255) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by UUID REFERENCES "user"(id),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- ── position ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS position (
        id UUID PRIMARY KEY,
        client_id UUID NOT NULL REFERENCES client(id),
        title VARCHAR(255) NOT NULL,
        requirement TEXT,
        job_description TEXT,
        employment_type VARCHAR(100),
        contract_duration_months INTEGER,
        salary_budget NUMERIC(15,2),
        location VARCHAR(255),
        client_user_names JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        ai_scoring_config JSONB,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_position_client_id ON position (client_id);

    -- ── candidate ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS candidate (
        id UUID PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        identity_no VARCHAR(20),
        birth_date DATE,
        birth_place VARCHAR(255),
        gender VARCHAR(20),
        blood_type VARCHAR(5),
        marital_status VARCHAR(50),
        domicile VARCHAR(255),
        photo_url VARCHAR(500),
        source_channel VARCHAR(100),
        current_salary NUMERIC(15,2),
        expected_salary NUMERIC(15,2),
        notice_period_days INTEGER,
        completeness_status completeness_status_enum DEFAULT 'belum_lengkap',
        contact_status contact_status_enum DEFAULT 'aktif',
        possible_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        pool_status pool_status_enum NOT NULL DEFAULT 'database',
        talent_pool_reason VARCHAR(100),
        talent_pool_notes TEXT,
        talent_pool_updated_at TIMESTAMPTZ,
        talent_pool_updated_by UUID REFERENCES "user"(id),
        notes TEXT,
        skills JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_candidate_email ON candidate (email);
    CREATE INDEX IF NOT EXISTS ix_candidate_phone ON candidate (phone);
    CREATE INDEX IF NOT EXISTS ix_candidate_identity_no ON candidate (identity_no);

    -- ── candidate_education ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS candidate_education (
        id UUID PRIMARY KEY,
        candidate_id UUID NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
        institution VARCHAR(255),
        major VARCHAR(255),
        graduation_year INTEGER,
        gpa NUMERIC(3,2)
    );
    CREATE INDEX IF NOT EXISTS ix_candidate_education_candidate_id ON candidate_education (candidate_id);

    -- ── candidate_experience ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS candidate_experience (
        id UUID PRIMARY KEY,
        candidate_id UUID NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
        company_name VARCHAR(255),
        job_title VARCHAR(255),
        start_date DATE,
        end_date DATE,
        description TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_candidate_experience_candidate_id ON candidate_experience (candidate_id);

    -- ── candidate_document ────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS candidate_document (
        id UUID PRIMARY KEY,
        candidate_id UUID NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
        doc_type VARCHAR(100) NOT NULL,
        label VARCHAR(255),
        file_url VARCHAR(500),
        drive_item_id VARCHAR(500),
        is_verified BOOLEAN DEFAULT FALSE,
        is_deleted BOOLEAN DEFAULT FALSE,
        uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_candidate_document_candidate_id ON candidate_document (candidate_id);

    -- ── candidate_project ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS candidate_project (
        id UUID PRIMARY KEY,
        candidate_id UUID NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
        project_name VARCHAR(255) NOT NULL,
        role VARCHAR(255),
        summary TEXT,
        impact TEXT,
        tech_stack JSONB DEFAULT '[]'::jsonb,
        duration VARCHAR(100),
        is_draft BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_candidate_project_candidate_id ON candidate_project (candidate_id);

    -- ── application ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS application (
        id UUID PRIMARY KEY,
        candidate_id UUID NOT NULL REFERENCES candidate(id),
        position_id UUID NOT NULL REFERENCES position(id),
        recruiter_id UUID REFERENCES "user"(id),
        client_user_id UUID REFERENCES "user"(id),
        client_user_name VARCHAR(255),
        current_stage VARCHAR(100) DEFAULT 'Dijadwalkan_Interview',
        status application_status_enum NOT NULL DEFAULT 'active',
        cv_submitted_to_pm_date DATE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_application_candidate_id ON application (candidate_id);
    CREATE INDEX IF NOT EXISTS ix_application_position_id ON application (position_id);

    -- ── stage_history ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS stage_history (
        id UUID PRIMARY KEY,
        application_id UUID NOT NULL REFERENCES application(id) ON DELETE CASCADE,
        stage_name VARCHAR(100) NOT NULL,
        scheduled_date DATE,
        actual_date DATE,
        result VARCHAR(50),
        salary_current_input NUMERIC(15,2),
        salary_expected_input NUMERIC(15,2),
        notes TEXT,
        updated_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
        handler_id UUID REFERENCES "user"(id),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_stage_history_application_id ON stage_history (application_id);
    CREATE INDEX IF NOT EXISTS ix_stage_history_handler_id ON stage_history (handler_id);

    -- ── ai_screening_result ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS ai_screening_result (
        id UUID PRIMARY KEY,
        application_id UUID REFERENCES application(id),
        candidate_id UUID REFERENCES candidate(id) ON DELETE SET NULL,
        position_id UUID REFERENCES position(id) ON DELETE SET NULL,
        uploaded_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
        cv_file_url VARCHAR(2048),
        cv_drive_item_id VARCHAR(500),
        source_channel VARCHAR(100),
        ai_score FLOAT,
        ai_notes TEXT,
        extracted_data TEXT,
        extracted_json JSONB,
        status VARCHAR(50),
        reviewed_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_ai_screening_result_application_id ON ai_screening_result (application_id);
    CREATE INDEX IF NOT EXISTS ix_ai_screening_result_candidate_id ON ai_screening_result (candidate_id);
    CREATE INDEX IF NOT EXISTS ix_ai_screening_result_status ON ai_screening_result (status);
    CREATE INDEX IF NOT EXISTS ix_ai_screening_result_uploaded_by ON ai_screening_result (uploaded_by);

    -- ── generated_cv ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS generated_cv (
        id UUID PRIMARY KEY,
        candidate_id UUID NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
        application_id UUID REFERENCES application(id) ON DELETE SET NULL,
        template_name VARCHAR(100),
        language VARCHAR(10) DEFAULT 'ID',
        summary_text TEXT,
        summary_source VARCHAR(20),
        html_content TEXT,
        pdf_url VARCHAR(500),
        drive_item_id VARCHAR(500),
        generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_generated_cv_candidate_id ON generated_cv (candidate_id);

    -- ── blacklist ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS blacklist (
        id UUID PRIMARY KEY,
        candidate_id UUID REFERENCES candidate(id),
        employee_id UUID,
        status_type_id UUID NOT NULL REFERENCES blacklist_status_type(id),
        reason VARCHAR(500),
        notes TEXT,
        blacklisted_date DATE,
        pic_user_id UUID REFERENCES "user"(id),
        is_approved BOOLEAN DEFAULT FALSE,
        approved_by UUID REFERENCES "user"(id),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_blacklist_candidate_id ON blacklist (candidate_id);

    -- ── employee ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS employee (
        id UUID PRIMARY KEY,
        candidate_id UUID NOT NULL REFERENCES candidate(id),
        application_id UUID UNIQUE REFERENCES application(id),
        employee_nip VARCHAR(100) UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        birth_date DATE,
        birth_place VARCHAR(255),
        gender VARCHAR(20),
        blood_type VARCHAR(5),
        marital_status VARCHAR(50),
        personal_email VARCHAR(255),
        office_email VARCHAR(255),
        phone_number VARCHAR(50),
        identity_no VARCHAR(20),
        placement VARCHAR(255),
        role_level VARCHAR(255),
        employee_status employee_status_enum DEFAULT 'aktif',
        leave_status leave_status_enum DEFAULT 'belum',
        resign_date DATE,
        resign_reason VARCHAR(500),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_employee_candidate_id ON employee (candidate_id);

    -- Add FK dari blacklist ke employee setelah tabel employee ada
    DO $$ BEGIN
        ALTER TABLE blacklist ADD CONSTRAINT blacklist_employee_id_fkey
            FOREIGN KEY (employee_id) REFERENCES employee(id);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- ── employee_contract ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS employee_contract (
        id UUID PRIMARY KEY,
        employee_id UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
        agreement_type_id UUID REFERENCES agreement_type(id),
        contract_number VARCHAR(100),
        duration_months INTEGER,
        join_date DATE,
        end_date DATE,
        status contract_status_enum DEFAULT 'aktif',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_employee_contract_employee_id ON employee_contract (employee_id);

    -- ── employee_payroll ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS employee_payroll (
        id UUID PRIMARY KEY,
        employee_id UUID NOT NULL UNIQUE REFERENCES employee(id) ON DELETE CASCADE,
        thp NUMERIC(15,2),
        allowance_used TEXT,
        payroll_bank VARCHAR(100),
        bank_account_number VARCHAR(100),
        bpjs_tk_status VARCHAR(50),
        bpjs_tk_number VARCHAR(100),
        bpjs_kesehatan_status VARCHAR(50),
        bpjs_kesehatan_number VARCHAR(100),
        npwp_number VARCHAR(50),
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- ── employee_document ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS employee_document (
        id UUID PRIMARY KEY,
        employee_id UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
        doc_type VARCHAR(100) NOT NULL,
        file_url VARCHAR(500),
        drive_item_id VARCHAR(500),
        is_verified BOOLEAN DEFAULT FALSE,
        is_deleted BOOLEAN DEFAULT FALSE,
        uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_employee_document_employee_id ON employee_document (employee_id);

    -- ── employee_leaves ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS employee_leaves (
        id UUID PRIMARY KEY,
        employee_id UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_employee_leaves_employee_id ON employee_leaves (employee_id);

    -- ── notification ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS notification (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(500),
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_notification_user_id ON notification (user_id);

    -- ── openai_usage_log ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS openai_usage_log (
        id UUID PRIMARY KEY,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        model VARCHAR(100) NOT NULL,
        user_id UUID,
        call_type VARCHAR(50) NOT NULL DEFAULT 'nl_search',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_openai_usage_log_user_id ON openai_usage_log (user_id);
    CREATE INDEX IF NOT EXISTS ix_openai_usage_log_created_at ON openai_usage_log (created_at);
    """)


def downgrade() -> None:
    op.execute("""
    DROP TABLE IF EXISTS openai_usage_log CASCADE;
    DROP TABLE IF EXISTS notification CASCADE;
    DROP TABLE IF EXISTS employee_leaves CASCADE;
    DROP TABLE IF EXISTS employee_document CASCADE;
    DROP TABLE IF EXISTS employee_payroll CASCADE;
    DROP TABLE IF EXISTS employee_contract CASCADE;
    DROP TABLE IF EXISTS employee CASCADE;
    DROP TABLE IF EXISTS blacklist CASCADE;
    DROP TABLE IF EXISTS generated_cv CASCADE;
    DROP TABLE IF EXISTS ai_screening_result CASCADE;
    DROP TABLE IF EXISTS stage_history CASCADE;
    DROP TABLE IF EXISTS application CASCADE;
    DROP TABLE IF EXISTS candidate_project CASCADE;
    DROP TABLE IF EXISTS candidate_document CASCADE;
    DROP TABLE IF EXISTS candidate_experience CASCADE;
    DROP TABLE IF EXISTS candidate_education CASCADE;
    DROP TABLE IF EXISTS candidate CASCADE;
    DROP TABLE IF EXISTS position CASCADE;
    DROP TABLE IF EXISTS agreement_type CASCADE;
    DROP TABLE IF EXISTS blacklist_status_type CASCADE;
    DROP TABLE IF EXISTS source_channel CASCADE;
    DROP TABLE IF EXISTS client CASCADE;
    DROP TABLE IF EXISTS refresh_token CASCADE;
    DROP TABLE IF EXISTS "user" CASCADE;
    DROP TYPE IF EXISTS pool_status_enum;
    DROP TYPE IF EXISTS contract_status_enum;
    DROP TYPE IF EXISTS leave_status_enum;
    DROP TYPE IF EXISTS employee_status_enum;
    DROP TYPE IF EXISTS application_status_enum;
    DROP TYPE IF EXISTS contact_status_enum;
    DROP TYPE IF EXISTS completeness_status_enum;
    DROP TYPE IF EXISTS user_role_enum;
    """)
