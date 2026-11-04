"""Add reject_reason to application + composite index (position_id, status).

Menyimpan alasan bulk-reject saat client/position dinon-aktifkan, serta
menambah index komposit (position_id, status) untuk mempercepat query
lamaran aktif per posisi (dipakai alur bulk-reject).

Revision ID: e5f6a7b8c9d0
Revises: d0d2ce95d403
Create Date: 2026-10-28 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d0d2ce95d403"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Kolom reject_reason — idempotent.
    op.execute(
        "ALTER TABLE application "
        "ADD COLUMN IF NOT EXISTS reject_reason VARCHAR(255)"
    )
    op.execute(
        "COMMENT ON COLUMN application.reject_reason IS "
        "'Alasan bulk-reject ketika client/position dinon-aktifkan'"
    )

    # Index komposit (position_id, status). Nama berbeda dari ix_application_position_id
    # sehingga tidak bentrok; IF NOT EXISTS menjaga idempotency.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_application_position_status "
        "ON application (position_id, status)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_application_position_status")
    op.execute("ALTER TABLE application DROP COLUMN IF EXISTS reject_reason")
