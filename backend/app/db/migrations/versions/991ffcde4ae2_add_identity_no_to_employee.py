"""add_identity_no_to_employee

Revision ID: 991ffcde4ae2
Revises: a1b2c3d4e5f6
Create Date: 2026-09-11 13:03:16.590134

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '991ffcde4ae2'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('employee', sa.Column('identity_no', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('employee', 'identity_no')
