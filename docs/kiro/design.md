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
       ├──▶ Microsoft Graph API (OneDrive for Business)
       │       upload/download dokumen kandidat & karyawan
       │
       ├──▶ n8n (Webhook Trigger)
       │       antrian async: PDF parsing, AI ekstraksi, notifikasi
       │
       └──▶ LLM API (Anthropic/OpenAI/Gemini)
               ekstraksi CV, scoring, NL Search (Fase 3)
```

### 1.2 Komponen & Tanggung Jawab

| Komponen | Tanggung Jawab |
|---|---|
| **Next.js** | UI/UX, routing, server-side rendering halaman, form handling, auth session di browser |
| **FastAPI** | REST API, business logic, RBAC enforcement, integrasi Graph API, trigger n8n webhook |
| **PostgreSQL** | Penyimpanan data relasional (kandidat, aplikasi, karyawan, dll) |
| **PgBouncer** | Connection pooling antara FastAPI/n8n/Next.js (API routes) dan PostgreSQL |
| **n8n** | Async workflow: terima webhook dari FastAPI → jalankan parsing PDF / OCR / AI call → kirim hasil balik ke FastAPI endpoint |
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
[HR Upload CV]
      │
      ▼
[Next.js → POST /api/v1/candidates/{id}/documents/]
      │
      ▼
[FastAPI]
  1. Validasi file (tipe, ukuran)
  2. Upload file ke OneDrive via Graph API
  3. Simpan referensi (file_url) ke Candidate_Document
  4. Jika doc_type = "CV_asli" → trigger webhook n8n
  5. Return response 202 Accepted (proses async, belum selesai)
      │
      ▼
[n8n Workflow: CV Parser]
  1. Terima webhook payload (candidate_id, file_url)
  2. Download file sementara dari OneDrive
  3. Cek apakah PDF berbasis teks atau scan
     - Jika teks: PyMuPDF/pdfplumber → ekstrak teks
     - Jika scan: OCR dengan Tesseract/PaddleOCR → teks
  4. Kirim teks ke LLM API → dapatkan JSON terstruktur
  5. POST hasil ke FastAPI /internal/ai/extraction-result
  6. Hapus file sementara dari disk
      │
      ▼
[FastAPI /internal/ai/extraction-result]
  1. Simpan hasil ke AI_Screening_Result
  2. Tandai kandidat: "hasil ekstraksi menunggu review HR"
      │
      ▼
[HR membuka UI Review Ekstraksi AI]
  - Lihat hasil ekstraksi (nama, pendidikan, pengalaman, skill)
  - Edit/koreksi jika ada yang salah
  - Klik "Simpan" → data tersimpan final ke Candidate
```

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

## 6. Desain Integrasi n8n

### 6.1 Workflow yang Direncanakan

| Workflow | Trigger | Aksi |
|---|---|---|
| **CV Parser** | Webhook dari FastAPI (saat CV diupload) | Download CV, ekstrak teks (PyMuPDF/OCR), kirim ke LLM, kirim hasil ke FastAPI |
| **AI Screening** | Webhook dari FastAPI (saat Application dibuat) | Ambil data kandidat + requirement posisi, kirim ke LLM untuk scoring, simpan AI_Screening_Result |
| **Blacklist Notif** | Webhook saat kandidat ditambah ke blacklist | Kirim notifikasi ke channel internal (opsional: email/Slack/WhatsApp) |
| **Database Backup** | Cron (setiap hari pukul 02.00) | Jalankan `pg_dump`, upload hasil ke OneDrive |
| **Contract Expiry Alert** | Cron (setiap hari) | Cek kontrak yang berakhir dalam 30/14/7 hari, kirim reminder ke Manager/HR |

### 6.2 Komunikasi FastAPI ↔ n8n

```
FastAPI → n8n  : HTTP POST ke n8n webhook URL (payload: job data)
n8n → FastAPI  : HTTP POST ke /internal/* endpoint (hasil processing)

Internal endpoints dilindungi dengan shared secret header:
X-Internal-Secret: {env variable}
Tidak bisa diakses dari luar VPS (Nginx block rule)
```

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
  n8n:            # n8n self-hosted
  nginx:          # Reverse proxy

volumes:
  postgres_data:  # Data PostgreSQL
  n8n_data:       # Workflow & credential n8n

# File dokumen TIDAK disimpan di volume lokal
# → semua ke OneDrive via Graph API
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
