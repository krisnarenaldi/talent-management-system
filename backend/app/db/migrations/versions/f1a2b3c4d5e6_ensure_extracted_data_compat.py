"""Ensure the legacy extracted_data column exists for existing databases.

Revision ID: f1a2b3c4d5e6
Revises: 0000baseline0001
"""
from typing import Sequence, Union

from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "0000baseline0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE ai_screening_result "
        "ADD COLUMN IF NOT EXISTS extracted_data TEXT"
    )


def downgrade() -> None:
    op.drop_column("ai_screening_result", "extracted_data")
