"""add_generated_cv_and_cascade_triggers

Revision ID: j7k8l9m0n1o2
Revises: i6j7k8l9m0n1
Create Date: 2026-09-20 00:00:00.000000

Perubahan:
  1. Buat tabel `generated_cv` (jika belum ada)
  2. Tambah fungsi & trigger cascade: setiap INSERT/UPDATE/DELETE di
     `candidate_experience` atau `candidate_education` otomatis update
     `candidate.updated_at` → dipakai untuk staleness-check generated CV.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision: str = "j7k8l9m0n1o2"
down_revision: Union[str, None] = "i6j7k8l9m0n1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------------------------
# Trigger SQL — dipisah sebagai konstanta agar mudah dibaca/diuji
# ---------------------------------------------------------------------------

_CREATE_TRIGGER_FUNC = """
CREATE OR REPLACE FUNCTION public.trg_cascade_candidate_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_candidate_id UUID;
BEGIN
    -- Dukung DELETE (pakai OLD) dan INSERT/UPDATE (pakai NEW)
    IF TG_OP = 'DELETE' THEN
        v_candidate_id := OLD.candidate_id;
    ELSE
        v_candidate_id := NEW.candidate_id;
    END IF;

    UPDATE public.candidate
       SET updated_at = CURRENT_TIMESTAMP
     WHERE id = v_candidate_id;

    -- Untuk DELETE trigger harus kembalikan OLD agar tidak error
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;
"""

_DROP_TRIGGER_FUNC = "DROP FUNCTION IF EXISTS public.trg_cascade_candidate_updated_at() CASCADE;"

_CREATE_EXPERIENCE_TRIGGER = """
CREATE TRIGGER tg_experience_cascade_candidate
    AFTER INSERT OR UPDATE OR DELETE ON public.candidate_experience
    FOR EACH ROW EXECUTE FUNCTION public.trg_cascade_candidate_updated_at();
"""

_CREATE_EDUCATION_TRIGGER = """
CREATE TRIGGER tg_education_cascade_candidate
    AFTER INSERT OR UPDATE OR DELETE ON public.candidate_education
    FOR EACH ROW EXECUTE FUNCTION public.trg_cascade_candidate_updated_at();
"""

_DROP_EXPERIENCE_TRIGGER = (
    "DROP TRIGGER IF EXISTS tg_experience_cascade_candidate ON public.candidate_experience;"
)
_DROP_EDUCATION_TRIGGER = (
    "DROP TRIGGER IF EXISTS tg_education_cascade_candidate ON public.candidate_education;"
)


# ---------------------------------------------------------------------------
def upgrade() -> None:
    # 1. Buat tabel generated_cv
    op.create_table(
        "generated_cv",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "candidate_id",
            UUID(as_uuid=True),
            sa.ForeignKey("candidate.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "application_id",
            UUID(as_uuid=True),
            sa.ForeignKey("application.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("template_used", sa.String(255), nullable=True),
        sa.Column("language", sa.String(10), server_default="ID", nullable=True),
        sa.Column("summary_source", sa.String(20), nullable=True),   # "AI" | "HR"
        sa.Column("summary_text", sa.Text, nullable=True),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column("drive_item_id", sa.String(500), nullable=True),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        schema="public",
    )

    # Indexes
    op.create_index(
        "idx_generated_cv_candidate_id",
        "generated_cv",
        ["candidate_id"],
        schema="public",
    )
    op.create_index(
        "idx_generated_cv_application_id",
        "generated_cv",
        ["application_id"],
        schema="public",
    )

    # 2. Buat fungsi trigger cascade
    op.execute(_CREATE_TRIGGER_FUNC)

    # 3. Pasang trigger ke candidate_experience
    op.execute(_CREATE_EXPERIENCE_TRIGGER)

    # 4. Pasang trigger ke candidate_education
    op.execute(_CREATE_EDUCATION_TRIGGER)


def downgrade() -> None:
    # Hapus triggers terlebih dahulu sebelum fungsinya
    op.execute(_DROP_EXPERIENCE_TRIGGER)
    op.execute(_DROP_EDUCATION_TRIGGER)
    op.execute(_DROP_TRIGGER_FUNC)

    # Hapus indexes
    op.drop_index("idx_generated_cv_application_id", table_name="generated_cv", schema="public")
    op.drop_index("idx_generated_cv_candidate_id", table_name="generated_cv", schema="public")

    # Hapus tabel
    op.drop_table("generated_cv", schema="public")
