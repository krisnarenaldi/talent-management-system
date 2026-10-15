"""add_nonaktif_to_employee_status

Revision ID: 6bc5cc9d3ef0
Revises: u2v3w4x5y6z7
Create Date: 2026-10-15 14:15:11.742485

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6bc5cc9d3ef0'
down_revision: Union[str, None] = 'u2v3w4x5y6z7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Disable autocommit for enum modification
    op.execute("ALTER TYPE employee_status_enum ADD VALUE IF NOT EXISTS 'nonaktif'")


def downgrade() -> None:
    # PostgreSQL does not support removing values from an enum type easily.
    pass
