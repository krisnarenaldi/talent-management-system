"""merge heads

Revision ID: d0d2ce95d403
Revises: b1c2d3e4f5a6, d1e2f3a4b5c6
Create Date: 2026-10-28 17:06:27.997631

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd0d2ce95d403'
down_revision: Union[str, None] = ('b1c2d3e4f5a6', 'd1e2f3a4b5c6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
