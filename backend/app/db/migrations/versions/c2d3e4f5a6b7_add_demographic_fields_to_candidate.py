"""add_demographic_fields_to_candidate

Revision ID: c2d3e4f5a6b7
Revises: 991ffcde4ae2
Create Date: 2026-09-11 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = '991ffcde4ae2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('candidate', sa.Column('birth_date', sa.Date(), nullable=True))
    op.add_column('candidate', sa.Column('birth_place', sa.String(length=255), nullable=True))
    op.add_column('candidate', sa.Column('gender', sa.String(length=20), nullable=True))
    op.add_column('candidate', sa.Column('blood_type', sa.String(length=5), nullable=True))


def downgrade() -> None:
    op.drop_column('candidate', 'blood_type')
    op.drop_column('candidate', 'gender')
    op.drop_column('candidate', 'birth_place')
    op.drop_column('candidate', 'birth_date')
