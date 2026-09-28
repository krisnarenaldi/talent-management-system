"""add_candidate_project_table

Revision ID: l9m0n1o2p3q4
Revises: k8l9m0n1o2p3
Create Date: 2026-09-22 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# revision identifiers
revision: str = "l9m0n1o2p3q4"
down_revision: Union[str, None] = "k8l9m0n1o2p3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "candidate_project",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "candidate_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("candidate.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("project_name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(255), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("impact", sa.Text(), nullable=True),
        sa.Column("tech_stack", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("duration", sa.String(100), nullable=True),
        sa.Column("is_draft", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_candidate_project_candidate_id",
        "candidate_project",
        ["candidate_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_candidate_project_candidate_id", table_name="candidate_project")
    op.drop_table("candidate_project")
