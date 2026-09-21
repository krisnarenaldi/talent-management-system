# Design — Talent Management System (TMS)
**Client:** Altek
**Versi:** 1.0
**Tanggal:** September 2026

---

## 1. Arsitektur Keseluruhan

### 1.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Browser / Client                              │
│                    Next.js (App Router, SSR/CSR)                     │
└──────────────────────┬───────────────────────────────────────────────┘
                       │ HTTPS (REST API / JSON)
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Nginx (Reverse Proxy, SSL)                       │
│              /api/* → FastAPI   |   /* → Next.js                     │
└──────┬───────────────────────────────────────┬───────────────────────┘
       │                                       │
       ▼                                       ▼
┌─────────────┐                      ┌─────────────────┐
│   FastAPI   │                      │    Next.js      │
│  (Python)   │                      │  (port 3000)    │
│  port 8000  │                      └─────────────────┘
└──────┬──────┘
       │
       ├──▶ PostgreSQL (via PgBouncer)
       │
       ├──▶ Redis (arq job queue)
       │       enqueue CV parsing jobs, cron jobs
       │
       ├──▶ arq Worker (same image as backend)
       │       dequeue & process: PDF parse → LLM → save result
       │       cron: database backup, contract expiry alert
       │
       ├──▶ Microsoft Graph API (OneDrive for Business)
       │       upload/download dokumen kandidat & karyawan
       │
       └──▶ LLM API (Anthropic/OpenAI/Gemini)
               ekstraksi CV, scoring, NL Search (Fase 3)
```

### 1.2 Komponen & Tanggung Jawab

| Komponen | Tanggung Jawab |
|---|---|
| **Next.js** | UI/UX, routing, server-side rendering halaman, form handling, auth session di browser |
| **FastAPI** | REST API, business logic, RBAC enforcement, integrasi Graph API, enqueue arq job |
| **PostgreSQL** | Penyimpanan data relasional (kandidat, aplikasi, karyawan, dll) |
| **PgBouncer** | Connection pooling antara FastAPI/worker dan PostgreSQL |
| **Redis** | Broker antrian job arq — menerima enqueue dari FastAPI, menyimpan job sampai diambil worker |
| **arq Worker** | Async task worker (image sama dengan backend): dequeue job dari Redis → jalankan `process_cv_screening` in-process (tanpa HTTP round-trip), jalankan cron jobs |
| **OneDrive for Business** | File storage dokumen (CV, KTP, KK, dll) via Microsoft Graph API |
| **Nginx** | Reverse proxy, SSL termination (Let's Encrypt), routing /api vs / |

---

## 2. Desain Database

### 2.1 Entity Relationship (ringkas — detail di ERD-TMS.mermaid)

Entitas utama dan relasinya:

```
CANDIDATE ──< CANDIDATE_EDUCATION
CANDIDATE ──< CANDIDATE_EXPERIENCE
CANDIDATE ──< CANDIDATE_DOCUMENT
CANDIDATE ──< GENERATED_CV
CANDIDATE ──< BLACKLIST
CANDIDATE ──< APPLICATION ──< STAGE_HISTORY
                          ──o AI_SCREENING_RESULT
                          ──o EMPLOYEE ──< EMPLOYEE_CONTRACT >── AGREEMENT_TYPE
                                       ──o EMPLOYEE_PAYROLL
                                       ──< EMPLOYEE_DOCUMENT

CLIENT ──< POSITION ──< APPLICATION

USER (menangani APPLICATION, mengupdate STAGE_HISTORY, menandai BLACKLIST)

BLACKLIST_STATUS_TYPE ──< BLACKLIST
AGREEMENT_TYPE ──< EMPLOYEE_CONTRACT
```

### 2.2 Keputusan Desain Penting

| Keputusan | Alasan |
|---|---|
| `Candidate` terpisah dari `Application` | Satu kandidat bisa melamar ke banyak posisi/waktu berbeda tanpa duplikasi data pribadi |
| `Stage_History` menyimpan setiap event (bukan hanya status terakhir) | Audit trail lengkap, history proses bisa dilihat kapan saja |
| Dokumen sebagai baris di `Candidate_Document`/`Employee_Document` | Fleksibel menambah tipe dokumen baru tanpa migrasi skema |
| `Employee` terpisah dari `Candidate` | Merepresentasikan status "sudah jadi karyawan"; rehire tetap tercatat sebagai Employee baru dengan relasi ke Candidate yang sama |
| `Employee_Contract` terpisah | Riwayat perpanjangan kontrak tidak menimpa data lama |
| `Employee_Payroll` terpisah | Kontrol akses lebih ketat (hanya Manager & Admin) tanpa mempengaruhi akses data karyawan umum |
| Usia & masa kontrak tidak disimpan statis | Dihitung otomatis di layer aplikasi dari `birth_date` / `join_date` — selalu akurat |
| `Blacklist_Status_Type` & `Agreement_Type` sebagai master data | Admin bisa tambah/nonaktifkan opsi baru tanpa deployment ulang |
| File tidak disimpan di disk VPS | Semua file ke OneDrive via Graph API; disk lokal hanya untuk file sementara saat parsing |

### 2.3 Konvensi Penamaan
- Tabel: `snake_case` huruf kecil (contoh: `candidate_document`)
- Primary key: `id` bertipe `UUID` (default `gen_random_uuid()`)
- Foreign key: `{tabel_referensi}_id` (contoh: `candidate_id`)
- Timestamp: `created_at`, `updated_at` dengan default `NOW()`
- Kolom boolean: prefix `is_` (contoh: `is_active`, `is_verified`)

---

## 3. Desain API (FastAPI)

### 3.1 URL Structure

```
/api/v1/auth/          → login, logout, refresh token
/api/v1/users/         → CRUD user (Admin only)
/api/v1/clients/       → CRUD Client (Admin)
/api/v1/positions/     → CRUD Position (Admin)
/api/v1/candidates/    → CRUD Candidate, duplikat check, blacklist check
/api/v1/candidates/{id}/documents/    → upload/list/delete dokumen kandidat
/api/v1/candidates/{id}/education/    → CRUD pendidikan
/api/v1/candidates/{id}/experience/   → CRUD pengalaman kerja
/api/v1/applications/                 → CRUD Application
/api/v1/applications/{id}/stages/     → update tahapan, lihat history
/api/v1/applications/{id}/cv/         → generate CV standar (Fase 2)
/api/v1/blacklist/                    → CRUD blacklist
/api/v1/blacklist-status-types/       → CRUD master data status blacklist (Admin)
/api/v1/employees/                    → CRUD Employee
/api/v1/employees/{id}/contracts/     → CRUD kontrak karyawan
/api/v1/employees/{id}/payroll/       → get/update payroll (Manager+Admin only)
/api/v1/employees/{id}/documents/     → upload/list dokumen karyawan
/api/v1/agreement-types/              → CRUD Agreement Type (Admin)
/api/v1/export/candidates/            → export Excel kandidat
/api/v1/export/pipeline/              → export Excel pipeline
/api/v1/analytics/                    → data dashboard (Fase 4)
/api/v1/ai/extract/                   → trigger ekstraksi AI (Fase 3)
/api/v1/ai/search/                    → Natural Language Search (Manager only, Fase 3)
/api/v1/ai/screening/{application_id} → hasil AI screening (Fase 3)
```

### 3.2 Autentikasi & Otorisasi

- **JWT**: access token (15 menit) + refresh token (7 hari), disimpan di httpOnly cookie
- **RBAC Middleware** di FastAPI: setiap endpoint mendefinisikan `allowed_roles`
- Contoh dependency FastAPI:
  ```python
  # Contoh penggunaan di endpoint
  @router.get("/ai/search")
  async def nl_search(query: str, user: User = Depends(require_role("manager"))):
      ...
  ```
- Payroll endpoint: `require_role(["manager", "admin"])`
- Natural Language Search: `require_role("manager")`

### 3.3 Response Format Standar

```json
{
  "success": true,
  "data": { ... },
  "message": "OK",
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 150
  }
}
```

Error response:
```json
{
  "success": false,
  "error": {
    "code": "CANDIDATE_DUPLICATE_SUSPECTED",
    "message": "Kandidat dengan email ini sudah ada dan mungkin duplikat.",
    "detail": { "existing_candidate_id": "uuid-..." }
  }
}
```

---

## 4. Alur Proses Kunci

### 4.1 Upload CV & Async Parsing (Fase 3)

```
[HR Upload CV (bulk)]
      │
      ▼
[Next.js → POST /api/v1/applications/bulk-upload-cv]
      │
      ▼
[FastAPI]
  1. Validasi file (tipe, ukuran)
  2. Upload setiap file ke OneDrive via Graph API
  3. Buat record ai_screening_result (status: menunggu_screening_ai)
  4. Enqueue arq job: redis_pool.enqueue_job("process_cv_screening", screening_result_id)
  5. Return 200 immediately — tidak tunggu proses selesai
      │
      ▼ (via Redis broker)
[arq Worker: process_cv_screening(ctx, screening_result_id)]
  1. Ambil record ai_screening_result dari DB
  2. Download file dari OneDrive (drive_item_id)
  3. Ekstrak teks:
     - PDF berbasis teks → PyMuPDF/pdfplumber
     - PDF scan → Tesseract/PaddleOCR
  4. Validasi teks (< 20 karakter → error)
  5. Ambil ai_scoring_config dari tabel Position
  6. Kirim teks + config ke LLM → dapatkan JSON (nama, pendidikan, pengalaman, skill, skor)
  7. Simpan hasil ke ai_screening_result (status: siap_review)
  8. Hapus file sementara dari disk
  9. Buat notifikasi batch (satu notif per batch, bukan per file)
  ↳ On error: set status "error", simpan pesan error ke ai_notes, commit DB
      │
      ▼
[HR membuka UI Review Ekstraksi AI]
  - Lihat hasil ekstraksi (nama, pendidikan, pengalaman, skill)
  - Edit/koreksi jika ada yang salah
  - Klik "Simpan" → data tersimpan final ke Candidate
```

> **Perubahan dari desain awal:** Alur sebelumnya melewati n8n sebagai HTTP orchestrator (FastAPI → n8n webhook → `/internal/parse-cv` → n8n → LLM API → n8n → `/internal/ai/extraction-result`), menghasilkan 4 HTTP round-trip. Migrasi ke arq menghilangkan seluruh hop eksternal — semua langkah dijalankan sebagai pemanggilan fungsi Python in-process di dalam worker container, dalam satu trust boundary yang sama dengan FastAPI.

### 4.2 Blacklist Check saat Input Kandidat Baru

```
[HR input data kandidat baru]
      │
      ▼
[FastAPI: POST /api/v1/candidates/]
  1. Cek duplikat: email & phone di tabel Candidate
     - Keduanya cocok → tampilkan info kandidat yang ada, tanya apakah tetap buat baru
     - Salah satu cocok → buat baru + flag `possible_duplicate = true`
     - Tidak ada → lanjut normal
  2. Cek blacklist: email / phone / identity_no di tabel Blacklist
     - Ada match → return 200 dengan flag `blacklist_warning = true` + detail blacklist
     - HR/Manager tetap bisa input (warning, bukan hard block)
  3. Simpan Candidate baru
```

### 4.3 Auto-Create Employee dari Application Existing

```
[HR update tahapan Application ke "Existing"]
      │
      ▼
[FastAPI: PATCH /api/v1/applications/{id}/stages/]
  1. Simpan event ke Stage_History
  2. Update Application.current_stage = "Existing", status = "hired"
  3. Cek apakah Employee dengan application_id ini sudah ada
     - Sudah ada → skip (idempotent)
     - Belum ada → buat Employee record baru:
         full_name, identity_no, phone_number ← dari Candidate
         application_id, candidate_id ← dari Application
         employee_status = "aktif"
  4. Return response dengan employee_id baru
      │
      ▼
[HR melengkapi data Employee]
  - Buka halaman detail Employee (tab Data Pribadi / Kontrak / Payroll / Dokumen)
  - Isi data yang belum ada (email kantor, penempatan, NIP, kontrak, dll)
```

### 4.4 Natural Language Search (Fase 3)

```
[Manager input query: "Backend Developer Laravel 3 tahun pernah pimpin tim"]
      │
      ▼
[FastAPI: POST /api/v1/ai/search/]
  1. Validasi role = Manager
  2. Kirim query + skema field yang tersedia ke LLM API
     Prompt sistem: "Terjemahkan query ke filter JSON menggunakan field berikut: ..."
  3. LLM return JSON filter:
     {
       "position_title_contains": "Backend Developer",
       "skills_include": ["Laravel"],
       "experience_years_min": 3,
       "had_leadership_role": true
     }
  4. FastAPI terjemahkan JSON filter → SQL query (aman, tidak pakai raw SQL dari LLM)
  5. Eksekusi query, return daftar kandidat
  6. Sertakan `filters_applied` di response untuk transparansi
```

---

## 5. Desain Frontend (Next.js)

### 5.1 Struktur Halaman

```
/login                          → halaman login
/dashboard                      → ringkasan metrik (semua role)

/candidates                     → daftar kandidat (search, filter)
/candidates/new                 → form tambah kandidat
/candidates/[id]                → detail kandidat (tab: Profil / Dokumen / Lamaran / Riwayat)
/candidates/[id]/edit           → edit data kandidat

/applications                   → daftar semua lamaran (pipeline view)
/applications/[id]              → detail lamaran + update tahapan
/applications/[id]/cv           → preview & generate CV standar (Fase 2)

/employees                      → daftar karyawan aktif
/employees/[id]                 → detail karyawan (tab: Data Pribadi / Kontrak / Payroll / Dokumen)
/employees/[id]/edit            → edit data karyawan

/blacklist                      → daftar blacklist
/blacklist/new                  → form tambah blacklist

/analytics                      → dashboard analytics (Fase 4)

/search                         → Natural Language Search (Manager only, Fase 3)

/admin/users                    → kelola user
/admin/clients                  → kelola client
/admin/positions                → kelola posisi
/admin/blacklist-status-types   → kelola jenis status blacklist
/admin/agreement-types          → kelola jenis perjanjian
/admin/cv-templates             → kelola template CV

/settings                       → pengaturan akun
```

### 5.2 Komponen UI Utama

| Komponen | Deskripsi |
|---|---|
| `PipelineBoard` | Kanban/list view pipeline rekrutmen per Application |
| `StageUpdateForm` | Form dinamis berdasarkan tahapan (field berbeda per tahap) |
| `CandidateForm` | Form multi-section: Data Pribadi / Pendidikan / Pengalaman |
| `DocumentUploader` | Drag-and-drop upload dengan progress indicator, preview dokumen |
| `DuplicateWarningBanner` | Banner kuning saat kandidat terdeteksi mungkin duplikat |
| `BlacklistWarningModal` | Modal merah saat kandidat match blacklist, dengan detail alasan |
| `EmployeeTabView` | Tab: Data Pribadi / Kontrak / Payroll / Dokumen |
| `AIExtractionReview` | Side-by-side: hasil AI vs form input; HR bisa edit sebelum simpan |
| `NLSearchBar` | Input teks + tampilkan filter yang dipakai AI (Manager only) |
| `ExportButton` | Trigger export Excel dengan pilihan filter |
| `DataTable` | Tabel data dengan pagination, sorting, filter kolom |

### 5.3 State Management & Data Fetching

- **Server Components** (Next.js App Router) untuk data fetching halaman utama
- **React Query (TanStack Query)** untuk client-side data fetching, caching, dan mutation
- **Zustand** untuk global UI state (sidebar open/close, notifikasi, dll)
- **React Hook Form + Zod** untuk form validation
- Tidak ada Redux — terlalu berat untuk skala aplikasi ini

### 5.4 Auth Flow di Frontend

```
Login → POST /api/v1/auth/login
     ← Set httpOnly cookie: access_token, refresh_token

Setiap request → Next.js middleware cek cookie
  - Token valid → lanjut
  - Token expired → auto-refresh via /api/v1/auth/refresh
  - Refresh expired → redirect ke /login

Route protection: Next.js middleware + server component check
Role-based UI: komponen/menu hanya ditampilkan jika role sesuai
(tapi enforcement tetap di backend — UI bersifat UX saja)
```

---

## 6. Desain Async Processing (arq + Redis)

> **Catatan arsitektur:** Desain awal (v1.0) menggunakan n8n sebagai async orchestrator antara FastAPI dan pipeline CV parsing. Setelah evaluasi, n8n digantikan dengan arq + Redis karena: (1) seluruh alur hanya memanggil service milik sendiri — tidak ada integrasi SaaS pihak ketiga yang menjadi nilai tambah n8n; (2) 4 HTTP round-trip diganti 1 pemanggilan fungsi in-process, menghilangkan 1 network hop dan 1 service yang perlu dijaga uptime-nya; (3) error handling & retry lebih matang di ekosistem Python (tenacity, pytest, logging konsisten); (4) overhead operasional n8n (setup, shared secret, JSON workflow di git) tidak sebanding untuk pipeline yang sifatnya linear.

### 6.1 Komponen Async

| Komponen | Peran |
|---|---|
| **Redis** | Broker antrian job (image `redis:7-alpine`). FastAPI enqueue job, worker dequeue dan jalankan |
| **arq Worker** | Proses terpisah (`arq app.worker.WorkerSettings`), image sama dengan backend. Menjalankan task functions dan cron jobs |
| **`app/worker.py`** | Mendefinisikan `WorkerSettings`: daftar `functions`, `cron_jobs`, `redis_settings`, `max_jobs`, `job_timeout` |
| **`services/cv_pipeline.py`** | Implementasi `process_cv_screening(ctx, screening_result_id)` — menggantikan seluruh 8 node n8n |
| **`services/ops_jobs.py`** | Implementasi `backup_database(ctx)` dan `check_contract_expiry(ctx)` — menggantikan n8n cron workflows |
| **`app/core/arq_pool.py`** | Helper `get_redis_pool()` — return ArqRedis pool, dipakai di endpoint `bulk-upload-cv` |

### 6.2 Alur Enqueue dari FastAPI ke Worker

```
FastAPI (bulk-upload-cv)
  └─▶ redis_pool.enqueue_job("process_cv_screening", screening_result_id)
           │
           ▼ (via Redis broker)
      arq Worker
        └─▶ process_cv_screening(ctx, screening_result_id)
              ├─ download OneDrive file          [fungsi Python]
              ├─ extract_text(raw_file)          [fungsi Python]
              ├─ get ai_scoring_config from DB   [SQLAlchemy]
              ├─ call_llm(text, config)          [fungsi Python]
              ├─ save result to DB               [SQLAlchemy commit]
              └─ create_batch_notification(...)  [fungsi Python]
```

Tidak ada HTTP keluar dari worker ke FastAPI. Semua operasi adalah pemanggilan fungsi atau query DB langsung, dalam trust boundary container yang sama.

### 6.3 Cron Jobs di Worker

```python
# app/worker.py
class WorkerSettings:
    functions = [process_cv_screening]
    cron_jobs = [
        cron(backup_database,      hour=2, minute=0),  # harian 02.00 WIB
        cron(check_contract_expiry, hour=8, minute=0), # harian 08.00 WIB
    ]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_jobs = 10
    job_timeout = 300  # detik, per CV
```

### 6.4 Variabel Environment yang Berubah

| Sebelumnya (n8n) | Sekarang (arq) |
|---|---|
| `N8N_WEBHOOK_URL=...` | `REDIS_URL=redis://redis:6379/0` |
| `N8N_ENCRYPTION_KEY=...` | *(dihapus)* |
| `N8N_INTERNAL_SECRET=...` | *(dihapus)* |

> **File historis n8n:** `n8n/workflows/cv-parser.json` dan `n8n/README.md` diarsipkan di `n8n/archive/` sebagai referensi historis sampai migrasi tervalidasi di production.

---

## 7. Desain Keamanan

| Aspek | Implementasi |
|---|---|
| **Autentikasi** | JWT httpOnly cookie, bukan localStorage (mencegah XSS) |
| **Otorisasi** | RBAC di FastAPI dependency injection, bukan hanya di UI |
| **File upload** | Validasi tipe MIME & ukuran di FastAPI sebelum dikirim ke OneDrive |
| **SQL Injection** | SQLAlchemy ORM / parameterized queries — tidak ada raw SQL dari input user |
| **AI ↔ DB** | LLM hanya menghasilkan filter JSON terstruktur, bukan raw SQL (lihat FR-09.2) |
| **Internal API** | `/internal/*` dilindungi shared secret, diblock Nginx dari akses luar |
| **Payroll data** | Endpoint payroll hanya bisa diakses role Manager & Admin |
| **Dokumen sensitif** | Akses via pre-authenticated URL (sementara, kedaluwarsa otomatis), bukan URL permanen |
| **Environment secrets** | Semua credential (DB password, Graph API secret, LLM API key) di `.env`, tidak pernah di-commit ke git |
| **CORS** | FastAPI CORS dibatasi ke domain frontend saja |

---

## 8. Struktur Folder Project

```
Talent Management System/
├── frontend/                   # Next.js App
│   ├── src/
│   │   ├── app/                # App Router pages & layouts
│   │   │   ├── (auth)/
│   │   │   │   └── login/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── candidates/
│   │   │   │   ├── applications/
│   │   │   │   ├── employees/
│   │   │   │   ├── blacklist/
│   │   │   │   ├── analytics/
│   │   │   │   ├── search/
│   │   │   │   └── admin/
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── ui/             # Komponen dasar (Button, Input, Table, Modal, dll)
│   │   │   ├── candidates/     # Komponen spesifik kandidat
│   │   │   ├── applications/   # Komponen pipeline & tahapan
│   │   │   ├── employees/      # Komponen karyawan
│   │   │   └── shared/         # Komponen lintas modul (DataTable, DocumentUploader, dll)
│   │   ├── lib/
│   │   │   ├── api.ts          # Axios/fetch wrapper ke FastAPI
│   │   │   ├── auth.ts         # Auth helpers
│   │   │   └── utils.ts
│   │   ├── hooks/              # Custom React hooks
│   │   ├── stores/             # Zustand stores
│   │   ├── types/              # TypeScript type definitions
│   │   └── middleware.ts       # Next.js route protection middleware
│   ├── public/
│   ├── .env.local
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                    # FastAPI App
│   ├── app/
│   │   ├── main.py             # Entry point, CORS, router registration
│   │   ├── core/
│   │   │   ├── config.py       # Settings dari environment variables
│   │   │   ├── security.py     # JWT, password hashing
│   │   │   └── dependencies.py # FastAPI dependencies (get_db, require_role, dll)
│   │   ├── models/             # SQLAlchemy ORM models
│   │   │   ├── candidate.py
│   │   │   ├── application.py
│   │   │   ├── employee.py
│   │   │   ├── user.py
│   │   │   └── ...
│   │   ├── schemas/            # Pydantic schemas (request/response)
│   │   │   ├── candidate.py
│   │   │   ├── application.py
│   │   │   └── ...
│   │   ├── routers/            # FastAPI routers per modul
│   │   │   ├── auth.py
│   │   │   ├── candidates.py
│   │   │   ├── applications.py
│   │   │   ├── employees.py
│   │   │   ├── blacklist.py
│   │   │   ├── export.py
│   │   │   ├── ai.py
│   │   │   ├── analytics.py
│   │   │   ├── admin.py
│   │   │   └── internal.py     # Endpoint untuk n8n callback (dilindungi shared secret)
│   │   ├── services/           # Business logic layer
│   │   │   ├── candidate_service.py
│   │   │   ├── application_service.py
│   │   │   ├── employee_service.py
│   │   │   ├── blacklist_service.py
│   │   │   ├── onedrive_service.py   # Microsoft Graph API integration
│   │   │   ├── n8n_service.py        # Trigger n8n webhooks
│   │   │   ├── ai_service.py         # LLM API integration (Fase 3)
│   │   │   └── export_service.py     # Excel export
│   │   └── db/
│   │       ├── database.py     # SQLAlchemy engine & session
│   │       └── migrations/     # Alembic migration files
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── .env
│   └── Dockerfile
│
├── docs/
│   ├── PRD-Talent-Management-System.md
│   ├── ERD-TMS.mermaid
│   └── ...
│
├── .kiro/
│   └── specs/
│       ├── requirements.md
│       ├── design.md           ← file ini
│       └── tasks.md
│
├── docker-compose.yml          # Orchestrasi semua service
├── nginx.conf                  # Konfigurasi reverse proxy
└── .env.example                # Template environment variables
```

---

## 9. Docker Compose Service Layout

```yaml
# Gambaran services (detail di docker-compose.yml)
services:
  postgres:       # PostgreSQL 16
  pgbouncer:      # Connection pooling
  backend:        # FastAPI (Dockerfile di backend/)
  frontend:       # Next.js (Dockerfile di frontend/)
  redis:          # Redis 7-alpine — broker arq job queue
  worker:         # arq worker (image sama dengan backend, command: arq app.worker.WorkerSettings)
  nginx:          # Reverse proxy

volumes:
  postgres_data:  # Data PostgreSQL
  redis_data:     # Persistensi Redis (RDB snapshot)

# File dokumen TIDAK disimpan di volume lokal
# → semua ke OneDrive via Graph API

# Catatan: service n8n dan volume n8n_data dihapus sejak migrasi ke arq (lihat Bagian 6)
```

---

## 10. Keputusan Teknis yang Perlu Dikonfirmasi Sebelum Mulai Coding

| # | Keputusan | Default jika tidak dikonfirmasi |
|---|---|---|
| 1 | Model LLM yang dipakai (Claude Haiku / Sonnet / GPT / Gemini)? | Claude Haiku 4.5 (paling murah) |
| 2 | Template CV standar Altek (format/layout)? | Dibuat placeholder dulu di Fase 2 |
| 3 | Nama domain / subdomain untuk deployment? | Bisa pakai IP sementara saat development |
| 4 | Admin M365 untuk registrasi aplikasi di Microsoft Entra? | Ditunda, gunakan local storage sementara di Fase 1 |
| 5 | Channel notifikasi (email/WhatsApp/Slack)? | Tidak diimplementasi dulu di Fase 1 |
