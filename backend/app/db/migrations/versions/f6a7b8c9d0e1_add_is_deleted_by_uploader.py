"""Add is_deleted_by_uploader to ai_screening_result for HR soft delete.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-11-11 20:45:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE ai_screening_result "
        "ADD COLUMN IF NOT EXISTS is_deleted_by_uploader BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ai_screening_result_is_deleted_by_uploader "
        "ON ai_screening_result (is_deleted_by_uploader)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_ai_screening_result_is_deleted_by_uploader")
    op.execute("ALTER TABLE ai_screening_result DROP COLUMN IF EXISTS is_deleted_by_uploader")
