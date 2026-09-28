"""fix_missing_created_at_ai_screening_result

Revision ID: k8l9m0n1o2p3
Revises: j7k8l9m0n1o2
Create Date: 2026-09-21 00:00:00.000000

The `created_at` column was supposed to be added by migration e2f3a4b5c6d7
but was absent from the live database (migration drift). This migration adds
the column if it does not already exist, making the schema match the ORM model.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "k8l9m0n1o2p3"
down_revision: Union[str, None] = "j7k8l9m0n1o2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use a no-op if the column already exists (handles environments where
    # e2f3a4b5c6d7 ran correctly and the column is present).
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='ai_screening_result' AND column_name='created_at'"
        )
    )
    if result.fetchone() is None:
        op.add_column(
            "ai_screening_result",
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=True,
            ),
        )


def downgrade() -> None:
    op.drop_column("ai_screening_result", "created_at")
