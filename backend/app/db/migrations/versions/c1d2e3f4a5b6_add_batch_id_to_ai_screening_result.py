"""Add batch_id to ai_screening_result for accurate per-batch notification counting.

Revision ID: c1d2e3f4a5b6
Revises: b3c4d5e6f7a8
Create Date: 2026-10-23 07:03:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tambah kolom batch_id (UUID, nullable, indexed) secara idempotent.
    op.execute(
        "ALTER TABLE ai_screening_result "
        "ADD COLUMN IF NOT EXISTS batch_id UUID"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ai_screening_result_batch_id "
        "ON ai_screening_result (batch_id)"
    )


def downgrade() -> None:
    op.execute(
        "DROP INDEX IF EXISTS ix_ai_screening_result_batch_id"
    )
    op.execute(
        "ALTER TABLE ai_screening_result DROP COLUMN IF EXISTS batch_id"
    )
