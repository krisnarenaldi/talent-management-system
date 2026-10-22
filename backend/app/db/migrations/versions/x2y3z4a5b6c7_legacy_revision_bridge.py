"""Compatibility bridge for databases already stamped at this legacy revision.

Revision ID: x2y3z4a5b6c7
Revises:
"""
from typing import Sequence, Union

from alembic import op

revision: str = "x2y3z4a5b6c7"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # This revision was already applied in databases that recorded its ID.
    pass


def downgrade() -> None:
    pass
