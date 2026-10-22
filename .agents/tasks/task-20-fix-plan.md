# Implementation Plan — TASK-20 Code Review Fixes

## Design Decisions

### Fix 1 — DuplicateWarningBanner & BlacklistWarningModal

**Decision: Buat dua komponen baru dan integrasikan ke halaman `manual/new` via page-level state.**

Rationale: `CandidateForm` sudah berfungsi sendiri dan komponen itu dipakai juga di halaman edit. Mengubah CandidateForm untuk expose `onCreateResult` callback adalah pendekatan yang bersih — tambahkan prop opsional `onCreateResult?: (result: CreateCandidateResult) => void` yang dipanggil setelah API create berhasil. Page `manual/new` menjadi wrapper yang mengelola state `isDuplicate` dan `isBlacklisted`, lalu merender banner/modal sesuai kondisi. Toast tetap ada (dipertahankan untuk edit mode, bukan di-replace).

`DuplicateWarningBanner` = inline banner kuning di atas form (setelah submit) — non-blocking, user bisa lanjut ke detail.  
`BlacklistWarningModal` = modal merah blocking — muncul saat kandidat baru terdeteksi blacklist, berisi tombol "Tetap Lanjut" dan "Batal / Kembali".

---

## Urutan Implementasi

- [ ] 1. Buat komponen `DuplicateWarningBanner`
      Banner inline yang menampilkan peringatan kandidat duplikat. Diterima props: `candidateId: string`, `onDismiss: () => void`. Menampilkan alert kuning dengan teks peringatan dan link "Lihat Kandidat Ini" yang mengarah ke `/candidates/{candidateId}`.
      Files: `frontend/src/components/candidates/DuplicateWarningBanner.tsx`
      Verify: `cd frontend && npm run type-check` — tidak ada error TS.

- [ ] 2. Buat komponen `BlacklistWarningModal`
      Modal yang muncul ketika kandidat baru terdeteksi blacklisted. Props: `isOpen: boolean`, `candidateId: string`, `onConfirm: () => void` (lanjut ke detail), `onClose: () => void` (tetap di halaman). Menampilkan ikon warning merah, teks penjelasan, dan dua tombol aksi.
      Files: `frontend/src/components/candidates/BlacklistWarningModal.tsx`
      Verify: `cd frontend && npm run type-check` — tidak ada error TS.

- [ ] 3. Tambahkan prop `onCreateResult` ke `CandidateForm` dan panggil setelah API create berhasil
      Tambahkan interface `CreateCandidateResult { candidateId: string; isBlacklisted: boolean; isDuplicate: boolean }` di file yang sama atau di `types/index.ts`. Tambahkan prop opsional `onCreateResult?: (result: CreateCandidateResult) => void` ke komponen. Panggil callback ini di `handleSubmitForm` setelah create berhasil (sebelum `router.push`) — hanya untuk `mode === "create"`. Jika prop tidak diberikan, perilaku tidak berubah (navigasi tetap ke `/candidates/{id}` seperti sekarang). Toast blacklist/duplicate tetap ada untuk backward compatibility.
      Files: `frontend/src/components/candidates/CandidateForm.tsx`
      Verify: `cd frontend && npm run type-check` — tidak ada error TS.

- [ ] 4. Ubah halaman `manual/new` menjadi wrapper dengan state management untuk banner/modal
      Ganti isi halaman agar menjadi `"use client"` page yang:
      - Menyimpan state: `createResult: CreateCandidateResult | null`
      - Render `<CandidateForm mode="create" onCreateResult={setCreateResult} />`
      - Render `<DuplicateWarningBanner>` di atas form jika `createResult?.isDuplicate === true`
      - Render `<BlacklistWarningModal>` jika `createResult?.isBlacklisted === true`
      - Saat `onCreateResult` dipanggil, set state, lalu navigasi hanya dilakukan via tombol modal/banner (bukan otomatis oleh CandidateForm) — atau jika tidak ada blacklist/duplicate, CandidateForm tetap navigate otomatis (callback hanya menambah perilaku overlay, bukan menggantikan navigasi default sehingga kode form tidak berubah besar).
      
      **Catatan penting**: Untuk menjaga CandidateForm tetap simpel, implementasikan `onCreateResult` sebagai *side-effect* setelah navigasi. Artinya: page `manual/new` menerima callback, menyimpan hasilnya di sessionStorage/state sebelum navigasi, lalu menampilkan banner/modal di halaman tujuan. Tapi itu terlalu kompleks.
      
      **Pendekatan lebih sederhana (diputuskan)**: Tambahkan prop `preventNavigationOnCreate?: boolean` ke `CandidateForm`. Jika `true` (set oleh halaman manual/new), CandidateForm tidak memanggil `router.push` setelah create — ia hanya memanggil `onCreateResult`. Halaman `manual/new` lalu mengelola navigasi sendiri melalui kondisi: jika tidak blacklist dan tidak duplicate → navigasi ke detail; jika ada kondisi → tampilkan banner/modal dulu, lalu user bisa navigate secara manual.
      Files: `frontend/src/app/(dashboard)/candidates/manual/new/page.tsx`, `frontend/src/components/candidates/CandidateForm.tsx`
      Verify: `cd frontend && npm run type-check` — tidak ada error TS.

- [ ] 5. Fix RBAC di `BulkAssignModal.tsx` — ganti pattern `user.role.split()` ke `isRole()`
      Ganti baris:
      ```typescript
      const user = useAuthStore((state) => state.user);
      const canToggleAIScreening = user ? ["admin", "manager"].includes(
        user.role?.split(".").pop()?.toLowerCase() || ""
      ) : false;
      ```
      Dengan:
      ```typescript
      const isRole = useAuthStore((state) => state.isRole);
      const canToggleAIScreening = isRole("admin", "manager");
      ```
      Hapus import `user` dari store jika tidak dipakai lagi di tempat lain dalam file.
      Files: `frontend/src/components/candidates/BulkAssignModal.tsx`
      Verify: `cd frontend && npm run type-check` — tidak ada error TS.

- [ ] 6. Implementasi Combobox untuk dropdown posisi di `BulkAssignModal.tsx`
      Ganti elemen `<select id="position_id" {...register("position_id")}>` dengan implementasi Combobox inline menggunakan state lokal. **Tidak menginstall library baru.**
      
      Implementasi:
      - Tambahkan state: `comboQuery: string`, `comboOpen: boolean`
      - Tambahkan ref: `comboRef = useRef<HTMLDivElement>(null)` untuk detect klik luar
      - `useEffect` untuk addEventListener `mousedown` pada document: jika klik di luar `comboRef.current`, set `comboOpen = false`
      - Computed: `filteredPositions = positions.filter(pos => (pos.title + pos.client_name).toLowerCase().includes(comboQuery.toLowerCase()))`
      - Render:
        ```tsx
        <div ref={comboRef} className="relative">
          <input
            role="combobox"
            aria-expanded={comboOpen}
            aria-controls="position-listbox"
            value={comboQuery}
            onChange={(e) => { setComboQuery(e.target.value); setComboOpen(true); if (!e.target.value) setValue("position_id", ""); }}
            onFocus={() => setComboOpen(true)}
            placeholder="Cari posisi..."
            className="..."
          />
          {comboOpen && filteredPositions.length > 0 && (
            <ul id="position-listbox" role="listbox" className="absolute z-10 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg mt-1">
              {filteredPositions.map((pos) => (
                <li
                  key={pos.id}
                  role="option"
                  aria-selected={selectedPositionId === pos.id}
                  onClick={() => { setValue("position_id", pos.id); setComboQuery(`${pos.title} — ${pos.client_name}`); setComboOpen(false); }}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50 ..."
                >
                  {pos.title} — {pos.client_name}
                </li>
              ))}
            </ul>
          )}
        </div>
        ```
      - Ketika posisi sudah terpilih (`selectedPositionId` tidak kosong) dan user mengosongkan input: reset `position_id` ke `""` via `setValue`.
      - Cleanup `useEffect` listener saat unmount.
      - `register("position_id")` dihapus dari markup, nilai dikelola via `setValue` saja (schema Zod tetap validates `position_id` sebagai UUID).
      
      Files: `frontend/src/components/candidates/BulkAssignModal.tsx`
      Verify: `cd frontend && npm run type-check` — tidak ada error TS.

- [ ] 7. Tambahkan upload progress bar ke halaman `/candidates/new`
      Perubahan di `BulkCVUploadPage`:
      
      a) Tambahkan state `uploadProgress: number` (0–100), initial `0`.
      
      b) Di `uploadMutation.mutationFn`, tambahkan `onUploadProgress` ke axios call:
      ```typescript
      const response = await api.post("/api/v1/candidates/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(pct);
          }
        },
      });
      ```
      Reset `uploadProgress` ke 0 di `onSuccess` dan `onError`.
      
      c) Tampilkan progress bar di bawah file list saat `uploadMutation.isPending`:
      ```tsx
      {uploadMutation.isPending && uploadProgress > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>Mengupload...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-primary-600 transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
      ```
      
      d) Update `StatusBadge`: saat status `"uploading"` tampilkan `"⏳ Terkirim — AI sedang memproses"` (bukan `"Sedang diproses"`). Note: status `"uploading"` diset saat mutationFn mulai, dan diubah ke `"done"` di onSuccess. Jadi setelah upload sukses, `fileStatuses` semua menjadi `"done"` dan badge kembali ke `"✅ Berhasil diekstrak"`. Perubahan label `"uploading"` ini berlaku selama proses berlangsung.
      
      e) Tambahkan teks informatif di bawah file list setelah upload sukses (`hasUploaded === true`):
      ```tsx
      {hasUploaded && (
        <p className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
          File berhasil diupload. AI sedang mengekstrak data — hasil dapat dilihat di halaman{" "}
          <Link href="/candidates/pending-review" className="font-medium underline">
            Pending Review
          </Link>.
        </p>
      )}
      ```
      Render pesan ini di dalam card dropzone, setelah file list, sebelum progress bar area.
      
      Files: `frontend/src/app/(dashboard)/candidates/new/page.tsx`
      Verify: `cd frontend && npm run type-check` — tidak ada error TS.

- [ ] 8. Full build verification
      Jalankan build lengkap untuk memastikan semua perubahan compile tanpa error.
      Files: — (tidak ada file baru)
      Verify: `cd frontend && npm run build` — build sukses tanpa TypeScript error atau build error.

---

## TypeScript Considerations

1. **`CreateCandidateResult` interface** — definisikan di `CandidateForm.tsx` atau export dari `types/index.ts`. Karena hanya dipakai di dua file (form + page), letakkan di `CandidateForm.tsx` sebagai named export.

2. **`preventNavigationOnCreate` prop** — tipe `boolean | undefined`, default `false`. Tidak memerlukan perubahan di tempat lain karena prop opsional.

3. **`onUploadProgress` di axios** — `ProgressEvent` dari axios sudah typed via `axios` package, field `progressEvent.total` bertipe `number | undefined`, sudah dihandle dengan null-check (`if (progressEvent.total)`).

4. **Combobox state** — semua state lokal (`comboQuery: string`, `comboOpen: boolean`) tidak perlu masuk ke react-hook-form schema. `position_id` tetap dikontrol via `setValue` dan divalidasi oleh Zod schema yang ada.

5. **`isRole` selector** — `useAuthStore((state) => state.isRole)` sudah correct — `isRole` adalah fungsi stabil yang di-capture dari store, tidak menyebabkan re-render loops.

6. **`BlacklistWarningModal` markup** — gunakan `role="dialog"`, `aria-modal="true"`, `aria-labelledby` untuk accessibility compliance.
