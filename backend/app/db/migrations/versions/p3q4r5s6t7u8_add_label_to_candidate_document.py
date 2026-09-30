"""add label to candidate_document

Revision ID: p3q4r5s6t7u8
Revises: o2p3q4r5s6t7
Create Date: 2026-09-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "p3q4r5s6t7u8"
down_revision: Union[str, None] = "o2p3q4r5s6t7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "candidate_document",
        sa.Column("label", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("candidate_document", "label")
