# Implementation Plan — TASK-20.3
## Redesain `/candidates/new` — Ingestion CV Massal Mandiri (FR-03.7)

---

## Temuan Eksplorasi

### Status implementasi saat ini
- `frontend/src/app/(dashboard)/candidates/new/page.tsx` — **sudah hampir selesai**. Implementasi penuh sudah ada: dropzone drag-and-drop, validasi file, file list, channel asal dropdown, upload mutation ke `POST /api/v1/candidates/bulk-upload`, dan results section.
- **Satu-satunya blocker:** dua tipe yang diimport — `BulkUploadResult` dan `FileUploadStatus` — **belum didefinisikan** di `frontend/src/types/index.ts`. Ini menyebabkan TypeScript error yang membuat komponen gagal compile.

### Route `/candidates/manual/new`
- Route **sudah ada** di `frontend/src/app/(dashboard)/candidates/manual/new/page.tsx`.
- Isinya hanya `<CandidateForm mode="create" />` — tidak perlu dibuat ulang.
- Link dari `page.tsx` ke `/candidates/manual/new` sudah benar dan tidak perlu diubah.

### Backend endpoint
- `POST /api/v1/candidates/bulk-upload` — sudah ada, return `BulkUploadResponse` dengan field:
  - `screening_ids: List[str]`
  - `total_files: int`
  - `message: str`
- `GET /api/v1/applications/screening/{id}` — sudah ada. Tapi **tidak digunakan** oleh `page.tsx` saat ini (polling tidak diimplementasikan — halaman hanya menampilkan status "done" setelah upload berhasil). Ini sesuai dengan requirement TASK-20.3 yang tidak menyebut polling real-time; polling AI adalah fitur TASK-11.6 (`/applications/pending-review`).

### Definisi yang diperlukan
Backend schema `BulkUploadResponse` (dari `backend/app/schemas/candidate.py`):
```python
class BulkUploadResponse(BaseModel):
    screening_ids: List[AutoStrUUID]
    total_files: int
    message: str
```

Berdasarkan penggunaan di `page.tsx`, dua tipe frontend yang dibutuhkan adalah:

**`BulkUploadResult`** — memetakan `BulkUploadResponse` dari backend:
- `screening_ids: string[]`
- `total_files: number`
- `message: string`

**`FileUploadStatus`** — state lokal untuk setiap file dalam antrian upload:
- `file: File`
- `status: "pending" | "uploading" | "done" | "error"`
- `errorMessage?: string`

---

## Keputusan Desain

**Tidak perlu polling per-screening-ID.** TASK-20.3 mengharuskan progress indicator batch upload (bukan status real-time AI extraction per file). Status AI extraction ditangani di halaman `/applications/pending-review` (TASK-11.6 — sudah selesai). Implementasi saat ini yang menandai semua file sebagai `"done"` setelah upload HTTP 202 diterima sudah tepat.

**Tidak perlu membuat route baru.** Route `/candidates/manual/new` sudah ada. Tidak ada `?manual=true` yang diperlukan.

**Satu-satunya pekerjaan yang tersisa adalah menambahkan tipe ke `types/index.ts`.** Tidak ada perubahan logika atau UI yang diperlukan pada `page.tsx`.

---

## Plan

- [ ] 1. Tambahkan tipe `BulkUploadResult` dan `FileUploadStatus` ke `frontend/src/types/index.ts`.

      Dua tipe ini perlu ditambahkan di bagian bawah file, setelah section `// --- AI Screening ---`.
      Definisi lengkap:

      ```typescript
      // --- Bulk CV Upload (TASK-20.3) ---

      /**
       * Status lokal setiap file dalam antrian bulk upload.
       * Digunakan oleh halaman /candidates/new untuk menampilkan progress per file.
       */
      export interface FileUploadStatus {
        file: File;
        status: "pending" | "uploading" | "done" | "error";
        errorMessage?: string;
      }

      /**
       * Response dari POST /api/v1/candidates/bulk-upload (HTTP 202).
       * Memetakan BulkUploadResponse dari backend/app/schemas/candidate.py.
       */
      export interface BulkUploadResult {
        screening_ids: string[];
        total_files: number;
        message: string;
      }
      ```

      Files:
      - `frontend/src/types/index.ts` (tambah di akhir file)

      Verify:
      `cd frontend && npm run type-check`
      Expected: zero errors terkait `BulkUploadResult` dan `FileUploadStatus`.
      Jika `npm run type-check` timeout karena Next.js plugin, jalankan:
      `cd frontend && npx tsc --noEmit --incremental false 2>&1 | grep -E "error TS|BulkUpload|FileUpload"`
      Expected: tidak ada output (tidak ada error untuk tipe-tipe tersebut).

---

## Catatan Verifikasi Tambahan

Setelah langkah di atas selesai, verifikasi manual berikut bisa dilakukan jika server tersedia:

1. Buka `/candidates/new` di browser — halaman harus render tanpa error.
2. Drag-and-drop 1–2 file PDF/DOCX — file muncul di file list dengan status "Menunggu".
3. Klik "Upload & Ekstrak CV" — status berubah ke "Sedang diproses", lalu "Berhasil diekstrak".
4. Results section muncul dengan screening IDs.
5. Klik link "Input Manual →" di header — navigasi ke `/candidates/manual/new` yang menampilkan `CandidateForm`.

---

## Ringkasan Scope

| Aspek | Status |
|---|---|
| `page.tsx` logika & UI | ✅ Sudah selesai, tidak perlu diubah |
| Route `/candidates/manual/new` | ✅ Sudah ada |
| Backend endpoint | ✅ Sudah ada |
| Polling status per file | ⛔ Tidak diperlukan untuk TASK-20.3 |
| **Tipe `BulkUploadResult` & `FileUploadStatus`** | ❌ **Perlu ditambahkan** |
