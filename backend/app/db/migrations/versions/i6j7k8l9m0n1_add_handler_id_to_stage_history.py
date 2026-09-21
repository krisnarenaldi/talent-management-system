"""add_handler_id_to_stage_history

Revision ID: i6j7k8l9m0n1
Revises: h5i6j7k8l9m0
Create Date: 2026-09-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'i6j7k8l9m0n1'
down_revision: Union[str, None] = 'h5i6j7k8l9m0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'stage_history',
        sa.Column(
            'handler_id',
            UUID(as_uuid=True),
            sa.ForeignKey('user.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index('ix_stage_history_handler_id', 'stage_history', ['handler_id'])


def downgrade() -> None:
    op.drop_index('ix_stage_history_handler_id', table_name='stage_history')
    op.drop_column('stage_history', 'handler_id')
