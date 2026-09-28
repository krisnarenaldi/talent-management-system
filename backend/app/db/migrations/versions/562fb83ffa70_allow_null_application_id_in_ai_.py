"""allow null application_id in ai_screening_result

Revision ID: 562fb83ffa70
Revises: m0n1o2p3q4r5
Create Date: 2026-09-22 09:51:40.768483

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '562fb83ffa70'
down_revision: Union[str, None] = 'm0n1o2p3q4r5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make application_id nullable to support bulk upload before application exists
    op.alter_column('ai_screening_result', 'application_id',
                    existing_type=UUID(as_uuid=True),
                    nullable=True)


def downgrade() -> None:
    op.alter_column('ai_screening_result', 'application_id',
                    existing_type=UUID(as_uuid=True),
                    nullable=False)
