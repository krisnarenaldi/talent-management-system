-- =============================================================================
-- SEED DATA — Talent Management System (TMS)
-- Target Database : PostgreSQL 17.x
-- Sumber Kebenaran : backend/app/db/seed.py
-- Dibuat pada      : 2026-09-02
--
-- Cara pakai (setelah DDL selesai):
--   \i docs/SEED-TMS.sql
--
-- ATAU, LEBIH DISARANKAN gunakan Python seed script (karena hash bcrypt-nya
-- 100% kompatibel dengan passlib[bcrypt] backend):
--   cd backend
--   python -m app.db.seed
--
-- Data yang di-insert:
--   1. 1 user Admin bootstrap  (admin@altek.id / admin123!)
--   2. 5 Blacklist Status Type default (sesuai PRD 5.3)
--   3. 4 Agreement Type default (contoh, perlu disesuaikan daftar baku HR)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- SEED 1: User Admin Bootstrap
-- -----------------------------------------------------------------------------
-- Password "admin123!" di-hash dengan bcrypt rounds 12 (kompatibel passlib[bcrypt])
-- Menggunakan pgcrypto extension (diaktifkan sementara untuk hash).
-- ⚠️  SEGERA GANTI PASSWORD DEFAULT INI SETELAH LOGIN PERTAMA KALI!

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public."user" (id, name, email, hashed_password, role, is_active, created_at, updated_at)
SELECT
    gen_random_uuid()                          AS id,
    'Admin Altek'                              AS name,
    'admin@altek.id'                           AS email,
    crypt('admin123!', gen_salt('bf', 12))     AS hashed_password,
    'admin'::user_role_enum                    AS role,
    TRUE                                       AS is_active,
    CURRENT_TIMESTAMP                          AS created_at,
    CURRENT_TIMESTAMP                          AS updated_at
WHERE NOT EXISTS (SELECT 1 FROM public."user" WHERE email = 'admin@altek.id');

-- Opsional: Drop extension pgcrypto jika hanya dipakai untuk seed ini
-- (Komentar baris di bawah jika Anda butuh pgcrypto untuk keperluan lain)
-- DROP EXTENSION IF EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- SEED 2: Blacklist Status Type  (5 status default dari PRD 5.3)
-- -----------------------------------------------------------------------------
-- ⚠️  Ini adalah status awal — Admin bisa menambah/menonaktifkan kapan pun via UI.

INSERT INTO public.blacklist_status_type (id, label, is_active, created_by, created_at)
SELECT gen_random_uuid() AS id, label::VARCHAR(255) AS label, TRUE AS is_active, NULL::UUID AS created_by, CURRENT_TIMESTAMP AS created_at
FROM (
    VALUES
        ('Menolak Offer Tanpa Alasan Jelas'),
        ('Tidak Hadir Interview Tanpa Konfirmasi (No-Show)'),
        ('Terbukti Manipulasi Data'),
        ('Bermasalah di Tempat Kerja Client'),
        ('Referensi Negatif')
) AS v(label)
WHERE NOT EXISTS (
    SELECT 1 FROM public.blacklist_status_type bst WHERE bst.label = v.label
);

-- -----------------------------------------------------------------------------
-- SEED 3: Agreement Type  (Contoh jenis perjanjian Altek-Klien)
-- -----------------------------------------------------------------------------
-- ⚠️  OPEN QUESTION #8 di requirements.md: perlu dikonfirmasi daftar baku dari HR
--    Altek. UPDATE / TAMBAHKAN sesuai daftar resmi sebelum go-live!

INSERT INTO public.agreement_type (id, label, is_active, created_by, created_at)
SELECT gen_random_uuid() AS id, label::VARCHAR(255) AS label, TRUE AS is_active, NULL::UUID AS created_by, CURRENT_TIMESTAMP AS created_at
FROM (
    VALUES
        ('PKWT (Perjanjian Kerja Waktu Tertentu)'),
        ('PKWTT (Perjanjian Kerja Waktu Tidak Tertentu)'),
        ('PPJP (Perjanjian Pemborongan Jasa Pekerjaan)'),
        ('Perjanjian Outsourcing')
) AS v(label)
WHERE NOT EXISTS (
    SELECT 1 FROM public.agreement_type at2 WHERE at2.label = v.label
);

-- =============================================================================
-- VERIFIKASI — query untuk memastikan seed berhasil
-- =============================================================================

DO $$
DECLARE
    cnt_admin       INTEGER;
    cnt_blacklist   INTEGER;
    cnt_agreement   INTEGER;
BEGIN
    SELECT COUNT(*) INTO cnt_admin     FROM public."user" WHERE email = 'admin@altek.id';
    SELECT COUNT(*) INTO cnt_blacklist FROM public.blacklist_status_type;
    SELECT COUNT(*) INTO cnt_agreement FROM public.agreement_type;

    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE ' SEED VERIFICATION:';
    RAISE NOTICE '   ✓ Admin user        : % (admin@altek.id / admin123!)', CASE WHEN cnt_admin > 0 THEN 'OK' ELSE 'GAGAL' END;
    RAISE NOTICE '   ✓ Blacklist Status  : % jenis', cnt_blacklist;
    RAISE NOTICE '   ✓ Agreement Types   : % jenis', cnt_agreement;
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE ' ⚠️  SEGERA GANTI PASSWORD DEFAULT "admin123!" SETELAH LOGIN!';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

COMMIT;
