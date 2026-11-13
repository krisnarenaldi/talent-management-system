"""add is_cv_altek_updated to candidate

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-11-13 10:50:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "h8i9j0k1l2m3"
down_revision = "g7h8i9j0k1l2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "candidate",
        sa.Column(
            "is_cv_altek_updated",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "candidate",
        sa.Column(
            "cv_altek_updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("candidate", "cv_altek_updated_at")
    op.drop_column("candidate", "is_cv_altek_updated")
