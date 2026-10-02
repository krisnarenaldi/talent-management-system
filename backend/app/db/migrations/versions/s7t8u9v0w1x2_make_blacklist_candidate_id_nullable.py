"""make_blacklist_candidate_id_nullable

Revision ID: s7t8u9v0w1x2
Revises: r6s7t8u9v0w1
Create Date: 2026-10-02 08:00:00.000000

Blacklist table was originally created with candidate_id NOT NULL.
Migration a1b2c3d4e5f6 added employee_id to support employee blacklisting,
but forgot to drop the NOT NULL constraint on candidate_id.
This migration fixes that so employee-only blacklist entries (without a
candidate_id) can be saved successfully.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 's7t8u9v0w1x2'
down_revision: Union[str, None] = 'r6s7t8u9v0w1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop NOT NULL constraint on candidate_id so employee-only blacklist
    # entries (where candidate_id is NULL) can be inserted.
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'blacklist'
                  AND column_name = 'candidate_id'
                  AND is_nullable = 'NO'
            ) THEN
                ALTER TABLE blacklist ALTER COLUMN candidate_id DROP NOT NULL;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # Re-apply NOT NULL — only safe if no rows have candidate_id = NULL.
    op.execute("""
        ALTER TABLE blacklist ALTER COLUMN candidate_id SET NOT NULL;
    """)
