"""add_marital_status_to_employee

Revision ID: q5r6s7t8u9v0
Revises: p3q4r5s6t7u8
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'q5r6s7t8u9v0'
down_revision = 'p3q4r5s6t7u8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'employee' AND column_name = 'marital_status'
            ) THEN
                ALTER TABLE employee ADD COLUMN marital_status VARCHAR(50);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.drop_column('employee', 'marital_status')
