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
- [ ] Buat `docker-compose.yml` dengan services: postgres, pgbouncer, backend, frontend, n8n, nginx
- [ ] Buat `nginx.conf` — reverse proxy `/api/*` ke FastAPI, `/*` ke Next.js, block akses `/internal/*` dari luar
- [ ] Buat `.env.example` dengan semua variabel yang dibutuhkan (tanpa nilai sensitif)
- [ ] Setup `.gitignore` yang benar (exclude `.env`, `__pycache__`, `.next`, `node_modules`, dll)
- [ ] Verifikasi seluruh service bisa jalan dengan `docker-compose up`

#### TASK-01.2: Backend Setup (FastAPI)
- [ ] Inisialisasi project FastAPI dengan `uv` atau `pip` + `requirements.txt`
- [ ] Setup SQLAlchemy + Alembic untuk ORM & migrations
- [ ] Konfigurasi `app/core/config.py` — baca semua settings dari environment variables (Pydantic BaseSettings)
- [ ] Setup database connection pool di `app/db/database.py`
- [ ] Setup struktur folder sesuai design: `routers/`, `services/`, `models/`, `schemas/`, `core/`
- [ ] Setup CORS middleware (hanya izinkan origin frontend)
- [ ] Buat health check endpoint `GET /health`

#### TASK-01.3: Frontend Setup (Next.js)
- [ ] Inisialisasi project Next.js dengan TypeScript + Tailwind CSS + App Router
- [ ] Install dependencies: `@tanstack/react-query`, `zustand`, `react-hook-form`, `zod`, `axios`
- [ ] Setup folder struktur sesuai design: `app/`, `components/`, `lib/`, `hooks/`, `stores/`, `types/`
- [ ] Konfigurasi `lib/api.ts` — axios instance dengan base URL ke FastAPI, interceptor untuk auto-refresh token
- [ ] Buat layout dasar dengan sidebar navigasi (responsif, mobile-friendly)
- [ ] Setup font & warna brand di `tailwind.config.ts`

#### TASK-01.4: Database Migrations (Fase 1 Tables)
- [ ] Buat migration: tabel `user`
- [ ] Buat migration: tabel `client`
- [ ] Buat migration: tabel `position`
- [ ] Buat migration: tabel `candidate`, `candidate_education`, `candidate_experience`, `candidate_document`
- [ ] Buat migration: tabel `application`, `stage_history`
- [ ] Buat migration: tabel `blacklist`, `blacklist_status_type`
- [ ] Buat migration: tabel `employee`, `employee_contract`, `agreement_type`, `employee_document`
- [ ] Buat migration: tabel `employee_payroll` *(Fase 1 — FR-11, dipakai oleh TASK-08.1)*
- [ ] Buat seed data: 5 status blacklist default, beberapa agreement type default (PKWT, PKWTT, PPJP)
- [ ] Buat seed data: 1 user Admin awal untuk bootstrap sistem

> **Catatan tabel yang TIDAK masuk Fase 1:**
> - `ai_screening_result` → Fase 3 (TASK-11/12, fitur AI screening)
> - `generated_cv` → Fase 2 (TASK-10, generate CV standar)

---

### TASK-02: Autentikasi & User Management (FR-01, FR-02 sebagian)

#### TASK-02.1: Backend Auth
- [ ] Implementasi `POST /api/v1/auth/login` — validasi email/password, return JWT (access + refresh) sebagai httpOnly cookie
- [ ] Implementasi `POST /api/v1/auth/logout` — clear cookie
- [ ] Implementasi `POST /api/v1/auth/refresh` — rotate refresh token, issue access token baru
- [ ] Buat `core/security.py`: fungsi hash password (bcrypt), verify password, create/decode JWT
- [ ] Buat `core/dependencies.py`: `get_current_user()`, `require_role()` FastAPI dependencies
- [ ] RBAC middleware — setiap router mendefinisikan role yang diizinkan

#### TASK-02.2: Backend User CRUD (Admin only)
- [ ] `GET /api/v1/users/` — list semua user (Admin)
- [ ] `POST /api/v1/users/` — tambah user baru (Admin)
- [ ] `PUT /api/v1/users/{id}` — edit user (Admin)
- [ ] `DELETE /api/v1/users/{id}` — nonaktifkan user (Admin, soft delete)
- [ ] Validasi: email unik, role hanya `admin/hr/manager`

#### TASK-02.3: Frontend Auth
- [ ] Halaman `/login` — form email & password, validasi, error message
- [ ] `middleware.ts` — protect semua route selain `/login`; redirect ke `/login` jika tidak terautentikasi
- [ ] Auto-refresh token di `lib/api.ts` interceptor (jika 401, coba refresh, retry request)
- [ ] Logout button di sidebar → clear session, redirect ke `/login`
- [ ] Halaman `/admin/users` — tabel user, form tambah/edit user (Admin only)

---

### TASK-03: Master Data (FR-02)

#### TASK-03.1: Backend Master Data
- [ ] CRUD `GET/POST/PUT/DELETE /api/v1/clients/` (Admin)
- [ ] CRUD `GET/POST/PUT/DELETE /api/v1/positions/` (Admin)
- [ ] CRUD `GET/POST/PUT/DELETE /api/v1/blacklist-status-types/` (Admin) — soft delete via `is_active`
- [ ] CRUD `GET/POST/PUT/DELETE /api/v1/agreement-types/` (Admin) — soft delete via `is_active`

#### TASK-03.2: Frontend Master Data
- [ ] Halaman `/admin/clients` — tabel client, form tambah/edit
- [ ] Halaman `/admin/positions` — tabel posisi per client, form tambah/edit, toggle aktif/nonaktif
- [ ] Halaman `/admin/blacklist-status-types` — tabel jenis status blacklist, form tambah, toggle aktif
- [ ] Halaman `/admin/agreement-types` — tabel jenis perjanjian, form tambah, toggle aktif

---

### TASK-04: Manajemen Kandidat (FR-03)

#### TASK-04.1: Backend Kandidat
- [ ] `GET /api/v1/candidates/` — list kandidat dengan pagination, search (nama/email/phone), filter (status, posisi, sumber)
- [ ] `POST /api/v1/candidates/` — tambah kandidat baru:
  - Cek duplikat by email & phone (`candidate_service.check_duplicate`)
  - Cek blacklist by email / phone / identity_no (`blacklist_service.check_match`)
  - Return warning flags di response jika ada match
- [ ] `GET /api/v1/candidates/{id}` — detail kandidat lengkap
- [ ] `PUT /api/v1/candidates/{id}` — update data kandidat
- [ ] `DELETE /api/v1/candidates/{id}` — soft delete (Admin only)
- [ ] CRUD `/api/v1/candidates/{id}/education/` — riwayat pendidikan
- [ ] CRUD `/api/v1/candidates/{id}/experience/` — riwayat pengalaman kerja
- [ ] `PATCH /api/v1/candidates/{id}/flags/` — update flag `completeness_status`, `contact_status`

#### TASK-04.2: Backend Dokumen Kandidat (NFR-05)
- [ ] Buat `services/onedrive_service.py`:
  - `upload_file(file, folder_path)` → return `drive_item_id` & `file_url`
  - `get_download_url(drive_item_id)` → return pre-authenticated download URL (sementara)
  - `delete_file(drive_item_id)`
  - Handle file >4MB dengan upload session API
- [ ] `POST /api/v1/candidates/{id}/documents/` — upload dokumen:
  - Validasi tipe MIME & ukuran
  - Upload ke OneDrive via `onedrive_service`
  - Simpan referensi ke `candidate_document`
- [ ] `GET /api/v1/candidates/{id}/documents/` — list dokumen kandidat
- [ ] `GET /api/v1/candidates/{id}/documents/{doc_id}/download-url` — return pre-authenticated URL
- [ ] `DELETE /api/v1/candidates/{id}/documents/{doc_id}` — hapus dokumen (soft delete + hapus dari OneDrive)

#### TASK-04.3: Frontend Kandidat
- [ ] Halaman `/candidates` — DataTable kandidat (search, filter posisi/status/sumber, pagination)
  - Badge status: aktif, duplikat suspected, blacklisted
  - Tombol "Tambah Kandidat"
- [ ] Halaman `/candidates/new` — form multi-step atau multi-section:
  - Seksi 1: Data Pribadi (nama, email, phone, NIK, domisili, sumber, gaji, notice period)
  - Seksi 2: Pendidikan (bisa tambah lebih dari 1 entri)
  - Seksi 3: Pengalaman Kerja (bisa tambah lebih dari 1 entri)
  - `DuplicateWarningBanner` muncul jika API return `possible_duplicate = true`
  - `BlacklistWarningModal` muncul jika API return `blacklist_warning = true`
- [ ] Halaman `/candidates/[id]` — detail kandidat dengan tab:
  - **Profil**: semua data pribadi + pendidikan + pengalaman
  - **Dokumen**: list dokumen + `DocumentUploader` (drag-drop, preview, download)
  - **Lamaran**: list Application kandidat ini + link ke detail masing-masing
  - **Catatan**: catatan bebas recruiter
- [ ] Halaman `/candidates/[id]/edit` — form edit (sama struktur dengan form tambah)
- [ ] Komponen `DocumentUploader`: drag-drop, preview PDF/gambar, progress bar, delete

---

### TASK-05: Tracking Pipeline Rekrutmen (FR-04)

#### TASK-05.1: Backend Application & Stage
- [ ] `POST /api/v1/applications/` — buat lamaran baru (candidate_id + position_id + recruiter_id)
- [ ] `GET /api/v1/applications/` — list lamaran dengan filter (posisi, status, tahapan, recruiter, periode)
- [ ] `GET /api/v1/applications/{id}` — detail lamaran + stage history
- [ ] `PATCH /api/v1/applications/{id}/stages/` — update tahapan:
  - Validasi transisi tahapan (tidak bisa loncat sembarangan)
  - Simpan event ke `stage_history` dengan `updated_by` & timestamp
  - Jika tahapan = "Existing" → trigger `employee_service.create_from_application(application_id)`
- [ ] `GET /api/v1/applications/{id}/stages/` — list riwayat tahapan

#### TASK-05.2: Backend Auto-Create Employee (FR-04.4)
- [ ] `employee_service.create_from_application(application_id)`:
  - Ambil data dari `Candidate` terkait
  - Buat `Employee` record: full_name, identity_no, phone_number dari Candidate
  - Set `employee_status = "aktif"`
  - Idempotent: skip jika Employee dengan `application_id` ini sudah ada
  - Return `employee_id`

#### TASK-05.3: Frontend Pipeline
- [ ] Halaman `/applications` — list semua lamaran:
  - Filter: posisi, client, status, tahapan, recruiter, tanggal
  - Setiap baris: nama kandidat, posisi, client, tahapan saat ini, tanggal update, recruiter
  - Link ke detail lamaran
  - Tombol "Buat Lamaran Baru"
- [ ] Halaman `/applications/[id]` — detail lamaran:
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
- [ ] `GET /api/v1/blacklist/` — list blacklist (search nama/email, filter status type)
- [ ] `POST /api/v1/blacklist/` — tambah ke blacklist (HR bisa submit, Manager approve)
- [ ] `PATCH /api/v1/blacklist/{id}/approve` — approve blacklist (Manager only)
- [ ] `PATCH /api/v1/blacklist/{id}/revoke` — cabut blacklist (Manager only)
- [ ] `GET /api/v1/blacklist/check` — query param: email, phone, identity_no → return match atau tidak

#### TASK-06.2: Frontend Blacklist
- [ ] Halaman `/blacklist` — DataTable: nama kandidat, status type, alasan, tanggal, PIC, status approval
  - Filter: status type, status approval
  - Tombol "Tambah ke Blacklist"
- [ ] Halaman `/blacklist/new` — form: pilih kandidat (autocomplete), pilih status type, isi alasan & catatan
- [ ] Manager: tombol "Approve" / "Cabut" di setiap baris

---

### TASK-07: Export Data (FR-06)

#### TASK-07.1: Backend Export
- [ ] `GET /api/v1/export/candidates` — export Excel kandidat dengan filter (posisi, status, periode)
  - Gunakan library `openpyxl` untuk generate file
  - Stream response sebagai file download
- [ ] `GET /api/v1/export/pipeline` — export Excel pipeline per posisi/periode
- [ ] `GET /api/v1/export/incomplete` — export kandidat dengan data belum lengkap

#### TASK-07.2: Frontend Export
- [ ] Komponen `ExportButton` dengan dropdown filter sebelum download
- [ ] Tambahkan tombol export di halaman `/candidates` dan `/applications`

---

### TASK-08: Modul Karyawan / Monitoring Outsource (FR-11)

#### TASK-08.1: Backend Employee
- [ ] `GET /api/v1/employees/` — list karyawan (filter: status, penempatan, contract expiry)
- [ ] `GET /api/v1/employees/{id}` — detail karyawan (tanpa payroll)
- [ ] `PUT /api/v1/employees/{id}` — update data karyawan
- [ ] CRUD `/api/v1/employees/{id}/contracts/` — riwayat kontrak
- [ ] `GET /api/v1/employees/{id}/payroll` — get payroll (Manager + Admin only)
- [ ] `PUT /api/v1/employees/{id}/payroll` — update payroll (Manager + Admin only)
- [ ] CRUD `/api/v1/employees/{id}/documents/` — dokumen karyawan (pola sama dengan dokumen kandidat)
- [ ] Kalkulasi otomatis di response: `age` dari `birth_date`, `contract_duration_running` dari `join_date`

#### TASK-08.2: Frontend Employee
- [ ] Halaman `/employees` — DataTable karyawan:
  - Filter: status, penempatan, contract expiry dalam 30 hari
  - Badge: kontrak hampir habis (< 30 hari)
- [ ] Halaman `/employees/[id]` — detail dengan tab:
  - **Data Pribadi**: info identitas, status, penempatan; usia dihitung & ditampilkan otomatis
  - **Kontrak**: list riwayat kontrak, tombol "Tambah Kontrak Baru"; masa berjalan ditampilkan otomatis
  - **Payroll**: hanya tampil jika role Manager/Admin; form THP, rekening, BPJS, NPWP
  - **Dokumen**: list dokumen + DocumentUploader
- [ ] Setelah auto-create dari Application "Existing": redirect ke `/employees/[id]` dengan toast "Karyawan berhasil dibuat, lengkapi data berikut"

---

### TASK-09: Dashboard Dasar (FR-10 sebagian)

- [ ] Backend: `GET /api/v1/analytics/summary` — return:
  - Total kandidat aktif
  - Total kandidat per tahapan pipeline (grouped)
  - Total karyawan aktif
  - Jumlah kontrak habis dalam 30 hari
- [ ] Frontend `/dashboard`:
  - Card metrics: total kandidat, total karyawan, kandidat di pipeline, kontrak hampir habis
  - Tabel "Lamaran Terbaru" (5 terbaru)
  - Tabel "Kontrak Hampir Habis" (top 5)

---

## FASE 2 — Standarisasi CV

### TASK-10: Generate CV Standar (FR-07)

- [ ] Backend: simpan data template CV di database (atau file konfigurasi)
- [ ] Backend: `POST /api/v1/applications/{id}/cv/generate` — generate CV standar:
  - Gabungkan data kandidat (tanpa PII)
  - Terapkan template Altek
  - Jika foto ada → masukkan ke layout; jika tidak → skip slot foto
  - Simpan hasil ke `generated_cv`, upload file PDF ke OneDrive
- [ ] Backend: `GET /api/v1/applications/{id}/cv/` — list CV yang sudah digenerate
- [ ] Frontend `/applications/[id]/cv`:
  - Preview CV standar
  - Tombol generate/regenerate
  - Pilih bahasa (ID/EN) untuk summary
  - Field input summary manual atau generate AI (Fase 3)
- [ ] Admin: halaman `/admin/cv-templates` — kelola template CV

---

## FASE 3 — AI Screening & Ekstraksi

### TASK-11: Async CV Parsing & AI Extraction (FR-08)

- [ ] Setup `services/n8n_service.py` — kirim webhook ke n8n dengan payload yang diperlukan
- [ ] Buat `routers/internal.py` — endpoint `/internal/ai/extraction-result` (dilindungi shared secret):
  - Terima hasil ekstraksi dari n8n
  - Simpan ke `ai_screening_result`
  - Tandai kandidat perlu review
- [ ] n8n Workflow "CV Parser":
  - Trigger: webhook dari FastAPI
  - Download file dari OneDrive (sementara)
  - Deteksi PDF teks vs scan → PyMuPDF atau Tesseract/PaddleOCR
  - Kirim teks ke LLM API (text-only) → JSON terstruktur
  - POST hasil ke FastAPI `/internal/ai/extraction-result`
  - Hapus file sementara
- [ ] Frontend: komponen `AIExtractionReview`:
  - Tampilkan hasil ekstraksi AI di sebelah form kandidat
  - HR bisa edit tiap field sebelum simpan
  - Tombol "Terapkan Hasil AI" (isi otomatis) atau "Simpan Manual"
  - Badge "Menunggu Review AI" di profil kandidat

### TASK-12: AI Scoring & Matching (FR-08.4)

- [ ] n8n Workflow "AI Screening":
  - Trigger: saat Application baru dibuat
  - Ambil data kandidat + requirement posisi
  - Kirim ke LLM → match score + catatan AI
  - POST ke `/internal/ai/screening-result`
- [ ] Backend: simpan ke `ai_screening_result`
- [ ] Frontend: tampilkan AI score di card kandidat di pipeline view

### TASK-13: AI Draft Project (FR-08.5)

- [ ] Backend: `POST /api/v1/candidates/{id}/ai/draft-projects` — kirim pengalaman kerja ke LLM, return draft
- [ ] Frontend: panel "Draft Project AI" di tab pengalaman kandidat — edit & setujui sebelum masuk CV

### TASK-14: Natural Language Search (FR-09)

- [ ] Backend `services/ai_service.py`:
  - `translate_nl_to_filters(query: str)` → kirim query + skema field ke LLM → return filter JSON
  - `execute_structured_filters(filters: dict)` → terjemahkan ke SQLAlchemy query (bukan raw SQL dari LLM)
- [ ] Endpoint `POST /api/v1/ai/search/` — role Manager only
- [ ] Frontend `/search`:
  - Search bar input teks bebas
  - Tampilkan `filters_applied` (filter yang dipakai AI) — Manager bisa koreksi
  - Hasil: DataTable kandidat yang match

---

## FASE 4 — Analytics

### TASK-15: Dashboard Analytics (FR-10)

- [ ] Backend: endpoint analytics per tahapan/posisi/periode, rasio lolos/gagal User Interview
- [ ] Backend: analisis sederhana: posisi/sumber dengan rasio lolos tertinggi
- [ ] Frontend `/analytics`:
  - Bar chart: kandidat per tahapan
  - Line chart: tren kandidat masuk per bulan
  - Tabel: rasio lolos per posisi dan per sumber channel

---

## TASK Infrastruktur & DevOps (Cross-Fase)

### TASK-16: n8n Automation Lainnya

- [ ] n8n Workflow "Database Backup":
  - Cron trigger harian pukul 02.00
  - Jalankan `pg_dump` di container postgres
  - Upload hasil ke OneDrive folder `/backups/`
- [ ] n8n Workflow "Contract Expiry Alert":
  - Cron trigger harian
  - Query employee dengan kontrak berakhir dalam 30, 14, 7 hari
  - POST ke FastAPI → (Fase selanjutnya) kirim notifikasi ke Manager/HR

### TASK-17: Monitoring & Production Readiness

- [ ] Setup basic monitoring: script cek disk usage, RAM, CPU (bisa via n8n cron atau cron OS)
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
