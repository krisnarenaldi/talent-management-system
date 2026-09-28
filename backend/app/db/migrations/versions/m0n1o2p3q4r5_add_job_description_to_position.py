"""add_job_description_to_position

Revision ID: m0n1o2p3q4r5
Revises: l9m0n1o2p3q4
Create Date: 2026-09-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "m0n1o2p3q4r5"
down_revision = "l9m0n1o2p3q4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_name = 'position' AND column_name = 'job_description'"
        )
    )
    if result.scalar() == 0:
        op.add_column("position", sa.Column("job_description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("position", "job_description")
