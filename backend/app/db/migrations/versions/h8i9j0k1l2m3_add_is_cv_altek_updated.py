"""add is_cv_altek_updated to candidate

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-11-13 10:50:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "h8i9j0k1l2m3"
down_revision = "g7h8i9j0k1l2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    ALTER TABLE candidate
        ADD COLUMN IF NOT EXISTS is_cv_altek_updated BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS cv_altek_updated_at TIMESTAMPTZ;
    """)


def downgrade() -> None:
    op.drop_column("candidate", "cv_altek_updated_at")
    op.drop_column("candidate", "is_cv_altek_updated")
