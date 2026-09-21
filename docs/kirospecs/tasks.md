# Tasks — Talent Management System (TMS)
**Client:** Altek
**Versi:** 1.0
**Tanggal:** September 2026

---

> Setiap task memiliki format:
> `[ ]` = belum dikerjakan | `[~]` = sedang berjalan | `[x]` = selesai
>
> Referensi ke requirements: FR-XX = Functional Requirement, NFR-XX = Non-Functional Requirement
> Referensi ke design: lihat `design.md`

---

## FASE 1 — MVP (Database & Pipeline Inti)

### TASK-01: Project Setup & Infrastructure

#### TASK-01.1: Inisialisasi Repository & Docker
- [x] Buat `docker-compose.yml` dengan services: postgres, pgbouncer, backend, frontend, n8n, nginx
- [x] Buat `nginx.conf` — reverse proxy `/api/*` ke FastAPI, `/*` ke Next.js, block akses `/internal/*` dari luar
- [x] Buat `.env.example` dengan semua variabel yang dibutuhkan (tanpa nilai sensitif)
- [x] Setup `.gitignore` yang benar (exclude `.env`, `__pycache__`, `.next`, `node_modules`, dll)
- [-] Verifikasi seluruh service bisa jalan dengan `docker-compose up`

#### TASK-01.2: Backend Setup (FastAPI)
- [x] Inisialisasi project FastAPI dengan `uv` atau `pip` + `requirements.txt`
- [x] Setup SQLAlchemy + Alembic untuk ORM & migrations
- [ ] Konfigurasi `app/core/config.py` — baca semua settings dari environment variables (Pydantic BaseSettings)
- [ ] Setup database connection pool di `app/db/database.py`
- [ ] Setup struktur folder sesuai design: `routers/`, `services/`, `models/`, `schemas/`, `core/`
- [ ] Setup CORS middleware (hanya izinkan origin frontend)
- [ ] Buat health check endpoint `GET /health`

#### TASK-01.3: Frontend Setup (Next.js)
- [x] Inisialisasi project Next.js dengan TypeScript + Tailwind CSS + App Router
- [x] Install dependencies: `@tanstack/react-query`, `zustand`, `react-hook-form`, `zod`, `axios` (fix: update `next` dari `15.0.3` → `^15.2.0` + `eslint-config-next` → `^15.2.0` agar kompatibel dengan React 19)
- [x] Setup folder struktur sesuai design: `app/`, `components/`, `lib/`, `hooks/`, `stores/`, `types/`
- [x] Konfigurasi `lib/api.ts` — axios instance dengan base URL ke FastAPI, interceptor untuk auto-refresh token (fix: skip refresh logic untuk endpoint auth agar error message login tidak hilang)
- [x] Buat layout dasar dengan sidebar navigasi (responsif, mobile-friendly)
- [x] Setup font & warna brand di `tailwind.config.ts`
- [x] Fix: buat `postcss.config.js` (wajib untuk Tailwind CSS via PostCSS), buat `.env.local` untuk dev proxy, buat `src/app/page.tsx` redirect `/` → `/dashboard`, update middleware redirect `/` → `/dashboard` ketika terautentikasi, migrasi font Inter ke `next/font/google` untuk hindari hydration mismatch

#### TASK-01.4: Database Migrations (Fase 1 Tables)
- [x] Buat migration: tabel `user`
- [x] Buat migration: tabel `client`
- [x] Buat migration: tabel `position`
- [x] Buat migration: tabel `candidate`, `candidate_education`, `candidate_experience`, `candidate_document`
- [x] Buat migration: tabel `application`, `stage_history`
- [x] Buat migration: tabel `blacklist`, `blacklist_status_type`
- [x] Buat migration: tabel `employee`, `employee_contract`, `agreement_type`, `employee_document`
- [x] Buat migration: tabel `employee_payroll` *(Fase 1 — FR-11, dipakai oleh TASK-08.1)*
- [x] Buat seed data: 5 status blacklist default, beberapa agreement type default (PKWT, PKWTT, PPJP)
- [x] Buat seed data: 1 user Admin awal untuk bootstrap sistem

---

> **Catatan tabel yang TIDAK masuk Fase 1:**
> - `ai_screening_result` → Fase 3 (TASK-11/12, fitur AI screening)
> - `generated_cv` → Fase 2 (TASK-10, generate CV standar)

---

### TASK-02: Autentikasi & User Management (FR-01, FR-02 sebagian)

#### TASK-02.1: Backend Auth
- [x] Implementasi `POST /api/v1/auth/login` — validasi email/password, return JWT (access + refresh) sebagai httpOnly cookie
- [x] Implementasi `POST /api/v1/auth/logout` — clear cookie + revoke refresh token di DB
- [x] Implementasi `POST /api/v1/auth/refresh` — rotate refresh token, issue access token baru
- [x] Buat `core/security.py`: fungsi hash password (bcrypt), verify password, create/decode JWT
- [x] Buat `core/dependencies.py`: `get_current_user()`, `require_role()` FastAPI dependencies
- [x] RBAC middleware — setiap router mendefinisikan role yang diizinkan (`require_role` diterapkan ke semua CRUD endpoint)

#### TASK-02.2: Backend User CRUD (Admin only)
- [x] `GET /api/v1/users/` — list semua user (Admin) + search, filter role, filter is_active, pagination
- [x] `POST /api/v1/users/` — tambah user baru (Admin): cek email unik, validasi role, hash password
- [x] `PUT /api/v1/users/{id}` — edit user (Admin): name, role, is_active, optional password re-hash
- [x] `DELETE /api/v1/users/{id}` — nonaktifkan user (Admin, soft delete via is_active=False)
- [x] Validasi: email unik, role hanya `admin/hr/manager`

#### TASK-02.3: Frontend Auth
- [x] Halaman `/login` — form email & password, validasi, error message
- [x] `middleware.ts` — protect semua route selain `/login`; redirect ke `/login` jika tidak terautentikasi
- [x] Auto-refresh token di `lib/api.ts` interceptor (jika 401, coba refresh, retry request)
- [x] Logout button di sidebar → clear session, redirect ke `/login` (fix: tambah `/auth/logout` ke AUTH_ENDPOINTS agar interceptor tidak interferen, tambah `logout()` ke auth.store, clear store state di handleLogout)
- [x] Halaman `/admin/users` — tabel user, form tambah/edit user (Admin only) (DataTable + Add/Edit modal + search/filter + deactivate/reactivate, dengan React Query & RBAC check)

---

### TASK-03: Master Data (FR-02)

#### TASK-03.1: Backend Master Data
- [x] CRUD `GET/POST/PUT/DELETE /api/v1/clients/` (Admin)
- [x] CRUD `GET/POST/PUT/DELETE /api/v1/positions/` (Admin)
- [x] CRUD `GET/POST/PUT/DELETE /api/v1/blacklist-status-types/` (Admin) — soft delete via `is_active`
- [x] CRUD `GET/POST/PUT/DELETE /api/v1/agreement-types/` (Admin) — soft delete via `is_active`

#### TASK-03.2: Frontend Master Data
- [x] Halaman `/admin/clients` — tabel client, form tambah/edit
- [x] Halaman `/admin/positions` — tabel posisi per client, form tambah/edit, toggle aktif/nonaktif
- [x] Halaman `/admin/blacklist-status-types` — tabel jenis status blacklist, form tambah, toggle aktif
- [x] Halaman `/admin/agreement-types` — tabel jenis perjanjian, form tambah, toggle aktif

---

### TASK-04: Manajemen Kandidat (FR-03)

#### TASK-04.1: Backend Kandidat
- [x] `GET /api/v1/candidates/` — list kandidat dengan pagination, search (nama/email/phone), filter (status, posisi, sumber)
- [x] `POST /api/v1/candidates/` — tambah kandidat baru:
  - Cek duplikat by email & phone (`candidate_service.check_duplicate`)
  - Cek blacklist by email / phone / identity_no (`blacklist_service.check_match`)
  - Return warning flags di response jika ada match
- [x] `GET /api/v1/candidates/{id}` — detail kandidat lengkap
- [x] `PUT /api/v1/candidates/{id}` — update data kandidat
- [x] `DELETE /api/v1/candidates/{id}` — soft delete (Admin only)
- [x] CRUD `/api/v1/candidates/{id}/education/` — riwayat pendidikan
- [x] CRUD `/api/v1/candidates/{id}/experience/` — riwayat pengalaman kerja
- [x] `PATCH /api/v1/candidates/{id}/flags/` — update flag `completeness_status`, `contact_status`

#### TASK-04.2: Backend Dokumen Kandidat (NFR-05)
- [x] Buat `services/onedrive_service.py`:
  - `upload_file(file, folder_path)` → return `drive_item_id` & `file_url`
  - `get_download_url(drive_item_id)` → return pre-authenticated download URL (sementara)
  - `delete_file(drive_item_id)`
  - Handle file >4MB dengan upload session API
- [x] `POST /api/v1/candidates/{id}/documents/` — upload dokumen:
  - Validasi tipe MIME & ukuran
  - Upload ke OneDrive via `onedrive_service`
  - Simpan referensi ke `candidate_document`
- [x] `GET /api/v1/candidates/{id}/documents/` — list dokumen kandidat
- [x] `GET /api/v1/candidates/{id}/documents/{doc_id}/download-url` — return pre-authenticated URL
- [x] `DELETE /api/v1/candidates/{id}/documents/{doc_id}` — hapus dokumen (soft delete + hapus dari OneDrive)

#### TASK-04.3: Frontend Kandidat
- [x] Halaman `/candidates` — DataTable kandidat (search, filter posisi/status/sumber, pagination)
  - Badge status: aktif, duplikat suspected, blacklisted
- [x] Tombol "Tambah Kandidat"
- [x] Halaman `/candidates/new` — form multi-step atau multi-section:
  - Seksi 1: Data Pribadi (nama, email, phone, NIK, domisili, sumber, gaji, notice period)
  - Seksi 2: Pendidikan (bisa tambah lebih dari 1 entri)
  - Seksi 3: Pengalaman Kerja (bisa tambah lebih dari 1 entri)
  - `DuplicateWarningBanner` muncul jika API return `possible_duplicate = true`
  - `BlacklistWarningModal` muncul jika API return `blacklist_warning = true`
- [x] Halaman `/candidates/[id]` — detail kandidat dengan tab:
  - **Profil**: semua data pribadi + pendidikan + pengalaman
  - **Dokumen**: list dokumen + `DocumentUploader` (drag-drop, preview, download)
  - **Lamaran**: list Application kandidat ini + link ke detail masing-masing
  - **Catatan**: catatan bebas recruiter
- [x] Halaman `/candidates/[id]/edit` — form edit (sama struktur dengan form tambah)
- [x] Komponen `DocumentUploader`: drag-drop, preview PDF/gambar, progress bar, delete

---

### TASK-05: Tracking Pipeline Rekrutmen (FR-04)

#### TASK-05.1: Backend Application & Stage
- [x] `POST /api/v1/applications/` — buat lamaran baru (candidate_id + position_id + recruiter_id)
- [x] `GET /api/v1/applications/` — list lamaran dengan filter (posisi, status, tahapan, recruiter, periode)
- [x] `GET /api/v1/applications/{id}` — detail lamaran + stage history
- [x] `PATCH /api/v1/applications/{id}/stages/` — update tahapan:
  - Validasi transisi tahapan (tidak bisa loncat sembarangan)
  - Simpan event ke `stage_history` dengan `updated_by` & timestamp
- [x] `Jika tahapan = "Existing" → trigger `employee_service.create_from_application(application_id)`
- [x] `GET /api/v1/applications/{id}/stages/` — list riwayat tahapan

#### TASK-05.2: Backend Auto-Create Employee (FR-04.4)
- [x] `employee_service.create_from_application(application_id)`:
  - Ambil data dari `Candidate` terkait
  - Buat `Employee` record: full_name, identity_no, phone_number dari Candidate
  - Set `employee_status = "aktif"`
  - Idempotent: skip jika Employee dengan `application_id` ini sudah ada
  - Return `employee_id`

#### TASK-05.3: Frontend Pipeline
- [x] Halaman `/applications` — list semua lamaran:
  - Filter: posisi, client, status, tahapan, recruiter, tanggal
  - Setiap baris: nama kandidat, posisi, client, tahapan saat ini, tanggal update, recruiter
- [x] Link ke detail lamaran
- [x] Halaman `/applications/[id]` — detail lamaran:
  - Panel kiri: ringkasan kandidat + posisi
  - Panel kanan: timeline tahapan (riwayat dari Stage_History)
  - `StageUpdateForm` — form dinamis berdasarkan tahapan aktif:
    - Konfirmasi Kehadiran: radio OK/Reschedule, form tanggal jika reschedule
    - Interview HR: input gaji, catatan, radio Lanjut/Not Recommended
    - Psikotest: tanggal, radio Lolos/Tidak Lolos
    - Offering: radio Lolos Kontrak/Negosiasi (sub-status jika Negosiasi)
    - Kontrak: date picker TTD
    - Onboarding: date picker
    - Existing: konfirmasi → auto-create employee + link ke halaman karyawan

---

### TASK-06: Blacklist (FR-05)

#### TASK-06.1: Backend Blacklist
- [x] `GET /api/v1/blacklist/` — list blacklist (search nama/email, filter status type)
- [x] `POST /api/v1/blacklist/` — tambah ke blacklist (HR bisa submit, Manager approve)
- [x] `PATCH /api/v1/blacklist/{id}/approve` — approve blacklist (Manager only)
- [x] `PATCH /api/v1/blacklist/{id}/revoke` — cabut blacklist (Manager only)
- [x] `GET /api/v1/blacklist/check` — query param: email, phone, identity_no → return match atau tidak

#### TASK-06.2: Frontend Blacklist
- [x] Halaman `/blacklist` — DataTable: nama kandidat, status type, alasan, tanggal, PIC, status approval
  - Filter: status type, status approval
- [x] Tombol "Tambah ke Blacklist"
- [x] Halaman `/blacklist/new` — form: pilih kandidat (autocomplete), pilih status type, isi alasan & catatan
- [x] Manager: tombol "Approve" / "Cabut" di setiap baris

---

### TASK-07: Export Data (FR-06)

#### TASK-07.1: Backend Export
- [x] `GET /api/v1/export/candidates` — export Excel kandidat dengan filter (posisi, status, periode)
  - Gunakan library `openpyxl` untuk generate file
  - Stream response sebagai file download
- [x] `GET /api/v1/export/pipeline` — export Excel pipeline per posisi/periode
- [x] `GET /api/v1/export/incomplete` — export kandidat dengan data belum lengkap

#### TASK-07.2: Frontend Export
- [x] Komponen `ExportButton` dengan dropdown filter sebelum download
- [x] Tambahkan tombol export di halaman `/candidates` dan `/applications`

---

### TASK-08: Modul Karyawan / Monitoring Outsource (FR-11)

#### TASK-08.1: Backend Employee
- [x] `GET /api/v1/employees/` — list karyawan (filter: status, penempatan, contract expiry)
- [x] `GET /api/v1/employees/{id}` — detail karyawan (tanpa payroll)
- [x] `PUT /api/v1/employees/{id}` — update data karyawan
- [x] CRUD `/api/v1/employees/{id}/contracts/` — riwayat kontrak
- [x] `GET /api/v1/employees/{id}/payroll` — get payroll (Manager + Admin only)
- [x] `PUT /api/v1/employees/{id}/payroll` — update payroll (Manager + Admin only)
- [x] CRUD `/api/v1/employees/{id}/documents/` — dokumen karyawan (pola sama dengan dokumen kandidat)
- [x] Kalkulasi otomatis di response: `age` dari `birth_date`, `contract_duration_running` dari `join_date`

#### TASK-08.2: Frontend Employee
- [x] Halaman `/employees` — DataTable karyawan:
  - Filter: status, penempatan, contract expiry dalam 30 hari
  - Badge: kontrak hampir habis (< 30 hari)
- [x] Halaman `/employees/[id]` — detail dengan tab:
  - **Data Pribadi**: info identitas, status, penempatan; usia dihitung & ditampilkan otomatis
  - **Kontrak**: list riwayat kontrak, tombol "Tambah Kontrak Baru"; masa berjalan ditampilkan otomatis
  - **Payroll**: hanya tampil jika role Manager/Admin; form THP, rekening, BPJS, NPWP
  - **Dokumen**: list dokumen + DocumentUploader
- [x] Setelah auto-create dari Application "Existing": redirect ke `/employees/[id]` dengan toast "Karyawan berhasil dibuat, lengkapi data berikut"

---

### TASK-09: Dashboard Dasar (FR-10 sebagian)

- [x] Backend: `GET /api/v1/analytics/summary` — return:
  - Total kandidat aktif
  - Total kandidat per tahapan pipeline (grouped)
  - Total karyawan aktif
  - Jumlah kontrak habis dalam 30 hari
- [x] Frontend `/dashboard`:
  - Card metrics: total kandidat, total karyawan, kandidat di pipeline, kontrak hampir habis
  - Tabel "Lamaran Terbaru" (5 terbaru)
  - Tabel "Kontrak Hampir Habis" (top 5)

---

## FASE 2 — Standarisasi CV

### TASK-10: Generate CV Standar (FR-07)

- [x] Backend: simpan data template CV di database (atau file konfigurasi)
      — Template HTML Jinja2 di `backend/app/templates/cv/altek_standard.html`; logo di `backend/app/assets/altek_logo.png`
- [x] Backend: `POST /api/v1/applications/{id}/cv/generate` — generate CV standar:
  - Gabungkan data kandidat (tanpa PII)
  - Terapkan template Altek
  - Jika foto ada → masukkan ke layout; jika tidak → skip slot foto
  - Simpan hasil ke `generated_cv`, upload file PDF ke storage (local/OneDrive)
  - Staleness check: `candidate.updated_at` vs `generated_cv.generated_at` via cascade trigger
- [x] Backend: `GET /api/v1/applications/{id}/cv/` — list CV yang sudah digenerate
- [x] Frontend `/applications/[id]/cv`:
  - Tombol generate/regenerate
  - Pilih bahasa (ID/EN) untuk summary
  - Field input summary manual atau generate AI
  - Stale warning banner + riwayat CV dengan open/download
- [x] Admin: halaman `/admin/cv-templates` — overview semua generated CV + konfigurasi template

---

## FASE 3 — AI Screening & Ekstraksi

### TASK-11: Async CV Parsing & AI Extraction (FR-08, FR-03.9)

#### TASK-11.1: Database Migration
- [x] Buat migration: tabel `ai_screening_result` — kolom: `id`, `application_id` (nullable — belum ada lamaran saat batch upload), `candidate_id` (nullable — diisi setelah HR setuju buat kandidat), `position_id`, `uploaded_by` (user_id HR), `cv_file_url`, `cv_drive_item_id`, `status` (enum: `menunggu_screening_ai` / `sedang_diproses` / `siap_review` / `sudah_direview` / `error`), `extracted_json` (raw JSON dari LLM), `ai_score` (float), `ai_notes` (text), `reviewed_by`, `reviewed_at`, `created_at`, `updated_at`
- [x] Buat migration: tabel `notification` — kolom: `id`, `user_id`, `type` (varchar), `message`, `link`, `is_read` (bool, default false), `created_at`
- [x] Tambah kolom `ai_scoring_config` (JSON, nullable) ke tabel `position` via migration

#### TASK-11.2: Backend — Upload & Enqueue
- [x] Endpoint `POST /api/v1/applications/bulk-upload-cv` (HR + Manager):
  - Terima `position_id` + multifile CV (PDF, max per file dikonfigurasi)
  - Upload setiap file ke OneDrive: folder path `/{position_id}/{client_name}/cv_uploads/`
  - Buat record `ai_screening_result` per file dengan status `menunggu_screening_ai`
  - Enqueue satu arq job per file via `await redis_pool.enqueue_job("process_cv_screening", str(screening_result.id))` — tanpa HTTP keluar sama sekali
  - Return immediately — jangan tunggu proses selesai
- [x] Setup `app/core/arq_pool.py` — helper `get_redis_pool()` return koneksi arq ke Redis (`REDIS_URL` dari env var)

#### TASK-11.3: Backend — Internal Callback & Notifikasi
- [x] Buat `routers/internal.py` — endpoint `POST /internal/ai/extraction-result` (dilindungi `X-Internal-Secret` header dari env var):
  - Terima payload: `screening_result_id`, `extracted_json`, `ai_score`, `ai_notes`, `status` (`siap_review` atau `error`)
  - Update record `ai_screening_result` sesuai payload
  - Jika status `siap_review`: buat record `notification` untuk `uploaded_by` (type: `ai_screening_done`, link: `/applications/pending-review`)
  - Jika semua file dalam satu batch selesai: buat satu notifikasi ringkasan (bukan satu notif per file)
- [x] Endpoint `GET /api/v1/notifications/` — return notifikasi milik user yang login, diurutkan terbaru, filter `is_read`
- [x] Endpoint `PATCH /api/v1/notifications/{id}/read` — tandai notifikasi sebagai sudah dibaca
- [x] Endpoint `PATCH /api/v1/notifications/read-all` — tandai semua notifikasi sebagai sudah dibaca

#### TASK-11.4: Backend — Parsing Service (fungsi Python, dipanggil oleh arq worker)
- [x] Buat `services/cv_pipeline.py` — fungsi `process_cv_screening(ctx, screening_result_id: str)`:
  - Download file dari OneDrive via `onedrive_service.download_file(drive_item_id)`
  - Ekstrak teks: PyMuPDF (text-based) atau Tesseract/PaddleOCR (scan) via `pdf_service.extract_text(raw_file)`
  - Validasi teks tidak kosong (< 20 karakter → raise ValueError)
  - Hapus file sementara dari disk lokal setelah parsing selesai
  - Menggantikan endpoint `/internal/parse-cv` sebagai titik parsing — tidak ada HTTP round-trip

#### TASK-11.5: arq Worker — CV Pipeline
- [x] Buat `app/worker.py` — kelas `WorkerSettings`:
  - `functions = [process_cv_screening]` — task utama CV parsing + AI scoring + save result
  - Urutan dalam `process_cv_screening`: parse CV → ambil scoring config → call LLM → simpan hasil → notifikasi batch
  - Error handling: try/except di level fungsi, status di-set `"error"` + `ai_notes` berisi pesan error, tetap commit ke DB
  - `redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)`
  - `max_jobs = 10`, `job_timeout = 300` (5 menit per CV)
  - Menggantikan seluruh n8n workflow "CV Parser" (8 node HTTP) dengan satu fungsi Python terurut

#### TASK-11.6: Frontend — Halaman Pending Review & Notifikasi
- [x] Komponen `NotificationBell` di navbar:
  - [x] Polling `GET /api/v1/notifications/` tiap 30 detik
  - [x] Badge angka merah untuk notifikasi belum dibaca
  - [x] Dropdown list notifikasi terbaru (maks 10); klik item → navigasi ke `link` + mark as read
  - [x] Tombol "Tandai semua dibaca"
- [x] Halaman `/applications/pending-review`:
  - [x] List semua `ai_screening_result` dengan status `siap_review` milik HR yang login (Manager lihat semua)
  - [x] Kolom: nama file CV, posisi, tanggal upload, AI score (badge warna), waktu tunggu
  - [x] Filter: posisi, tanggal upload
  - [x] Diurutkan dari yang terlama menunggu review
  - [x] Tombol "Review" per baris → buka komponen `AIExtractionReview`

#### TASK-11.7: Frontend — Komponen AIExtractionReview
- [x] Komponen `AIExtractionReview` (layout 2-panel: kiri hasil AI, kanan form input kandidat):
  - [x] Panel kiri: tampilkan `extracted_json` sebagai read-only structured view + AI score + catatan AI
  - [x] Panel kanan: form kandidat (nama, kontak, pendidikan, pengalaman, skill) — prefill dari `extracted_json`
  - [x] Tombol "Terapkan Hasil AI" — isi semua field form dari data AI (dapat diedit ulang)
  - [x] HR bisa edit tiap field bebas sebelum simpan
  - [x] Tombol aksi berdasarkan skor (FR-08.8):
    - Skor ≥ threshold tinggi: **"Terima & Buat Lamaran"**
    - Skor antara threshold: **"Review & Buat Lamaran"**
    - Skor < threshold rendah: **"Simpan Sebagai Kandidat"** + **"Tetap Proses"**
  - [x] HR/Manager selalu bisa override — semua tombol aksi tersedia, badge skor hanya informasi
  - [x] Setelah aksi diambil: update status `ai_screening_result` → `sudah_direview`, mark notifikasi terkait as read

#### TASK-11.8: Backend — Endpoint Review Screening Result
- [x] Endpoint `GET /api/v1/applications/screening/{id}` — return detail satu screening result lengkap
- [x] Endpoint `PATCH /api/v1/applications/screening/{id}/review` — update status, link candidate/application, simpan catatan HR
- [x] Setelah berhasil: buat notifikasi ke uploader jika bukan diri sendiri

### TASK-12: AI Scoring & Matching (FR-08.4)

#### TASK-12.1: Backend — Scoring Config
- [x] Tambah field `ai_scoring_config` (JSON) ke endpoint `PUT /api/v1/positions/{id}` — Admin/Manager dapat set konfigurasi scoring per posisi
- [x] Schema `ai_scoring_config`: `threshold_auto_recommend` (default 80), `threshold_manual_review` (default 60), `weights` (education, experience_years, skill_match, domain_relevance — total 100), `required_skills` (array string), `min_experience_years` (int)
- [x] Frontend `/admin/positions` — tambah section "Konfigurasi AI Screening" di form edit posisi: input threshold, slider bobot per dimensi, input required skills (tag input), input min experience

#### TASK-12.2: Backend — Scoring Result
- [x] `ai_screening_result` sudah mencakup `ai_score` dan `ai_notes` dari TASK-11.1
- [x] Endpoint `GET /api/v1/applications/` — tambah field `ai_score` dan `ai_screening_status` di response tiap item
- [x] Endpoint `GET /api/v1/applications/{id}` — tambah objek `ai_screening` di response: `score`, `notes`, `status`, `extracted_summary` (ringkasan match per dimensi)

#### TASK-12.3: Frontend — Tampilan Skor di Pipeline
- [x] Halaman `/applications` (list): tambah kolom "AI Score" — badge warna (hijau ≥ 80 / kuning 60-79 / merah < 60) + ikon status (⏳/✅/✓)
- [x] Halaman `/applications/[id]` (detail): tambah panel "Hasil AI Screening" — skor angka, catatan AI, tabel ringkasan match per dimensi (pendidikan, pengalaman, skill match, relevansi domain)

### TASK-13: AI Draft Project (FR-08.5)

- [x] Backend: `POST /api/v1/candidates/{id}/ai/draft-projects` — kirim pengalaman kerja ke LLM, return draft
- [x] Frontend: panel "Draft Project AI" di tab pengalaman kandidat — edit & setujui sebelum masuk CV

### TASK-14: Natural Language Search (FR-09)

- [x] Backend `services/ai_service.py`:
  - `translate_nl_to_filters(query: str)` → kirim query + skema field ke LLM → return filter JSON
  - `execute_structured_filters(filters: dict)` → terjemahkan ke SQLAlchemy query (bukan raw SQL dari LLM)
- [x] Endpoint `POST /api/v1/ai/search/` — role Manager only
- [x] Frontend `/search`:
  - Chat-style UI (ala ChatGPT/Claude) — input teks bebas, riwayat percakapan
  - Tampilkan `filters_applied` sebagai badge — Manager tahu filter yang dipakai
  - Hasil: DataTable kandidat yang match + link ke detail
  - Boundary: query di luar talent management ditolak sopan (HTTP 422)
  - Guard frontend: halaman hanya tampil untuk role Manager

---

## FASE 4 — Analytics

### TASK-15: Dashboard Analytics (FR-10)

- [x] Backend: endpoint analytics per tahapan/posisi/periode, rasio lolos/gagal User Interview
- [x] Backend: analisis sederhana: posisi/sumber dengan rasio lolos tertinggi
- [x] Frontend `/analytics`:
  - Bar chart: kandidat per tahapan
  - Line chart: tren kandidat masuk per bulan
  - Tabel: rasio lolos per posisi dan per sumber channel

---

## TASK Infrastruktur & DevOps (Cross-Fase)

### TASK-16: arq Cron Jobs (menggantikan n8n Automation)

> **Catatan migrasi:** TASK-16 sebelumnya direncanakan sebagai n8n workflow terpisah. Setelah migrasi CV pipeline ke arq (TASK-11.4/11.5), kedua cron job ini didaftarkan di `WorkerSettings.cron_jobs` pada worker yang sama — tidak butuh service terpisah.

- [x] Buat `services/ops_jobs.py` — dua fungsi async:
  - `backup_database(ctx)`: jalankan `pg_dump` via subprocess, upload hasil ke OneDrive folder `/backups/`, cleanup file lokal
  - `check_contract_expiry(ctx)`: query `employee_contract` yang berakhir dalam 30/14/7 hari, buat notifikasi ke Manager/HR via `notification_service`
- [x] Daftarkan di `app/worker.py` sebagai cron jobs:
  ```python
  cron(backup_database, hour=2, minute=0)       # harian 02.00
  cron(check_contract_expiry, hour=8, minute=0) # harian 08.00
  ```
- [ ] Uji dengan `arq app.worker.WorkerSettings --burst` (dry-run tanpa loop)

### TASK-17: Monitoring & Production Readiness

- [ ] Setup basic monitoring: script cek disk usage, RAM, CPU (bisa via arq cron job atau cron OS)
- [ ] Alert jika disk VPS > 80% atau RAM > 85%
- [ ] Monitor kuota OneDrive (via Graph API `GET /drive` → `quota` object)
- [ ] Pastikan `pg_dump` backup berjalan dan bisa di-restore (test restore sekali)
- [ ] Setup Let's Encrypt SSL di Nginx
- [ ] Dokumentasi deployment: langkah setup awal di server baru

---

## Urutan Pengerjaan yang Disarankan

```
Sprint 1 (Foundation):
  TASK-01 → TASK-02 → TASK-03

Sprint 2 (Kandidat & Dokumen):
  TASK-04

Sprint 3 (Pipeline & Employee):
  TASK-05 → TASK-06 → TASK-08

Sprint 4 (Export & Dashboard Dasar):
  TASK-07 → TASK-09

--- Fase 1 DONE — Bisa Go-Live ---

Sprint 5:
  TASK-10 (Standarisasi CV)

Sprint 6–7:
  TASK-11 → TASK-12 → TASK-13 → TASK-14 (AI)

Sprint 8:
  TASK-15 (Analytics)

Ongoing:
  TASK-16 → TASK-17 (Infra & DevOps, mulai dari Sprint 1)
```

---

## Estimasi Kasar (untuk diskusi, bukan komitmen)

| Fase | Task | Estimasi Effort |
|---|---|---|
| Fase 1 MVP | TASK-01 s/d TASK-09 | 6–8 minggu (1 developer full-time) |
| Fase 2 CV | TASK-10 | 1–2 minggu |
| Fase 3 AI | TASK-11 s/d TASK-14 | 3–5 minggu (bergantung kualitas sample CV & akurasi LLM) |
| Fase 4 Analytics | TASK-15 | 1–2 minggu |
| **Total** | | **~11–17 minggu** |

> Estimasi belum termasuk: iterasi feedback klien, revisi UI, bug fixing, testing UAT, dan waktu menunggu konfirmasi open questions (lihat `requirements.md` bagian 7).