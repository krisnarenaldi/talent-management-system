"""add_ai_screening_v2_and_notification

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-09-14 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- ai_screening_result: restructure for batch CV upload flow ---
    # 1. Drop unique constraint on application_id so it can be nullable
    op.drop_constraint('ai_screening_result_application_id_key', 'ai_screening_result', type_='unique')

    # 2. Make application_id nullable
    op.alter_column('ai_screening_result', 'application_id',
                    existing_type=UUID(as_uuid=True),
                    nullable=True)

    # 3. Rename match_score → ai_score and change type to float
    op.add_column('ai_screening_result', sa.Column('ai_score', sa.Float(), nullable=True))
    op.execute("UPDATE ai_screening_result SET ai_score = match_score::float WHERE match_score IS NOT NULL")
    op.drop_column('ai_screening_result', 'match_score')

    # 4. Rename extracted_data (TEXT) → extracted_json (JSONB)
    op.add_column('ai_screening_result', sa.Column('extracted_json_new', JSONB(), nullable=True))
    op.execute("UPDATE ai_screening_result SET extracted_json_new = extracted_data::jsonb WHERE extracted_data IS NOT NULL")
    op.drop_column('ai_screening_result', 'extracted_data')
    op.alter_column('ai_screening_result', 'extracted_json_new', new_column_name='extracted_json')

    # 5. Drop old columns no longer needed
    op.drop_column('ai_screening_result', 'model_used')
    op.drop_column('ai_screening_result', 'scored_at')

    # 6. Rename review_status → status and repurpose enum values
    op.add_column('ai_screening_result', sa.Column('status_new', sa.String(50), nullable=True))
    op.execute("""
        UPDATE ai_screening_result SET status_new =
            CASE review_status
                WHEN 'pending' THEN 'menunggu_screening_ai'
                WHEN 'reviewed' THEN 'sudah_direview'
                ELSE 'menunggu_screening_ai'
            END
    """)
    op.drop_column('ai_screening_result', 'review_status')
    op.alter_column('ai_screening_result', 'status_new', new_column_name='status')

    # 7. Add new columns
    op.add_column('ai_screening_result', sa.Column('candidate_id', UUID(as_uuid=True), nullable=True))
    op.add_column('ai_screening_result', sa.Column('position_id', UUID(as_uuid=True), nullable=True))
    op.add_column('ai_screening_result', sa.Column('uploaded_by', UUID(as_uuid=True), nullable=True))
    op.add_column('ai_screening_result', sa.Column('cv_file_url', sa.String(length=2048), nullable=True))
    op.add_column('ai_screening_result', sa.Column('cv_drive_item_id', sa.String(length=500), nullable=True))
    op.add_column('ai_screening_result', sa.Column('reviewed_by', UUID(as_uuid=True), nullable=True))
    op.add_column('ai_screening_result', sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('ai_screening_result', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True))
    op.add_column('ai_screening_result', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True))

    # 8. Add foreign keys for new columns
    op.create_foreign_key(None, 'ai_screening_result', 'candidate', ['candidate_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'ai_screening_result', 'position', ['position_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'ai_screening_result', 'user', ['uploaded_by'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'ai_screening_result', 'user', ['reviewed_by'], ['id'], ondelete='SET NULL')

    # 9. Add indexes
    op.create_index(op.f('ix_ai_screening_result_status'), 'ai_screening_result', ['status'], unique=False)
    op.create_index(op.f('ix_ai_screening_result_position_id'), 'ai_screening_result', ['position_id'], unique=False)
    op.create_index(op.f('ix_ai_screening_result_uploaded_by'), 'ai_screening_result', ['uploaded_by'], unique=False)
    op.create_index(op.f('ix_ai_screening_result_candidate_id'), 'ai_screening_result', ['candidate_id'], unique=False)

    # --- notification table ---
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
    op.create_index(op.f('ix_notification_user_id'), 'notification', ['user_id'], unique=False)
    op.create_index(op.f('ix_notification_is_read'), 'notification', ['is_read'], unique=False)

    # --- position: add ai_scoring_config ---
    op.add_column('position', sa.Column('ai_scoring_config', JSONB(), nullable=True))


def downgrade() -> None:
    # --- position: remove ai_scoring_config ---
    op.drop_column('position', 'ai_scoring_config')

    # --- notification table ---
    op.drop_index(op.f('ix_notification_is_read'), table_name='notification')
    op.drop_index(op.f('ix_notification_user_id'), table_name='notification')
    op.drop_table('notification')

    # --- ai_screening_result: reverse restructuring ---
    op.drop_index(op.f('ix_ai_screening_result_candidate_id'), table_name='ai_screening_result')
    op.drop_index(op.f('ix_ai_screening_result_uploaded_by'), table_name='ai_screening_result')
    op.drop_index(op.f('ix_ai_screening_result_position_id'), table_name='ai_screening_result')
    op.drop_index(op.f('ix_ai_screening_result_status'), table_name='ai_screening_result')

    op.drop_constraint(None, 'ai_screening_result', type_='foreignkey')
    op.drop_constraint(None, 'ai_screening_result', type_='foreignkey')
    op.drop_constraint(None, 'ai_screening_result', type_='foreignkey')
    op.drop_constraint(None, 'ai_screening_result', type_='foreignkey')

    op.drop_column('ai_screening_result', 'created_at')
    op.drop_column('ai_screening_result', 'updated_at')
    op.drop_column('ai_screening_result', 'reviewed_at')
    op.drop_column('ai_screening_result', 'reviewed_by')
    op.drop_column('ai_screening_result', 'cv_drive_item_id')
    op.drop_column('ai_screening_result', 'cv_file_url')
    op.drop_column('ai_screening_result', 'uploaded_by')
    op.drop_column('ai_screening_result', 'position_id')
    op.drop_column('ai_screening_result', 'candidate_id')

    # Restore review_status from status
    op.add_column('ai_screening_result', sa.Column('review_status_old', sa.String(50), nullable=True))
    op.execute("""
        UPDATE ai_screening_result SET review_status_old =
            CASE status
                WHEN 'menunggu_screening_ai' THEN 'pending'
                WHEN 'sudah_direview' THEN 'reviewed'
                ELSE 'pending'
            END
    """)
    op.drop_column('ai_screening_result', 'status')
    op.alter_column('ai_screening_result', 'review_status_old', new_column_name='review_status')

    # Restore extracted_data from extracted_json
    op.add_column('ai_screening_result', sa.Column('extracted_data_old', sa.Text(), nullable=True))
    op.execute("UPDATE ai_screening_result SET extracted_data_old = extracted_json::text WHERE extracted_json IS NOT NULL")
    op.drop_column('ai_screening_result', 'extracted_json')
    op.alter_column('ai_screening_result', 'extracted_data_old', new_column_name='extracted_data')

    # Restore model_used placeholder (NULL)
    op.add_column('ai_screening_result', sa.Column('model_used', sa.String(100), nullable=True))

    # Restore match_score from ai_score
    op.add_column('ai_screening_result', sa.Column('match_score', sa.Numeric(precision=5, scale=2), nullable=True))
    op.execute("UPDATE ai_screening_result SET match_score = ai_score::numeric WHERE ai_score IS NOT NULL")
    op.drop_column('ai_screening_result', 'ai_score')

    # Restore scored_at placeholder (NULL)
    op.add_column('ai_screening_result', sa.Column('scored_at', sa.DateTime(timezone=True), nullable=True))

    # Restore unique constraint on application_id
    op.alter_column('ai_screening_result', 'application_id', nullable=False)
    op.create_unique_constraint('ai_screening_result_application_id_key', 'ai_screening_result', ['application_id'])
