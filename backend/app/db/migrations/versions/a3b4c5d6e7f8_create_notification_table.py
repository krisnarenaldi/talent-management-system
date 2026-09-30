"""create_notification_table

Revision ID: a3b4c5d6e7f8
Revises: n1o2p3q4r5s6
Create Date: 2026-09-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'n1o2p3q4r5s6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'notification' not in inspector.get_table_names():
        op.create_table(
            'notification',
            sa.Column('id', UUID(as_uuid=True), primary_key=True, default=sa.func.uuid_generate_v4()),
            sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
            sa.Column('type', sa.String(length=100), nullable=False),
            sa.Column('message', sa.Text(), nullable=False),
            sa.Column('link', sa.String(length=500), nullable=True),
            sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        )

    existing_indexes = [idx['name'] for idx in inspector.get_indexes('notification')]
    if 'ix_notification_user_id' not in existing_indexes:
        op.create_index(op.f('ix_notification_user_id'), 'notification', ['user_id'], unique=False)
    if 'ix_notification_is_read' not in existing_indexes:
        op.create_index(op.f('ix_notification_is_read'), 'notification', ['is_read'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_notification_is_read'), table_name='notification')
    op.drop_index(op.f('ix_notification_user_id'), table_name='notification')
    op.drop_table('notification')