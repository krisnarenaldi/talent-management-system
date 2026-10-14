"""add_openai_usage_log

Revision ID: u2v3w4x5y6z7
Revises: t1u2v3w4x5y6
Create Date: 2025-01-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'u2v3w4x5y6z7'
down_revision = 't1u2v3w4x5y6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'openai_usage_log',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('prompt_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completion_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('model', sa.String(100), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=True),
        sa.Column('call_type', sa.String(50), nullable=False, server_default='nl_search'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=True,
        ),
    )
    op.create_index('ix_openai_usage_log_user_id', 'openai_usage_log', ['user_id'])
    op.create_index('ix_openai_usage_log_created_at', 'openai_usage_log', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_openai_usage_log_created_at', table_name='openai_usage_log')
    op.drop_index('ix_openai_usage_log_user_id', table_name='openai_usage_log')
    op.drop_table('openai_usage_log')
