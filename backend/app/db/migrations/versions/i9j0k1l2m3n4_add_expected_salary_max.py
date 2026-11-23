"""add expected_salary_max to candidate and stage_history

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-11-23 08:45:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "i9j0k1l2m3n4"
down_revision = "h8i9j0k1l2m3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "candidate",
        sa.Column(
            "expected_salary_max",
            sa.Numeric(15, 2),
            nullable=True,
        ),
    )
    op.add_column(
        "stage_history",
        sa.Column(
            "salary_expected_max_input",
            sa.Numeric(15, 2),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("stage_history", "salary_expected_max_input")
    op.drop_column("candidate", "expected_salary_max")
