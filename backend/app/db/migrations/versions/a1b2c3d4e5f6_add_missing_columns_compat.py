"""Add missing columns that predate the baseline for live databases.

Idempotent: uses ADD COLUMN IF NOT EXISTS so it is safe to re-run
on databases that were already migrated via baseline.

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    -- ── application: kolom PIC user dari sisi client ─────────────────────────
    ALTER TABLE application
        ADD COLUMN IF NOT EXISTS client_user_id  UUID REFERENCES "user"(id),
        ADD COLUMN IF NOT EXISTS client_user_name VARCHAR(255);

    -- ── client: kolom pics (daftar PIC terstruktur) ───────────────────────────
    ALTER TABLE client
        ADD COLUMN IF NOT EXISTS pics JSONB DEFAULT '[]'::jsonb;

    -- ── candidate: kolom pool/talent-pool ─────────────────────────────────────
    DO $$ BEGIN CREATE TYPE pool_status_enum AS ENUM ('database', 'talent_pool', 'future_lead');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE candidate
        ADD COLUMN IF NOT EXISTS pool_status pool_status_enum NOT NULL DEFAULT 'database',
        ADD COLUMN IF NOT EXISTS talent_pool_reason  VARCHAR(100),
        ADD COLUMN IF NOT EXISTS talent_pool_notes   TEXT,
        ADD COLUMN IF NOT EXISTS talent_pool_updated_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS talent_pool_updated_by UUID REFERENCES "user"(id);

    -- ── position: ai_scoring_config ───────────────────────────────────────────
    ALTER TABLE position
        ADD COLUMN IF NOT EXISTS ai_scoring_config JSONB;

    -- ── position: client_user_names ───────────────────────────────────────────
    ALTER TABLE position
        ADD COLUMN IF NOT EXISTS client_user_names JSONB DEFAULT '[]'::jsonb;

    -- ── candidate: skills ─────────────────────────────────────────────────────
    ALTER TABLE candidate
        ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;

    -- ── ai_screening_result: extracted_json ───────────────────────────────────
    ALTER TABLE ai_screening_result
        ADD COLUMN IF NOT EXISTS extracted_json JSONB,
        ADD COLUMN IF NOT EXISTS cv_drive_item_id VARCHAR(500),
        ADD COLUMN IF NOT EXISTS source_channel   VARCHAR(100),
        ADD COLUMN IF NOT EXISTS reviewed_by      UUID REFERENCES "user"(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMPTZ;

    -- ── candidate_document: drive_item_id ─────────────────────────────────────
    ALTER TABLE candidate_document
        ADD COLUMN IF NOT EXISTS drive_item_id VARCHAR(500),
        ADD COLUMN IF NOT EXISTS label         VARCHAR(255);

    -- ── candidate_project ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS candidate_project (
        id UUID PRIMARY KEY,
        candidate_id UUID NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
        project_name VARCHAR(255) NOT NULL,
        role         VARCHAR(255),
        summary      TEXT,
        impact       TEXT,
        tech_stack   JSONB DEFAULT '[]'::jsonb,
        duration     VARCHAR(100),
        is_draft     BOOLEAN NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_candidate_project_candidate_id ON candidate_project (candidate_id);

    -- ── employee_document: drive_item_id ──────────────────────────────────────
    ALTER TABLE employee_document
        ADD COLUMN IF NOT EXISTS drive_item_id VARCHAR(500);

    -- ── openai_usage_log ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS openai_usage_log (
        id                UUID PRIMARY KEY,
        prompt_tokens     INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        model             VARCHAR(100) NOT NULL,
        user_id           UUID,
        call_type         VARCHAR(50) NOT NULL DEFAULT 'nl_search',
        created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_openai_usage_log_user_id    ON openai_usage_log (user_id);
    CREATE INDEX IF NOT EXISTS ix_openai_usage_log_created_at ON openai_usage_log (created_at);
    """)


def downgrade() -> None:
    # Tidak di-rollback secara otomatis — kolom-kolom ini bersifat additive.
    pass
