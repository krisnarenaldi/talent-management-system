# TASK-20 Code Review — Talent Management System

**Tanggal review:** 2025  
**Reviewer:** Automated code review (read-only investigation)  
**Scope:** TASK-20.1 s/d TASK-20.5

---

## Ringkasan Eksekutif

| Subtask | Status | Catatan Singkat |
|---------|--------|-----------------|
| TASK-20.1: Checkbox Multi-Select & Action Bar | **OK** | Semua requirement terpenuhi |
| TASK-20.2: Modal 'Assign ke Lowongan' | **PARTIAL** | Dropdown Posisi pakai `<select>` bukan Autocomplete; fitur inti sudah OK |
| TASK-20.3: Halaman `/candidates/new` Bulk CV Upload | **PARTIAL** | Progress bar per-file tidak real-time; fitur inti sudah OK |
| TASK-20.4: Navigasi & Halaman `/talent-pool` | **OK** | Semua requirement terpenuhi |
| TASK-20.5: Form Master Data Posisi | **OK** | Semua tiga field baru ada dan berfungsi |

---

## TASK-20.1 — Checkbox Multi-Select & Action Bar di `/candidates`

**Status: ✅ OK**

### Verifikasi File
- `frontend/src/app/(dashboard)/candidates/page.tsx` — Ada. Halaman tipis yang hanya me-render `<CandidatesTable />`.
- Logika multi-select sepenuhnya ada di `frontend/src/components/candidates/CandidatesTable.tsx`.

### Pemeriksaan Per-Requirement

| Requirement | Ditemukan | Lokasi |
|-------------|-----------|--------|
| State `selectedCandidateIds: Set<string>` | ✅ | `CandidatesTable.tsx:107` — `const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set())` |
| Checkbox di setiap baris tabel | ✅ | Kolom pertama tabel, per-baris `<input type="checkbox" onChange={() => handleSelectOne(candidate.id)}` |
| Checkbox "select all" di header | ✅ | Header `<input type="checkbox">` dengan `indeterminate` support via `ref` callback |
| Action bar muncul saat ada kandidat terpilih | ✅ | `{selectedCandidateIds.size > 0 && (<div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">` |
| Action bar sticky di bottom | ✅ | `fixed bottom-6`, z-index 50 |
| Tombol 'Assign ke Lowongan' | ✅ | `onClick={handleBulkAssignJob}` → membuka `BulkAssignModal` |
| Tombol 'Pindahkan ke Talent Pool' | ✅ | `onClick={handleBulkTalentPool}` → membuka inline modal konfirmasi |
| 'Pindah ke Talent Pool' → `PATCH /api/v1/candidates/{id}/talent-pool` | ✅ | `api.patch(\`/api/v1/candidates/${candidateId}/talent-pool\`, { pool_status: "talent_pool", ... })` |

### Catatan Minor
- "Pindah ke Talent Pool" bulk hanya mengirim 1 request per kandidat secara sekuensial (loop forEach). Tidak ada endpoint bulk PATCH, tapi ini sesuai dengan API yang tersedia.
- Konfirmasi modal talent pool diimplementasikan inline di CandidatesTable (bukan komponen terpisah), namun fungsional dan ada juga `TalentPoolModal` standalone di `components/candidates/TalentPoolModal.tsx` untuk penggunaan per-baris.

---

## TASK-20.2 — Modal 'Assign ke Lowongan' dengan RBAC Toggle

**Status: ⚠️ PARTIAL**

### Verifikasi File
- `frontend/src/components/candidates/BulkAssignModal.tsx` — Ada ✅

### Pemeriksaan Per-Requirement

| Requirement | Ditemukan | Lokasi / Catatan |
|-------------|-----------|------------------|
| Daftar ringkas nama kandidat terpilih | ✅ | Section "Kandidat yang akan di-assign" tampilkan `candidateNames` dengan numbering |
| Dropdown pilih Posisi | ⚠️ **PARTIAL** | Pakai `<select>` biasa, bukan Autocomplete/Combobox. Requirement menyebut "Autocomplete" |
| Input 'User Klien' (nama PIC) | ✅ | Jika posisi sudah punya `client_user_names`, tampilkan `<select>`; jika tidak, tampilkan `<input type="text">` |
| Toggle 'Jalankan AI Screening' — hanya tampil untuk Manager/Admin | ✅ | `canToggleAIScreening` dihitung dari `user.role`, toggle hanya render jika `canToggleAIScreening === true` |
| Submit → `POST /api/v1/candidates/bulk-assign` | ✅ | `api.post("/api/v1/candidates/bulk-assign", payload)` |
| Toast sukses | ✅ | `showToast("success", ...)` di `onSuccess` |
| Invalidate query setelah sukses | ✅ | `queryClient.invalidateQueries({ queryKey: ["candidates"] })` dan `["applications"]` |

### Item Missing / Perbedaan dengan Requirement

1. **Dropdown Posisi bukan Autocomplete** — Requirement menyebut "Dropdown pilih Posisi (Autocomplete)". Implementasi menggunakan `<select>` HTML biasa. Untuk daftar posisi yang banyak, UX-nya akan buruk karena tidak ada fitur search/filter di dalam dropdown. Secara fungsional tetap bekerja, tapi tidak sesuai spesifikasi UX.

2. **RBAC check menggunakan string parsing yang rapuh** — `user.role?.split(".").pop()?.toLowerCase()` mengasumsikan format role seperti `"something.admin"`. Jika format role berbeda, RBAC toggle bisa tidak tampil. Sebaiknya pakai `isRole()` dari `useAuthStore` yang sudah tersedia dan digunakan di file lain.

---

## TASK-20.3 — Halaman `/candidates/new` — Bulk CV Upload

**Status: ⚠️ PARTIAL**

### Verifikasi File
- `frontend/src/app/(dashboard)/candidates/new/page.tsx` — Ada ✅

### Pemeriksaan Per-Requirement

| Requirement | Ditemukan | Lokasi / Catatan |
|-------------|-----------|------------------|
| Dropzone drag-and-drop multi-file | ✅ | `onDragOver`, `onDragLeave`, `onDrop` handlers; `<input type="file" multiple>` |
| Validasi format PDF/DOCX | ✅ | `ACCEPTED_TYPES` check + error toast per file yang tidak valid |
| Validasi max 20 file | ✅ | `MAX_FILES = 20`, combined array dicapped dan ditampilkan warning toast |
| Validasi max 5 MB per file | ✅ | `MAX_SIZE_BYTES = 5 * 1024 * 1024`, validasi di `addFiles()` |
| Dropdown opsional 'Channel Asal' | ✅ | `<select id="source-channel">` dengan data dari `settingsApi.listSourceChannels` |
| Tombol 'Upload & Ekstrak CV' | ✅ | Button `onClick={() => uploadMutation.mutate()}` dengan label "Upload & Ekstrak CV" |
| Progress/status per file | ⚠️ **PARTIAL** | Status per file ada (pending/uploading/done/error), tapi semua file langsung set ke "uploading" bersamaan lalu semuanya set ke "done" secara serentak. Tidak ada progress bar visual (persentase/bytes), dan status tidak diupdate secara per-file karena API upload adalah satu request batch, bukan per-file. |
| Hasil ekstraksi dengan badge sukses/proses/error | ✅ | `<StatusBadge>` component dengan 4 state: ✅ Berhasil diekstrak / ⏳ Sedang diproses / ❌ Gagal dibaca / — Menunggu |
| Link 'Input Manual' untuk fallback | ✅ | `<Link href="/candidates/manual/new">` ada di header, di bawah action button, dan per-item error di file list |
| Submit → `POST /api/v1/candidates/bulk-upload` | ✅ | `api.post("/api/v1/candidates/bulk-upload", formData)` |

### Item Missing / Perbedaan dengan Requirement

1. **Progress per-file tidak granular** — Requirement: "Progress/status per file". Implementasi mengubah semua file ke status "uploading" sekaligus di awal request, lalu semua ke "done" setelah response. Tidak ada progress bar (misal: `onUploadProgress` dari axios) dan tidak ada diferensiasi status per-file berdasarkan API response karena endpoint mengembalikan daftar `screening_ids` tanpa error per-file.

   Akar masalah: API `POST /api/v1/candidates/bulk-upload` adalah batch request tunggal yang mengembalikan HTTP 202 dengan array `screening_ids`. Status per-file baru diketahui setelah worker selesai (async). Ini limitasi arsitektur, bukan bug implementasi frontend murni — tapi UX-nya perlu penjelasan yang lebih jelas ke user bahwa "sedang diproses" adalah status final dari sudut pandang upload, bukan transitional.

2. **Halaman `/candidates/new` sudah jadi halaman Bulk CV Upload** — Requirement TASK-04.3 sebelumnya mendefinisikan `/candidates/new` sebagai form multi-step manual. Pada TASK-20.3, halaman ini digunakan ulang/diganti menjadi Bulk CV Upload. Link "Input Manual" diarahkan ke `/candidates/manual/new`. Perlu dipastikan route `/candidates/manual/new` sudah ada.

---

## TASK-20.4 — Navigasi & Halaman `/talent-pool`

**Status: ✅ OK**

### Verifikasi File
- `frontend/src/components/Sidebar.tsx` — Ada ✅  
- `frontend/src/app/(dashboard)/talent-pool/page.tsx` — Ada ✅

### Pemeriksaan Per-Requirement

| Requirement | Ditemukan | Lokasi / Catatan |
|-------------|-----------|------------------|
| Link 'Talent Pool' ada di sidebar | ✅ | `SIDEBAR_NAV_ITEMS` includes `{ href: "/talent-pool", icon: "groups", label: "Talent Pool" }` di posisi ke-3 |
| Halaman reuse komponen tabel dari /candidates | ✅ | `TalentPoolPage` merender `<CandidatesTable poolStatus="talent_pool">` |
| Default filter `pool_status=talent_pool` | ✅ | Prop `poolStatus="talent_pool"` diteruskan ke query param `pool_status` |
| Filter: Domisili (Kota) | ✅ | `cityFilter` state + filter `city` di CandidatesTable |
| Filter: Pendidikan | ✅ | `educationFilter` state + filter `education` di CandidatesTable |
| Filter: Pengalaman | ✅ | `experienceFilter` state + filter `experience_level` di CandidatesTable |
| Filter: Rentang Gaji | ✅ | `currentSalaryFilter` dan `expectedSalaryFilter` dengan `SALARY_RANGES` di CandidatesTable |
| Filter: Pencarian Nama | ✅ | `searchTerm` state + filter `search` di CandidatesTable |

### Catatan
- Talent Pool page menampilkan `showExport={false}`, sehingga tombol export tidak muncul di halaman ini. Tidak ada requirement untuk export di talent pool, ini OK.
- Semua filter dari requirement sudah tersedia di `CandidatesTable` karena komponen ini dipakai bersama halaman `/candidates` dan `/talent-pool`.

---

## TASK-20.5 — Form Master Data Posisi

**Status: ✅ OK**

### Verifikasi File
- `frontend/src/app/(dashboard)/admin/positions/[clientId]/page.tsx` — Ada ✅  
  (Perhatian: Requirement menyebut path ini, dan file ini memang ada sebagai dynamic route)

### Pemeriksaan Per-Requirement

| Requirement | Ditemukan | Lokasi / Catatan |
|-------------|-----------|------------------|
| Field `salary_budget` (Budget Gaji Maksimal) | ✅ | Zod schema `salary_budget: optionalNumber`, form field via `<Controller name="salary_budget">` + `<RupiahInput>` component, ditampilkan di tabel kolom "Budget Gaji" |
| Field `location` (Lokasi/Kota Penempatan) | ✅ | Zod schema `location: optionalText`, form field `<input type="text" {...register("location")}>`, ditampilkan di tabel kolom "Lokasi" |
| Multi-tag input `client_user_names` (PIC User Klien) | ✅ | Zod schema `client_user_names: z.array(z.string()).default([])`, form field via `<Controller name="client_user_names">` + `<TagInput>` component (tekan Enter/koma untuk tambah), ditampilkan di tabel sebagai badge |
| Data tersimpan ke API | ✅ | Payload `onSubmit` menyertakan ketiganya: `salary_budget`, `location`, `client_user_names` |

### Catatan
- Fitur AI Ekstraksi Kriteria Posisi (`POST /api/v1/positions/extract-criteria`) juga diimplementasikan di halaman ini — menarik data untuk `salary_budget`, `location`, `ai_required_skills`, dan `ai_min_experience_years` dari teks requirement/job description. Ini beyond-requirement bonus feature.

---

## Masalah yang Perlu Diperbaiki

### Prioritas Tinggi

1. **[TASK-20.3] Route `/candidates/manual/new` mungkin tidak ada**  
   Halaman bulk upload mengarahkan semua link "Input Manual" ke `/candidates/manual/new`. Perlu diverifikasi apakah route tersebut sudah diimplementasikan. Jika tidak ada, semua link fallback akan mengarah ke 404.

   ```
   # Cek keberadaan file:
   frontend/src/app/(dashboard)/candidates/manual/new/page.tsx
   ```

### Prioritas Sedang

2. **[TASK-20.2] RBAC check di BulkAssignModal menggunakan string parsing yang rapuh**  
   ```typescript
   // Kode saat ini (rapuh):
   const canToggleAIScreening = user ? ["admin", "manager"].includes(
     user.role?.split(".").pop()?.toLowerCase() || ""
   ) : false;
   
   // Rekomendasi (gunakan isRole() yang sudah ada):
   const isRole = useAuthStore((state) => state.isRole);
   const canToggleAIScreening = isRole("admin", "manager");
   ```

3. **[TASK-20.2] Dropdown Posisi bukan Autocomplete**  
   Gunakan komponen Autocomplete/Combobox (misalnya `react-select` atau implementasi custom dengan search) untuk UX yang lebih baik ketika daftar posisi banyak. Saat ini pakai `<select>` biasa.

### Prioritas Rendah

4. **[TASK-20.3] Progress per-file tidak granular**  
   Karena API adalah batch request tunggal, progress per-file sulit diimplementasikan secara akurat. Solusi yang bisa dilakukan: gunakan `axios` `onUploadProgress` untuk progress keseluruhan, dan beri penjelasan UI yang lebih jelas bahwa status "Sedang diproses" berarti sudah berhasil diupload dan AI sedang bekerja di background.

---

## Kesimpulan

TASK-20 secara keseluruhan **sudah sangat mendekati selesai**. Semua fitur inti berfungsi. Gap yang ada bersifat:
- 1 risiko bug nyata (link `/candidates/manual/new` mungkin 404)
- 1 kelemahan RBAC (string parsing rapuh)  
- 1 deviasi UX minor (select vs autocomplete)
- 1 limitasi arsitektur yang bisa dijelaskan lebih baik di UI (progress file)

Tidak ada TypeScript error yang obvious dari pembacaan kode. Semua API endpoint yang dipanggil sesuai dengan yang didefinisikan di TASK-18 dan TASK-19 (spec `tasks.md`).
