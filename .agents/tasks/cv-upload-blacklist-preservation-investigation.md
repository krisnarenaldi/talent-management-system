# Investigation: CV Upload Against a Blacklisted Candidate on /candidates/new

**Question (original):** Pada halaman `/candidates/new`, jika saya upload CV baru terhadap kandidat yang sudah di-blacklist, apakah alasan blacklist akan hilang? Apakah sistem hanya meng-update data (skill, pengalaman kerja, dll) tanpa mengganggu data lain?

**Mode:** Read-only investigation. No files were modified.

---

## Summary answer

**Alasan blacklist TIDAK akan hilang.** Blacklist disimpan di tabel terpisah (`blacklist`), bukan sebagai kolom pada `candidate`. Flow upload CV di `/candidates/new` (`POST /api/v1/candidates/bulk-upload` → arq job `process_cv_ingestion`) **tidak pernah menulis ke tabel `blacklist`**, jadi `reason`, `status_type`, `is_active`, dan `is_approved` tetap utuh. Status "blacklisted" kandidat juga tidak akan kembali ke "active"/"pending" karena `is_blacklisted` adalah field hasil komputasi dari relasi blacklist — dan relasi itu tidak disentuh.

Update yang dilakukan terhadap kandidat yang sudah ada (cocok duplikat) **sebagian besar aditif**, tapi **tidak 100% "tanpa ganggu data lain"**:

- Di-update: `full_name`, `email`, `phone` (ditimpa langsung), `source_channel` (hanya jika kosong), `skills` (DIGANTI total, bukan di-merge — ini risiko kehilangan skill lama yang tidak ada di CV baru), `possible_duplicate` (diset `True`).
- Pengalaman kerja: dicocokkan per nama perusahaan, lalu di-update sebagian (`tools` & tanggal ditimpa bila ada; `description`/`job_title` hanya diisi bila masih kosong); entri baru ditambahkan. Data lama **tidak dihapus**.
- Pendidikan: hanya menambahkan institusi baru (yang belum ada); entri lama tidak disentuh.
- CV baru disimpan sebagai dokumen `CV_asli` baru.
- **TIDAK disentuh:** NIK/`identity_no`, tanggal & tempat lahir, gender, golongan darah, status perkawinan, domisili, foto, gaji, `notes`, dan semua field status (`completeness_status`, `contact_status`, `pool_status`), serta seluruh baris di tabel `blacklist`.

---

## The flow from frontend upload to DB

### 1. Frontend: `/candidates/new` is a bulk CV upload page

File: `frontend/src/app/(dashboard)/candidates/new/page.tsx` (`BulkCVUploadPage`).

The page is a drag-and-drop / file-picker uploader. It posts the files to the candidates bulk-upload endpoint:

```tsx
const response = await api.post("/api/v1/candidates/bulk-upload", formData, {
  headers: { "Content-Type": "multipart/form-data" },
  ...
});
```

(There is a separate manual form at `/candidates/manual/new` using `CandidateForm` in `create` mode, and an edit-mode-only "Upload Data Terakhir" button inside `CandidateForm` that calls a different endpoint — see "Other upload paths" below. The `/candidates/new` page itself is purely the bulk upload.)

### 2. Backend: `POST /api/v1/candidates/bulk-upload` — synchronous enqueue, no candidate created yet

File: `backend/app/routers/candidates.py`, function `bulk_upload_candidates` (lines 349–524).

This endpoint only:
- validates file count/size/extension,
- uploads each file to storage (`candidates/raw_cv`),
- creates an `AIScreeningResult` row with `candidate_id=None`, `status="menunggu_ekstraksi"`,
- enqueues an arq job `process_cv_ingestion` per screening id.

No candidate record is created or updated here — it returns `202 Accepted` immediately.

### 3. Backend worker: `process_cv_ingestion` — the actual candidate create/update

File: `backend/app/services/cv_pipeline.py`, function `process_cv_ingestion` (line 577).

Steps (line refs from this file):
- Download file from storage, extract text (PDF/DOCX), validate length.
- Step 4: call LLM to extract structured data → `extracted` dict (`nama`, `email`, `telepon`, `nik`, `skills`, `pendidikan`, `pengalaman_kerja`).
- Normalize phone (`_normalize_phone`), line ~643.
- **Step 5 — Cek duplikat** (lines 644–779): `candidate_service.check_duplicate(...)` by email/phone/NIK.
- **Step 6 — Cek blacklist** (lines 780–797): `candidate_service.check_blacklist(...)` — only reached if NOT a duplicate.
- **Step 7 — Simpan kandidat baru** (line 798+): only reached if neither duplicate nor blacklisted.

---

## Q2. How is "new vs already exists" decided?

`backend/app/services/candidate_service.py`, `check_duplicate` (line 10). Match fields, in priority order:

1. **email** — `Candidate.email == email` (line ~24)
2. **phone** — `Candidate.phone.in_(phone_variants(phone))` (line ~28), normalizing variants so `+62812...` and `0812...` match
3. **identity_no (NIK)** — `Candidate.identity_no == identity_no` (line ~32)

Returns `{"is_duplicate": bool, "existing_id": str|None}`. The query does **not** filter by `is_deleted`, so a soft-deleted candidate can still match. An `exclude_candidate_id` param lets the caller skip a specific id (used by the edit endpoint, not by ingestion).

**Important:** the duplicate check has no `is_deleted` filter, so a candidate that was soft-deleted (`is_deleted=True`) is still treated as a duplicate and its row gets updated (see Q3).

## Q3. Duplicate found — UPDATE existing, or CREATE new?

**UPDATE the existing record.** `process_cv_ingestion`, lines 652–767:

```python
if dup["is_duplicate"]:
    existing_candidate = db.query(Candidate).filter(Candidate.id == dup["existing_id"]).first()
    if existing_candidate:
        # Pembaruan CV: update data kandidat dengan data terbaru (merge, tidak overwrite dengan null)
        if extracted.get("nama"):
            existing_candidate.full_name = extracted["nama"]
        if extracted.get("email"):
            existing_candidate.email = extracted["email"]
        if extracted.get("telepon"):
            existing_candidate.phone = extracted["telepon"]
        if result.source_channel and not existing_candidate.source_channel:
            existing_candidate.source_channel = result.source_channel
        if extracted.get("skills"):
            existing_candidate.skills = extracted["skills"]
        existing_candidate.possible_duplicate = True
        ...   # education + experience merge, then db.commit()
        result.candidate_id = existing_candidate.id
        result.status = "duplikat"
        ...
        return
```

It loads the existing candidate, mutates the same ORM object, commits, attaches the new CV as a `CV_asli` document, sets `result.status = "duplikat"`, and `return`s — so Step 6 (blacklist) is never reached for an existing candidate.

The only path that creates a *new* candidate is Step 7 (line 798+), reached only when the candidate is neither a duplicate nor blacklisted.

## Q4. Which fields are updated vs left untouched (on the existing/duplicate candidate)?

All references are `backend/app/services/cv_pipeline.py`, `process_cv_ingestion`, duplicate branch (lines 656–767).

### Updated
| Field | Behavior | Line |
|---|---|---|
| `full_name` | Overwritten if `extracted["nama"]` present (unconditional, not "only if empty") | 659 |
| `email` | Overwritten if `extracted["email"]` present (unconditional) | 661 |
| `phone` | Overwritten if `extracted["telepon"]` present (unconditional) | 663 |
| `source_channel` | Set **only if** candidate's `source_channel` was empty | 664–665 |
| `skills` (JSONB on `Candidate`) | **Replaced entirely** with `extracted["skills"]` (NOT merged) | 667 |
| `possible_duplicate` | Set to `True` | 668 |
| `CandidateEducation` rows | Append-only: new institution added only if no existing row matches `institution.ilike("%inst%")`. Existing rows left untouched (major/year/gpa not modified). | 678–690 |
| `CandidateExperience` rows | Matched by `company_name.ilike("%comp%")`. If matched: `tools` overwritten if present, `start_date`/`end_date` overwritten if present (end set `None` for "present"), `description`/`job_title` filled **only if still empty**. If not matched: new row added. **Old rows are never deleted.** | 708–738 |
| `CandidateDocument` | A new `CV_asli` document is attached | 744–754 |

### Left untouched (on `Candidate`)
`identity_no` (NIK), `birth_date`, `birth_place`, `gender`, `blood_type`, `marital_status`, `domicile`, `photo_url`, `current_salary`, `expected_salary`, `notice_period_days`, `notes`, and the status fields `completeness_status`, `contact_status`, `pool_status`, plus `talent_pool_reason`/`talent_pool_notes`/`talent_pool_updated_at`/`talent_pool_updated_by`, and `is_deleted`. (Confirmed against the model in `backend/app/models/candidate.py` — none of these are assigned in the duplicate branch.)

### Two caveats vs the "hanya update data" expectation
- **`skills` is replaced, not merged.** Skills that existed before but are absent from the new CV will be lost. (Contrast with the edit-mode `upload-latest-data` endpoint, which merges skills — see below.)
- **`full_name`, `email`, `phone` are overwritten unconditionally** when the new CV provides them, so any manual corrections to those three fields would be overwritten.

## Q5. CRITICAL — Is the blacklist reason/status preserved?

**Yes, preserved.** Where blacklist lives:

`backend/app/models/blacklist.py`, class `Blacklist` — a **separate table** keyed by `candidate_id`:
```python
class Blacklist(Base):
    __tablename__ = "blacklist"
    candidate_id = Column(UUID, ForeignKey("candidate.id"), index=True)
    status_type_id = Column(UUID, ForeignKey("blacklist_status_type.id"), nullable=False)
    reason = Column(String(500))
    notes = Column(Text)
    blacklisted_date = Column(Date)
    is_approved = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True, nullable=False)  # False = dicabut
```

`is_blacklisted` on the `Candidate` response is **not a DB column** — it is computed from active+approved `Blacklist` rows. This is stated explicitly in `candidates.py` (lines 765–772):
```python
# Set is_blacklisted secara eksplisit — field ini tidak ada di kolom DB,
# harus dihitung dari relasi blacklist.
candidate.is_blacklisted = db.query(Blacklist).filter(
    Blacklist.candidate_id == candidate.id,
    Blacklist.is_active == True,
    Blacklist.is_approved == True,
).first() is not None
```

**Does the CV upload path touch the blacklist table?** No. `process_cv_ingestion`'s duplicate-update branch (lines 656–767) only writes to `Candidate`, `CandidateEducation`, `CandidateExperience`, `CandidateDocument`, and the `AIScreeningResult` row. It never issues a query or write against `Blacklist` in that branch — it `return`s at line 779 before the blacklist check at line 780. So every `Blacklist` column (`reason`, `status_type_id`, `is_active`, `is_approved`, `blacklisted_date`, `pic_user_id`, `notes`) is left exactly as-is.

The blacklist check at Step 6 (lines 780–797) is only a **read** (`check_blacklist`), and it is unreachable for an existing candidate because the duplicate branch returns first. Even when it does run (truly-new candidate), it only sets `result.status = "blacklisted"` and returns — it creates nothing and modifies no blacklist rows.

## Q6. Does re-uploading change the candidate's status (blacklisted → active/pending)?

**No.** There is no single "status" column on `Candidate` that holds `blacklisted/active/pending`. The status-ish columns are `completeness_status` (`lengkap`/`belum_lengkap`), `contact_status` (`aktif`/`tidak_bisa_dihubungi`), and `pool_status` (`database`/`talent_pool`/`future_lead`) — see `backend/app/models/candidate.py`. None of these are assigned in the duplicate-update branch, so none are reset.

The only status-like flag the branch sets on `Candidate` is `possible_duplicate = True` (line 668) — that is a "this record matched a later upload" flag, not a blacklist state.

Because `is_blacklisted` is derived from the untouched `Blacklist` rows, re-uploading leaves the candidate **still blacklisted**. There is no code path in `process_cv_ingestion` that flips a blacklist off or moves a blacklisted candidate back to an active/pending state.

---

## Other upload paths (for completeness)

### `/candidates/manual/new` → `POST /api/v1/candidates` (manual create form)
`backend/app/routers/candidates.py`, `create_candidate` (line 314). It runs `check_duplicate` (line ~324) and raises **HTTP 409** on a duplicate — so it does NOT silently update an existing candidate, and it never clears blacklist (it only *reads* blacklist via `check_blacklist` at line ~331 to attach warning flags to the response). So the manual form cannot silently overwrite a blacklisted candidate either.

### Edit-mode "Upload Data Terakhir" → `POST /api/v1/candidates/{id}/upload-latest-data`
`backend/app/routers/candidates.py`, `upload_latest_data` (line 1012). This is the button in `CandidateForm` shown **only in edit mode** (`mode === "edit" && candidateId` in `frontend/src/components/candidates/CandidateForm.tsx`). It extracts a PDF via AI and updates the candidate. Field behavior differs from ingestion and is worth noting:

- `full_name`: set **only if** empty or `"Unknown"` (safer than ingestion's overwrite).
- `email`, `phone`: set **only if** empty.
- `gender`, `marital_status`: set if different.
- `skills`: **merged** (existing + new, de-duped) — `merged_skills = list(dict.fromkeys(existing_skills + ...))`.
- `CandidateEducation`: matched by `institution` (exact `.lower()`), and only fills missing `major`/`graduation_year`/`gpa`; new ones added.
- `CandidateExperience`: **DELETES all old experiences and replaces** with the AI-extracted set (`db.query(CandidateExperience).filter(...).delete()`).

This endpoint also never touches the `blacklist` table, so the blacklist reason/status is preserved here too. The notable risk on this path is the **full replacement of work experience** (old experience entries are wiped and replaced).

### `/applications/new` bulk upload → `POST /api/v1/applications/bulk-upload-cv`
`backend/app/routers/applications.py`, `bulk_upload_cv` (line 1027) → enqueues `process_cv_screening`. That job (`cv_pipeline.py` line 469) has the **same** duplicate/blacklist structure as `process_cv_ingestion` (duplicate check → update existing → return; blacklist check → `status="blacklisted"` → return; else create). So for an existing blacklisted candidate, `/applications/new` bulk upload also updates the existing record and preserves the blacklist — with the same `skills`-replace caveat.

---

## Conclusions

1. **Blacklist reason is safe.** Re-uploading a CV against an existing blacklisted candidate on `/candidates/new` updates the existing `candidate` row and leaves the `blacklist` table completely untouched. The reason, status type, approval, and active flag all persist.
2. **No status reset.** No candidate "status" column is flipped; `is_blacklisted` stays `True` because it is computed from the unmodified blacklist rows. The only flag changed is `possible_duplicate` (set to `True`).
3. **Update is mostly additive, with two real risks to "data lain":**
   - `skills` is **replaced**, not merged — skills not present in the new CV are lost.
   - `full_name`, `email`, `phone` are **overwritten unconditionally** when the new CV supplies them — manual edits to those three fields can be lost.
4. Everything else (NIK, birth info, gender, blood type, marital status, domicile, photo, salary, notes, `completeness_status`, `contact_status`, `pool_status`, talent-pool fields) is preserved.
5. The screening result for such an upload is marked `"duplikat"` (not `"blacklisted"`), so in Pending Review it appears as a duplicate update rather than a blacklisted case. This is cosmetic for the user's concern but worth knowing.

## Recommendations (not implemented)

- **Merge `skills` instead of replacing** in `process_cv_ingestion`'s duplicate branch (`cv_pipeline.py` line 667), mirroring the de-duped merge already used in `upload-latest-data`. This is the clearest "ganggu data lain" risk today.
- **Guard `full_name`/`email`/`phone` overwrites** the same way `upload-latest-data` does (only fill when empty, or only when the new value is non-empty AND the existing value is empty/`"Unknown"`), to avoid clobbering manual corrections. At minimum, prefer not overwriting `email` if it is already set, since email is the primary duplicate key.
- Optionally, surface a distinct screening status (e.g. `"duplikat_blacklisted"`) when the matched existing candidate is itself blacklisted, so HR can see in Pending Review that a blacklisted candidate's CV was refreshed — without changing any data.
- Apply the same `skills`-merge change to `process_cv_screening` (the `/applications/new` path), which shares the identical code.
