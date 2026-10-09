"""widen_pic_contact_to_500

Revision ID: t1u2v3w4x5y6
Revises: i1j2k3l4m5n6
Create Date: 2025-01-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 't1u2v3w4x5y6'
down_revision = 'i1j2k3l4m5n6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        'client',
        'pic_contact',
        existing_type=sa.String(100),
        type_=sa.String(500),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        'client',
        'pic_contact',
        existing_type=sa.String(500),
        type_=sa.String(100),
        existing_nullable=True,
    )
