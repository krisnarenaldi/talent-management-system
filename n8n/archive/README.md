# n8n Workflows — TMS (Talent Management System)

Folder ini berisi semua workflow n8n yang sudah siap di-import.

---

## Daftar Workflow

| File | Nama | Fungsi |
|---|---|---|
| `workflows/cv-parser.json` | TMS — CV Parser | Async parse & ekstraksi CV via LLM (TASK-11.5) |

---

## Cara Import Workflow

### 1. Buka n8n UI

- Development: `http://localhost:5678`
- Production (via Nginx): `https://your-domain.com/n8n/`

### 2. Import JSON

1. Klik **"Workflows"** di sidebar kiri
2. Klik tombol **"+"** → pilih **"Import from file"** (atau paste JSON)
3. Pilih file dari folder `n8n/workflows/`
4. Klik **Save**

---

## Konfigurasi Workflow: `cv-parser.json`

Workflow ini menggunakan **n8n environment variables** — tidak ada hardcoded value. Setelah import, set variabel berikut di n8n:

### Environment Variables yang Dibutuhkan

Masuk ke **Settings → Environment Variables** di n8n UI, lalu tambahkan:

| Variable | Contoh Nilai | Keterangan |
|---|---|---|
| `FASTAPI_INTERNAL_URL` | `http://backend:8000` | URL backend (dalam Docker network) |
| `INTERNAL_API_SECRET` | `<nilai INTERNAL_API_SECRET di .env>` | Shared secret untuk n8n → FastAPI callback |
| `WEBHOOK_SECRET` | `<nilai N8N_WEBHOOK_SECRET di .env>` | Shared secret untuk FastAPI → n8n webhook (**harus diset**) |
| `ANTHROPIC_API_KEY` | `sk-ant-xxxx` | API key Anthropic Claude |
| `LLM_MODEL` | `claude-haiku-4-5-20251001` | Model Anthropic yang dipakai (sertakan tanggal versi) |

> **Penting:**
> - `INTERNAL_API_SECRET` harus **sama persis** dengan `INTERNAL_API_SECRET` di file `.env` backend.
> - `WEBHOOK_SECRET` harus **sama persis** dengan `N8N_WEBHOOK_SECRET` di file `.env` backend.
> - Jika `WEBHOOK_SECRET` tidak di-set, workflow akan **menolak semua request** masuk.

### Cara Set Environment Variables di n8n

1. Di n8n UI: **Settings** (ikon roda gigi) → **Environment Variables**
2. Tambah setiap variabel di atas
3. Klik **Save**

---

## Alur Kerja `cv-parser.json`

```
FastAPI (bulk-upload-cv)
    │
    │  POST /webhook/cv-parser
    │  Header: X-Webhook-Secret
    │  Body: { screening_result_id, drive_item_id, position_id, uploaded_by }
    ▼
[Webhook Trigger]
    │  (responseMode: onReceived — langsung balas 200, workflow jalan di background)
    │  → FastAPI tidak perlu tunggu workflow selesai, tidak ada timeout mismatch
    ▼
[Step 0 — Auth & Validate Payload]
    Cek X-Webhook-Secret header vs env var WEBHOOK_SECRET.
    Validasi field wajib ada (screening_result_id, drive_item_id, position_id).
    ai_scoring_config TIDAK diambil dari body.
    │
    ▼
[Step 1 — Parse CV Text]
    POST /api/v1/internal/parse-cv
    Header: X-Internal-Secret
    → { text: "isi teks CV..." }
    │
    ▼
[Step 1b — Validate CV Text]
    Cek teks tidak kosong (minimal 100 karakter).
    Hentikan proses jika teks kosong — mencegah LLM hallucinate.
    │
    ▼
[Step 1c — Fetch Scoring Config]
    GET /api/v1/internal/scoring-config/{position_id}
    Header: X-Internal-Secret
    → { ai_scoring_config: {...} }
    Config diambil dari DB, bukan dari webhook body — mencegah manipulasi scoring dari luar.
    │
    ▼
[Step 1d — Merge Context]
    (Code node) Gabungkan cv_text + scoring_config untuk dikirim ke LLM
    │
    ▼
[Step 2 — LLM Extract & Score]
    POST https://api.anthropic.com/v1/messages
    System prompt: instruksi peran + penolakan prompt injection dari teks CV
    User prompt: instruksi ekstraksi + scoring_config (dari DB) + teks CV (dibatasi pembatas eksplisit)
    → { extracted: {...}, ai_score: 85, ai_notes: "..." }
    │
    ▼
[Step 3 — Parse LLM Response]
    (Code node) Bersihkan JSON, handle code fence.
    Validasi dan normalisasi skema extracted (nama, pendidikan, pengalaman_kerja, dll).
    Clamp ai_score ke rentang 0–100.
    → { screening_result_id, extracted_json, ai_score, ai_notes, status: "siap_review" }
    │
    ▼
[Step 4 — Callback FastAPI (Success)]
    POST /api/v1/internal/ai/extraction-result
    Header: X-Internal-Secret
    Semua string di-JSON.stringify() sebelum disisipkan ke body — mencegah JSON injection.
    → { message: "OK" }


── Jika ada error di Step 0/1/1b/1c/1d/2/3/4 ───────────────────────────────

[Error — Prepare Payload]
    (Code node) Siapkan payload error, ambil screening_result_id dari Step 0 jika ada.
    → { ..., status: "error", ai_notes: "Workflow gagal: ..." }
    │
    ▼
[Error — Callback FastAPI (Error)]
    POST /api/v1/internal/ai/extraction-result
    status: "error"
```

---

## Payload yang Diterima Webhook

FastAPI mengirim payload ini ke `POST /webhook/cv-parser` saat CV diupload:

```json
{
  "screening_result_id": "uuid-of-ai_screening_result",
  "drive_item_id":       "OneDrive-file-id",
  "position_id":         "uuid-of-position",
  "uploaded_by":         "uuid-of-hr-user"
}
```

Header yang disertakan FastAPI:
```
X-Webhook-Secret: <nilai N8N_WEBHOOK_SECRET di .env>
```

> `ai_scoring_config` **tidak dikirim di payload** — diambil langsung dari database di Step 1c
> agar tidak bisa dimanipulasi oleh pihak luar melalui webhook body.

---

## Mengaktifkan Workflow

Setelah import dan environment variables sudah diset:

1. Buka workflow **"TMS — CV Parser"**
2. Klik toggle **"Active"** di kanan atas (warna hijau = aktif)
3. Webhook URL akan aktif di: `http://n8n:5678/webhook/cv-parser`

Pastikan nilai `N8N_WEBHOOK_CV_PARSER` di file `.env` backend sesuai:
```
N8N_WEBHOOK_CV_PARSER=http://n8n:5678/webhook/cv-parser
```

Dan tambahkan kedua secret di `.env` backend:
```
INTERNAL_API_SECRET=<rahasia-panjang-dan-acak>
N8N_WEBHOOK_SECRET=<rahasia-panjang-dan-acak-berbeda>
```

---

## Catatan Keamanan & Operasional

### Autentikasi Webhook (Issue #1)
Semua request masuk ke webhook dicek `X-Webhook-Secret` header di **Step 0**. Jika secret tidak cocok atau env var tidak di-set, workflow langsung berhenti — tidak ada biaya LLM yang terpakai.

### Prompt Injection dari Teks CV (Issue #2)
Teks CV ditempatkan di antara pembatas eksplisit (`=== MULAI TEKS CV ===` / `=== AKHIR TEKS CV ===`), dan system prompt memerintahkan model untuk mengabaikan instruksi apapun yang ada di dalam teks CV. Ini tidak 100% immune dari adversarial injection, tetapi secara signifikan mengurangi risiko dibanding tanpa pembatas. Hasilnya selalu melalui human review di `AIExtractionReview` sebelum tersimpan.

### Scoring Config dari DB (Issue #3)
`ai_scoring_config` diambil di Step 1c dari database via `GET /internal/scoring-config/{position_id}`, bukan dari webhook body. Akses endpoint ini membutuhkan `X-Internal-Secret` header — tidak bisa diakses dari luar container network.

### Validasi Teks Kosong (Issue #4)
Step 1b menolak teks CV dengan kurang dari 100 karakter sebelum memanggil LLM. File scan tanpa OCR akan menghasilkan status `error` dengan pesan yang jelas.

### Validasi Skema (Issue #5)
Step 3 menormalisasi setiap field `extracted` ke tipe yang diharapkan. Array yang tidak ada diisi `[]`, string yang hilang diisi `null`, `ai_score` di-clamp ke 0–100. LLM tidak bisa mengubah format secara diam-diam.

### Timeout (Issue #8)
`responseMode: onReceived` — webhook langsung balas HTTP 200 ke FastAPI setelah menerima request, sebelum workflow mulai berjalan. Workflow jalan di background n8n. Tidak ada risiko timeout mismatch.

### Data PII di Log Eksekusi (Issue #9)
`saveManualExecutions: false` — n8n tidak menyimpan data eksekusi lengkap (termasuk teks CV yang mengandung PII) secara permanen. Gunakan fitur "Test Workflow" di n8n UI hanya saat development, jangan di environment production.

### JSON Injection di Callback (Issue #11)
Semua nilai string di body callback (`ai_notes`, `screening_result_id`, `status`) menggunakan `JSON.stringify()` — aman dari injection via karakter kutip atau newline.

### Retry & Exponential Backoff untuk LLM (Issue #12)
Step 2 adalah Code node (bukan HTTP Request node) yang berisi retry loop eksplisit:
- **MAX_ATTEMPTS = 3** — 1 percobaan awal + 2 retry
- **Hanya retry untuk status transient**: `429` (rate limit), `500/502/503` (server error sementara), `529` (Anthropic overloaded)
- **Tidak diretry**: `400/401/403` (konfigurasi salah — retry tidak membantu) dan timeout 120s (sudah terlalu lama, tidak perlu tambah beban)
- **Backoff**: `5s → 10s` dengan jitter ±20%, cap maksimum 60s. Jika Anthropic mengirim header `Retry-After`, nilai itu yang dipakai
- Jika semua attempt habis, node throw error → masuk ke error branch → status `error` di DB → HR bisa isi manual

---

## Troubleshooting

### Webhook tidak menerima trigger
- Pastikan workflow dalam status **Active** (bukan testing mode)
- Cek `N8N_WEBHOOK_CV_PARSER` di `.env` sudah mengarah ke URL yang benar
- Dari dalam Docker network, gunakan `http://n8n:5678` (bukan localhost)

### Error "Webhook secret tidak valid — request ditolak" (Step 0 error)
- Pastikan `N8N_WEBHOOK_SECRET` di `.env` backend **sama persis** dengan `WEBHOOK_SECRET` di n8n environment variables
- Cek tidak ada spasi atau karakter tersembunyi di kedua nilai

### Error "Internal secret tidak valid" (403 dari FastAPI)
- Pastikan `INTERNAL_API_SECRET` di n8n **sama persis** dengan di `.env` backend

### LLM tidak merespons / timeout
- Cek `ANTHROPIC_API_KEY` sudah diset dan valid
- Default timeout Step 2 adalah 120 detik — cukup untuk CV panjang
- Pastikan `LLM_MODEL` menggunakan nama model yang valid termasuk tanggal versi, misal `claude-haiku-4-5-20251001`

### Error "Teks CV terlalu pendek atau kosong" (Step 1b error)
- File kemungkinan adalah scan/gambar tanpa layer teks
- Saat ini backend menggunakan PyMuPDF (text-based only). Untuk CV scan, perlu OCR terlebih dahulu (Tesseract/PaddleOCR) — lihat `requirements.md` FR-08.1
- Status `ai_screening_result` akan diset `error`, HR bisa isi manual di `AIExtractionReview`

### JSON LLM tidak bisa di-parse
- Step 3 sudah handle fallback: jika parse gagal, `extracted_json` akan berisi `{ raw_text: "..." }` dan status tetap `siap_review`
- HR masih bisa review dan isi manual di `AIExtractionReview`
