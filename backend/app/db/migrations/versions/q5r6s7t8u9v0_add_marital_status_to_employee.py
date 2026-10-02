"""add_marital_status_to_employee

Revision ID: q5r6s7t8u9v0
Revises: p3q4r5s6t7u8
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'q5r6s7t8u9v0'
down_revision = 'p3q4r5s6t7u8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('employee', sa.Column('marital_status', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('employee', 'marital_status')
