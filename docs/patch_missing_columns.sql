-- Patch: tambah semua kolom yang ada di migration tapi belum ada di DDL lama
-- Aman dijalankan berulang karena pakai IF NOT EXISTS

-- c2d3e4f5a6b7: demographic fields on candidate
ALTER TABLE candidate ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE candidate ADD COLUMN IF NOT EXISTS birth_place VARCHAR(255);
ALTER TABLE candidate ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE candidate ADD COLUMN IF NOT EXISTS blood_type VARCHAR(5);

-- d1e2f3a4b5c6: skills JSONB on candidate
ALTER TABLE candidate ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]';

-- dde62fd93da4: soft delete on candidate
ALTER TABLE candidate ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- 8c889f49d99d: reset token on user
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS ix_user_reset_token ON "user" (reset_token);

-- 991ffcde4ae2: identity_no on employee
ALTER TABLE employee ADD COLUMN IF NOT EXISTS identity_no VARCHAR(20);

-- a1b2c3d4e5f6: employee_id on blacklist
ALTER TABLE blacklist ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employee(id) ON DELETE SET NULL;

-- a1b2c3d4e5f6: pm role in enum (safe add)
DO $$ BEGIN
    ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'pm';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- b74baf201d04: refresh_token table
CREATE TABLE IF NOT EXISTS refresh_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token VARCHAR(512) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_refresh_token_token ON refresh_token (token);
CREATE INDEX IF NOT EXISTS ix_refresh_token_user_id ON refresh_token (user_id);

-- e2f3a4b5c6d7: ai_screening_result v2 + notification (skip if already exist from DDL)
ALTER TABLE ai_screening_result ADD COLUMN IF NOT EXISTS candidate_id UUID REFERENCES candidate(id) ON DELETE SET NULL;
ALTER TABLE ai_screening_result ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES position(id) ON DELETE SET NULL;
ALTER TABLE ai_screening_result ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE ai_screening_result ADD COLUMN IF NOT EXISTS cv_file_url VARCHAR(500);
ALTER TABLE ai_screening_result ADD COLUMN IF NOT EXISTS cv_drive_item_id VARCHAR(500);
ALTER TABLE ai_screening_result ADD COLUMN IF NOT EXISTS extracted_json TEXT;
ALTER TABLE ai_screening_result ADD COLUMN IF NOT EXISTS ai_score FLOAT;
ALTER TABLE ai_screening_result ADD COLUMN IF NOT EXISTS ai_notes TEXT;
ALTER TABLE ai_screening_result ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE ai_screening_result ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE ai_screening_result ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Drop old unique constraint on application_id if exists (v2 removes it)
ALTER TABLE ai_screening_result DROP CONSTRAINT IF EXISTS ai_screening_result_application_id_key;

-- Status enum for ai_screening_result
DO $$ BEGIN
    CREATE TYPE ai_screening_status_enum AS ENUM (
        'menunggu_screening_ai','sedang_diproses','siap_review','sudah_direview','error'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE ai_screening_result ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'menunggu_screening_ai';

CREATE TABLE IF NOT EXISTS notification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(500),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_notification_user_id ON notification (user_id);

-- f3a4b5c6d7e8: source_channel master table
CREATE TABLE IF NOT EXISTS source_channel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- g4h5i6j7k8l9: source_channel_id on ai_screening_result
ALTER TABLE ai_screening_result ADD COLUMN IF NOT EXISTS source_channel_id UUID REFERENCES source_channel(id) ON DELETE SET NULL;

-- h5i6j7k8l9m0: unique constraint on client pic_contact (may already exist)
DO $$ BEGIN
    ALTER TABLE client ADD CONSTRAINT uq_client_pic_contact UNIQUE (pic_contact);
EXCEPTION WHEN duplicate_table THEN NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- i6j7k8l9m0n1: handler_id on stage_history
ALTER TABLE stage_history ADD COLUMN IF NOT EXISTS handler_id UUID REFERENCES "user"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_stage_history_handler_id ON stage_history (handler_id);

-- position: ai_scoring_config JSONB
ALTER TABLE position ADD COLUMN IF NOT EXISTS ai_scoring_config JSONB;
