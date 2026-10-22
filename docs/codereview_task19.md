# Code Review — TASK-19 (Backend Services & API Endpoints v2.0)

> Reviewed: 2026-10-20 | Reviewer: Antigravity AI
> Remediasi: 2026-10-20 | 모든 finding sudah diperbaiki & diverifikasi

---

## Ringkasan Eksekutif

| Kategori | Status |
|---|---|
| Syntax (py_compile) | ✅ Semua file OK |
| Security / RBAC | ✅ 1 isu kritis, 1 isu sedang — sudah diperbaiki |
| Logic / Correctness | ✅ 2 bug nyata — sudah diperbaiki |
| Token Cost Control | ✅ Two-Stage sudah benar |
| Worker Registration | ✅ `process_cv_ingestion` + `process_position_matching` terdaftar |
| Schema Import | ✅ 1 NameError saat runtime — sudah diperbaiki |
| Import seluruh router | ✅ `app.main` import OK, 115 path OpenAPI ter-generate |

### Status Remediasi

| ID | Temuan | Severity | Status | Perbaikan |
|---|---|---|---|---|
| BUG-1 | `RecommendCandidateItem` tidak di-import di `positions.py` | 🔴 Kritis | ✅ Sudah ada (sebelum review ini) | `backend/app/routers/positions.py:15` |
| BUG-2 | `process_position_matching` di-enqueue tapi tidak terdaftar di worker | 🔴 Kritis | ✅ **Diperbaiki** | Task dibuat di `backend/app/services/cv_pipeline.py`, didaftarkan di `backend/app/worker.py:29`, enqueue diaktifkan kembali di `backend/app/routers/candidates.py` |
| SEC-1 | `bulk-assign` memakai `get_current_user` bukan `require_role` | ⚠️ Sedang | ✅ Sudah ada (sebelum review ini) | `backend/app/routers/candidates.py:484` |
| MINOR-1 | Pesan error extension tidak konsisten di `bulk-upload` | ⚠️ Minor | ✅ Sudah ada (sebelum review ini) | `backend/app/routers/candidates.py:381` |
| MINOR-2 | Cooldown memakai `timedelta(days=6*30)` | ⚠️ Minor | ✅ Sudah ada (sebelum review ini) | `backend/app/routers/candidates.py:501` |
| BUG-3 *(temuan baru saat remediasi)* | `BulkAssignRequest` tidak di-import di `candidates.py` → **seluruh aplikasi gagal start** | 🔴 Kritis | ✅ **Diperbaiki** | Import ditambah di `backend/app/routers/candidates.py:21` |

> [!IMPORTANT]
> **BUG-3 (temuan baru):** Saat memverifikasi BUG-1, ditemukan bug yang lebih berat di `backend/app/routers/candidates.py` — `BulkAssignRequest` tidak ada di blok import. Karena file tersebut tidak memakai `from __future__ import annotations`, anotasi fungsi dievaluasi saat import → `NameError` → modul `app.routers.candidates` gagal di-import → **seluruh aplikasi FastAPI gagal start** (`app.main` ikut gagal). Semua endpoint `/api/v1/candidates/*` mati. Bug ini tidak tertangkap di review awal karena sintaksnya valid.
>
> Verifikasi remedial: seluruh modul router di-import satu per satu + `app.main` + generate OpenAPI schema (115 path).

---

## 🔴 BUG KRITIS — Harus Diperbaiki

### BUG-1: `RecommendCandidateItem` tidak diimport di `positions.py`

> ✅ **STATUS: SUDAH TERPERBAIKI** — `RecommendCandidateItem` sudah ada di blok import (`backend/app/routers/positions.py:15`). Verifikasi: `app.main` import OK + OpenAPI schema untuk `/api/v1/positions/{position_id}/recommend-candidates` ter-generate tanpa error.

**File:** [`backend/app/routers/positions.py`](file:///Users/krisnarenaldi/Documents/Projects/freelance/Talent%20Management%20System/backend/app/routers/positions.py#L8-L18)

**Problem:** Baris 178 menggunakan `RecommendCandidateItem(...)` tapi class ini tidak ada di blok import (baris 8-17). Hanya `RecommendCandidatesResponse` dan `RecommendCandidatesRequest` yang diimport. 

Akibat: endpoint `POST /{position_id}/recommend-candidates` akan **crash dengan `NameError`** saat pertama kali dipanggil.

```python
# ❌ Baris 8-17 saat ini — RecommendCandidateItem tidak ada di sini
from app.schemas.position import (
	ExtractCriteriaRequest,
	ExtractCriteriaResponse,
	PositionCreate,
	PositionResponse,
	PositionUpdate,
	PositionsByClientResponse,
	RecommendCandidatesRequest,
	RecommendCandidatesResponse,
)
```

**Fix:**
```python
# ✅ Tambahkan RecommendCandidateItem ke import
from app.schemas.position import (
	ExtractCriteriaRequest,
	ExtractCriteriaResponse,
	PositionCreate,
	PositionResponse,
	PositionUpdate,
	PositionsByClientResponse,
	RecommendCandidateItem,           # ← tambahkan ini
	RecommendCandidatesRequest,
	RecommendCandidatesResponse,
)
```

---

### BUG-2: `process_position_matching` diqueue tapi tidak terdaftar di worker

> ✅ **STATUS: SUDAH DIPERBAIKI (Opsi B)** — task worker dibuat, didaftarkan, dan enqueue diaktifkan kembali.

**File:** [`backend/app/routers/candidates.py`](file:///Users/krisnarenaldi/Documents/Projects/freelance/Talent%20Management%20System/backend/app/routers/candidates.py) dan [`backend/app/worker.py`](file:///Users/krisnarenaldi/Documents/Projects/freelance/Talent%20Management%20System/backend/app/worker.py)

**Problem:** Di `bulk-assign`, ketika `effective_run_ai == True`, kode mengantrekan job bernama `"process_position_matching"`:
```python
await redis.enqueue_job("process_position_matching", str(application.id))
```

Namun di `worker.py`, daftar functions hanya berisi:
```python
functions = [process_cv_ingestion, process_cv_screening]
```

Fungsi `process_position_matching` **tidak ada** — baik tidak terdaftar maupun tidak dibuat sebagai task. Arq akan membuang job ini secara diam-diam.

**Fix yang diterapkan (Opsi B):**

1. **Task baru** `process_position_matching(ctx, application_id)` di `backend/app/services/cv_pipeline.py`:
   - Ambil `Application` → `Candidate` → `Position` dari DB.
   - Susun ringkasan profil kandidat (`_build_candidate_profile`) dengan struktur yang sama seperti hasil ekstraksi LLM — **tidak perlu membaca file CV**, sehingga hemat token dan tidak bergantung pada file yang sudah tidak tersedia.
   - Panggil `_call_llm_screen(...)` → menghasilkan `ai_score` + `ai_notes`.
   - Simpan/upsert `AIScreeningResult` yang tertaut ke Application (`status`: `sedang_diproses` → `siap_review`, atau `error` bila LLM gagal).
   - Kirim notifikasi ke recruiter dengan link ke `/applications/{id}`.
2. **Registrasi worker** di `backend/app/worker.py`:
   ```python
   functions = [process_cv_ingestion, process_cv_screening, process_position_matching]
   ```
3. **Enqueue diaktifkan kembali** di `backend/app/routers/candidates.py` — job di-enqueue **setelah** `db.commit()` agar record `Application` sudah tersimpan:
   ```python
   if effective_run_ai:
       matching_job_ids.append(str(application.id))
   # ... setelah db.commit():
   redis = await get_redis_pool()
   for app_id in matching_job_ids:
       await redis.enqueue_job("process_position_matching", app_id)
   ```
   Kegagalan enqueue di-log (`logger.warning`) tanpa menggagalkan assign.

**Test:** `backend/tests/test_position_matching_worker.py` (5 test — registrasi worker, hitung total experience, jalur sukses, jalur error LLM, aplikasi tidak ditemukan).

---

## ⚠️ ISU KEAMANAN SEDANG

### SEC-1: `bulk-assign` menggunakan `get_current_user` bukan `require_role`

> ✅ **STATUS: SUDAH TERPERBAIKI** — sudah memakai `require_role("hr", "manager", "admin")` (`backend/app/routers/candidates.py:484`).

**File:** [`backend/app/routers/candidates.py`](file:///Users/krisnarenaldi/Documents/Projects/freelance/Talent%20Management%20System/backend/app/routers/candidates.py)

```python
# ⚠️ Saat ini
@router.post("/bulk-assign", response_model=BulkAssignResponse)
async def bulk_assign_candidates(
	payload: BulkAssignRequest,
	db: Session = Depends(get_db),
	current_user=Depends(get_current_user),   # ← hanya autentikasi, tidak ada role check
):
```

RBAC override untuk HR memang ada di body function (baris 491-492), tapi endpoint bisa diakses user dengan **role apapun** termasuk role yang belum ditentukan di sistem, atau jika ada bug di `get_current_user` yang tidak raise exception.

**Fix yang direkomendasikan:** Ganti menjadi `require_role("hr", "manager", "admin")` agar hanya role yang dikenal yang bisa akses, sesuai pola endpoint lain.

```python
# ✅ Ganti dependency
current_user=Depends(require_role("hr", "manager", "admin")),
```

> [!NOTE]
> HR override di baris 491-492 tetap harus ada — ini adalah **layer ke-2** (server-side hard override). `require_role` adalah **layer ke-1** (autorizasi role). Keduanya perlu.

---

## ⚠️ ISU MINOR — Harus Diperbaiki

### MINOR-1: Error message tidak konsisten di `bulk-upload` file extension check

> ✅ **STATUS: SUDAH TERPERBAIKI** — pesan sudah "hanya PDF atau DOCX" (`backend/app/routers/candidates.py:381`).

**File:** [`backend/app/routers/candidates.py`](file:///Users/krisnarenaldi/Documents/Projects/freelance/Talent%20Management%20System/backend/app/routers/candidates.py)

Docstring dan `ALLOWED_EXTENSIONS` menyebutkan PDF **dan** DOCX, tapi pesan error hanya menyebut "hanya PDF":

```python
ALLOWED_EXTENSIONS = {".pdf", ".docx"}   # ← benar
# ...
errors.append(f"{file.filename}: format tidak didukung (hanya PDF)")  # ← salah/menyesatkan
```

**Fix:**
```python
errors.append(f"{file.filename}: format tidak didukung (hanya PDF atau DOCX)")
```

---

### MINOR-2: Cooldown check di `bulk-assign` menggunakan `timedelta(days=6*30)` bukan 180 hari tetap

> ✅ **STATUS: SUDAH TERPERBAIKI** — sudah konsisten memakai `timedelta(days=180)` (`backend/app/routers/candidates.py:501`).

**File:** [`backend/app/routers/candidates.py`](file:///Users/krisnarenaldi/Documents/Projects/freelance/Talent%20Management%20System/backend/app/routers/candidates.py)

```python
six_months_ago = now - timedelta(days=6*30)  # approx 6 months = 180 hari
```

Di `ai_service.py` (Two-Stage Matching), cooldown sudah benar menggunakan `timedelta(days=180)`. Keduanya sama hasilnya (180 hari), tapi untuk konsistensi:

```python
six_months_ago = now - timedelta(days=180)
```

---

## ✅ Yang Sudah Benar

### RBAC HR Override (TASK-19.3)
```python
# ✅ Hard override ada di server-side — baris 490-492
effective_run_ai = payload.run_ai_screening
if getattr(current_user, "role", None) == "hr":
effective_run_ai = False
```
Logic benar. `getattr(..., None)` aman terhadap None. Override dilakukan **sebelum** apapun dieksekusi.

### Two-Stage Matching (TASK-19.4)
- ✅ SQL filter dijalankan **sebelum** LLM dipanggil (baris 611-658)
- ✅ `limit_stage1=50` → `limit_stage2=15` — LLM hanya menerima max 15 kandidat, bukan seluruh DB
- ✅ Filter salary: `expected_salary <= position.salary_budget OR expected_salary IS NULL` — benar, tidak membuang kandidat yang belum isi gaji
- ✅ Filter location menggunakan `ilike` — case-insensitive
- ✅ Exclude blacklist + exclude employee + cooldown 180 hari semua ada

### `process_cv_ingestion` Worker Task (TASK-19.1)
- ✅ Terdaftar di `worker.py` line 25: `functions = [process_cv_ingestion, process_cv_screening]`
- ✅ **Tidak memanggil `_call_llm_screen`** — hanya `_call_llm_extract`, sesuai arsitektur (ingestion tanpa posisi)
- ✅ Menyimpan ke `Candidate`, `CandidateEducation`, `CandidateExperience`, `CandidateDocument`
- ✅ Status akhir: `"selesai"` atau `"error"` (bukan `"siap_review"` — berbeda dari `process_cv_screening`)
- ✅ Blacklist check + duplicate check sebelum membuat Candidate baru
- ✅ `pool_status="database"` — kandidat baru dari ingestion langsung masuk pool database (benar)

### `PATCH /{candidate_id}/talent-pool` (TASK-19.2)
- ✅ Menggunakan `CandidateTalentPoolUpdate` schema
- ✅ Set `talent_pool_updated_by = current_user.id`
- ✅ Set `talent_pool_updated_at = datetime.now(timezone.utc)`
- ✅ Validasi enum nilai `pool_status`

### `pool_status` filter di `GET /candidates/` (TASK-19.2)
- ✅ Filter `pool_status=all` diabaikan (tidak memfilter)
- ✅ Filter `pool_status=talent_pool`, `database`, `future_lead` diterapkan

### Bulk Upload File Validation (TASK-19.1)
- ✅ Extension check **sebelum** `await file.read()` — **WAIT**, sebenarnya extension dicek dulu, baru `read()`. Ini sudah benar (validasi sebelum membaca byte).
- ✅ Ukuran dicek setelah `read()` — tidak bisa dihindari tanpa streaming
- ✅ Max 20 file per request
- ✅ Max 5MB per file
- ✅ Error file tidak menghentikan proses — file lain tetap diproses (`continue`)

### `ai_service.py` — `recommend_candidates_for_position`
- ✅ Tidak ada SQL raw
- ✅ Menggunakan `sa_select` untuk subquery (bukan inline `.subquery()`)
- ✅ Fallback jika LLM gagal (return stage 1 candidates tanpa skor)
- ✅ `scored_map` merge aman (hanya kandidat dengan skor yang dimasukkan ke `results`)

---

## 🔴 BUG-3 (temuan baru saat remediasi) — `BulkAssignRequest` tidak di-import

**File:** [`backend/app/routers/candidates.py`](file:///Users/krisnarenaldi/Documents/Projects/freelance/Talent%20Management%20System/backend/app/routers/candidates.py#L20-L39)

**Problem:** `BulkAssignRequest` dipakai sebagai anotasi parameter pada `bulk_assign_candidates` tetapi tidak ada di blok import `app.schemas.candidate`. File tersebut **tidak** memakai `from __future__ import annotations`, sehingga anotasi dievaluasi pada saat modul di-import:

```
NameError: name 'BulkAssignRequest' is not defined
```

**Akibat:** modul `app.routers.candidates` gagal di-import → seluruh aplikasi FastAPI gagal start (`app.main` mengimpor semua router). Semua endpoint `/api/v1/candidates/*` — termasuk `bulk-upload`, `bulk-assign`, `talent-pool`, dokumen, pendidikan, pengalaman — mati total. Sintaksnya valid, sehingga tidak tertangkap oleh pemeriksaan sintaks.

**Fix:**
```python
from app.schemas.candidate import (
    BulkAssignRequest,      # ← tambahkan ini
    BulkAssignResponse,
    BulkUploadResponse,
    ...
)
```

**Verifikasi:**
```bash
# import setiap router satu per satu
python -c "import app.main; print(len(app.main.app.openapi()['paths']))"
# → 115 path, tanpa error
```

---

## Checklist Perbaikan yang Harus Dilakukan

- [x] **BUG-1:** Tambah `RecommendCandidateItem` ke import di `positions.py` — *sudah ada*
- [x] **BUG-2:** `process_position_matching` — **task dibuat + didaftarkan di worker + enqueue diaktifkan kembali**
- [x] **SEC-1:** Ganti `get_current_user` → `require_role("hr", "manager", "admin")` di `bulk-assign` — *sudah ada*
- [x] **MINOR-1:** Perbaiki pesan error extension di `bulk-upload` — *sudah ada*
- [x] **MINOR-2:** Konsistenkan `timedelta(days=6*30)` → `timedelta(days=180)` — *sudah ada*
- [x] **BUG-3 (baru):** Tambah `BulkAssignRequest` ke import di `candidates.py` — *seluruh app bisa start lagi*

### Verifikasi akhir

```bash
# 1. Import seluruh router + app
python -c "import app.main; print(len(app.main.app.openapi()['paths']))"   # → 115

# 2. Static check undefined name
pyflakes app/ | grep "undefined name"                                      # → tidak ada

# 3. Test suite
pytest tests/ -q                                                          # → 31 passed, 2 failed (pre-existing)
```

> [!NOTE]
> Dua kegagalan test yang tersisa **sudah ada sebelum remediasi** dan tidak berkaitan dengan TASK-19:
> - `tests/test_export.py` — ekspektasi nama sheet "Candidates" vs implementasi "Kandidat".
> - `tests/test_file_routes.py` — `OSError: Read-only file system: '/uploads'` (lingkungan macOS).