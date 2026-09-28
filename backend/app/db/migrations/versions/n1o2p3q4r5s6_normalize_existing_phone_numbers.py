"""Normalize existing phone numbers: remove spaces/hyphens, replace +62 with 08.

Revision ID: n1o2p3q4r5s6
Revises: m0n1o2p3q4r5
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'n1o2p3q4r5s6'
down_revision = '562fb83ffa70'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Normalize phone numbers in the candidate table:
    # 1. Remove all spaces and hyphens
    # 2. Replace leading +62 with 08
    op.execute("""
        UPDATE candidate
        SET phone = regexp_replace(
                        regexp_replace(phone, '[\\s\\-]', '', 'g'),
                        '^\\+62',
                        '0'
                    )
        WHERE phone IS NOT NULL
          AND phone ~ '[\\s\\-]|^\\+62'
    """)


def downgrade() -> None:
    # Reverting phone normalisation is not safe (original format is unknown).
    pass
