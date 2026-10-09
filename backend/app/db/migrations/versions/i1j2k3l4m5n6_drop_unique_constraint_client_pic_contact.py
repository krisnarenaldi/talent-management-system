"""drop_unique_constraint_client_pic_contact

Revision ID: i1j2k3l4m5n6
Revises: s7t8u9v0w1x2
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'i1j2k3l4m5n6'
down_revision = 's7t8u9v0w1x2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint('uq_client_pic_contact', 'client', type_='unique')


def downgrade() -> None:
    op.create_unique_constraint('uq_client_pic_contact', 'client', ['pic_contact'])
