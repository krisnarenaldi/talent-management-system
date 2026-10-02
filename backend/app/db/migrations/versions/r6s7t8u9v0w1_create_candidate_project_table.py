"""create_candidate_project_table

Hotfix: candidate_project table was missing columns in production because the
original migration (k8l9m0n1o2p3) created the table without all columns.
This migration handles both cases:
  - Table missing entirely → create it in full.
  - Table exists but missing columns → add only what's absent.

Revision ID: r6s7t8u9v0w1
Revises: q5r6s7t8u9v0
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "r6s7t8u9v0w1"
down_revision: Union[str, None] = "q5r6s7t8u9v0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# All columns that must exist on candidate_project, in addition to the
# mandatory ones (id, candidate_id, project_name) that were present from day 1.
_OPTIONAL_COLUMNS = {
    "role":         sa.Column("role", sa.String(255), nullable=True),
    "summary":      sa.Column("summary", sa.Text(), nullable=True),
    "impact":       sa.Column("impact", sa.Text(), nullable=True),
    "tech_stack":   sa.Column("tech_stack", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    "duration":     sa.Column("duration", sa.String(100), nullable=True),
    "is_draft":     sa.Column("is_draft", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    "created_at":   sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
    "updated_at":   sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "candidate_project" not in inspector.get_table_names():
        # Table is completely absent — create it from scratch.
        op.create_table(
            "candidate_project",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column(
                "candidate_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("candidate.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("project_name", sa.String(255), nullable=False),
            *[col.copy() for col in _OPTIONAL_COLUMNS.values()],
        )
        op.create_index(
            "ix_candidate_project_candidate_id",
            "candidate_project",
            ["candidate_id"],
        )
    else:
        # Table exists — add any column that is missing.
        existing = {c["name"] for c in inspector.get_columns("candidate_project")}
        for col_name, col_def in _OPTIONAL_COLUMNS.items():
            if col_name not in existing:
                op.add_column("candidate_project", col_def.copy())

        # Ensure the index exists too.
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("candidate_project")}
        if "ix_candidate_project_candidate_id" not in existing_indexes:
            op.create_index(
                "ix_candidate_project_candidate_id",
                "candidate_project",
                ["candidate_id"],
            )


def downgrade() -> None:
    op.drop_index("ix_candidate_project_candidate_id", table_name="candidate_project")
    op.drop_table("candidate_project")
