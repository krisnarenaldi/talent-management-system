"""add_employee_id_to_blacklist_and_pm_role

Revision ID: a1b2c3d4e5f6
Revises: 8c889f49d99d
Create Date: 2026-09-10 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '8c889f49d99d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add employee_id column to blacklist table (idempotent)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'blacklist' AND column_name = 'employee_id'
            ) THEN
                ALTER TABLE blacklist ADD COLUMN employee_id UUID;
            END IF;
        END $$;
    """)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE tablename = 'blacklist' AND indexname = 'ix_blacklist_employee_id'
            ) THEN
                CREATE INDEX ix_blacklist_employee_id ON blacklist (employee_id);
            END IF;
        END $$;
    """)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'blacklist_employee_id_fkey'
                AND table_name = 'blacklist'
            ) THEN
                ALTER TABLE blacklist ADD CONSTRAINT blacklist_employee_id_fkey
                    FOREIGN KEY (employee_id) REFERENCES employee(id);
            END IF;
        END $$;
    """)

    # Add 'pm' to user_role_enum (idempotent)
    op.execute("ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'pm'")


def downgrade() -> None:
    # Cannot drop values from PostgreSQL enum, so only drop the column
    op.drop_constraint('blacklist_employee_id_fkey', 'blacklist', type_='foreignkey')
    op.drop_index(op.f('ix_blacklist_employee_id'), table_name='blacklist')
    op.drop_column('blacklist', 'employee_id')
