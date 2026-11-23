"""add is_talent_pool_upload to ai_screening_result

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-11-12 14:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "g7h8i9j0k1l2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    ALTER TABLE ai_screening_result
        ADD COLUMN IF NOT EXISTS is_talent_pool_upload BOOLEAN NOT NULL DEFAULT FALSE;
    """)


def downgrade() -> None:
    op.drop_column("ai_screening_result", "is_talent_pool_upload")
