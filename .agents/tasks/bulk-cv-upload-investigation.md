# Bulk CV Upload — Investigation Report

**Date:** 2025-07-22  
**Scope:** Two bugs related to bulk CV upload in the Talent Management System  
**Status:** READ-ONLY investigation — no code changes made

---

## Executive Summary

**Bug 1 (No notification):** The bell notification is NOT broken — it is _delayed_. The
`NotificationBell` component polls the `/api/v1/notifications/` endpoint every **30 seconds**.
The backend only creates the notification record after **all files in the batch have finished
async processing** by the arq worker. For a large batch (10–20 CVs), the worker may take
60–120+ seconds. If the user stays on `/candidates/new` (no refetch triggered on that page) the
bell will not update until the next 30-second tick fires, or until the user navigates away and
back. The page itself shows a static "processing" message and never programmatically invalidates
the `["notifications"]` query. This gives the impression that no notification arrived when in
reality it just hasn't been fetched yet.

**Bug 2 (Phone number not normalized):** Confirmed. The `normalize_phone` function exists in
`backend/app/core/phone_utils.py` and is called in **both** the manual candidate create and
update endpoints (`candidates.py` lines 316 and 804). It is **never called** in the bulk
ingestion worker (`cv_pipeline.py`). Phone numbers from LLM extraction land directly into the
`Candidate.phone` column as raw strings — e.g. `"+628123456789"`, `"0812 345 6789"` with
spaces, `"8123456789"` without leading zero.

---

## Bug 1 — No Bell Notification After Bulk CV Upload

### System Design

The notification lifecycle for bulk ingestion is:

```
User uploads files (POST /api/v1/candidates/bulk-upload)
  → backend immediately returns 202 Accepted (screening_ids queued)
  → arq worker picks up each job: process_cv_ingestion(screening_result_id)
    → per-job: downloads file, calls LLM, writes Candidate record, sets status="selesai"|"error"|"duplikat"|"blacklisted"
    → LAST job to finish: calls _create_candidate_ingestion_notification()
      → writes a Notification row to the DB
NotificationBell (polls /api/v1/notifications/ every 30 seconds) picks it up on the next tick
```

### What the frontend does after upload

**File:** `frontend/src/app/(dashboard)/candidates/new/page.tsx`

```tsx
onSuccess: (data) => {
  setUploadResult(data);
  setHasUploaded(true);
  setUploadProgress(0);
  setFileStatuses((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
  showToast("success", data.message || "CV berhasil diupload dan sedang diproses.");
},
```

- A **toast** fires immediately (this works — the toast appears).
- **No** `queryClient.invalidateQueries({ queryKey: ["notifications"] })` is called.
- **No** polling or subscription is started for the background job status.
- The page just shows a static banner saying "you'll get a bell notification when done."

### What the bell component does

**File:** `frontend/src/components/NotificationBell.tsx` — lines 31–37

```tsx
const { data: notifications = [], isLoading } = useQuery({
  queryKey: ["notifications"],
  queryFn: fetchNotifications,
  refetchInterval: 30000,   // ← only polls every 30 seconds
  retry: 1,
  throwOnError: false,
});
```

The bell refetches every 30 seconds. It will **not** refresh faster just because a batch
finished.

### Root cause

There is a **timing gap**: the notification is written to DB only after the last arq job in the
batch completes (asynchronously — could be 30 seconds to several minutes after upload). The
bell's 30-second polling window means the user will miss it if:

1. They uploaded a batch and the last job finishes within the current 30-second polling window
   but just after the previous poll tick — they will see the notification within ≤ 30 s. ✅
2. They navigate away from the page immediately, and the next poll fires before the notification
   row is created — they see nothing until the tick _after_ the job finishes. That can easily
   be 30–60+ seconds of apparent silence.
3. The `throwOnError: false` and `retry: 1` flags mean a single failed poll silently drops the
   notification for up to 60 seconds (one missed tick + one retry delay). ⚠️

### Additional backend consideration

**File:** `backend/app/services/cv_pipeline.py` — function `_create_candidate_ingestion_notification` (around line 245)

The function checks `if not batch_id: ... return`. Older `AIScreeningResult` rows without
`batch_id` will silently skip notification creation. This is an edge case for data before the
`batch_id` migration, but worth noting.

Also: if all CVs in a batch are `"duplikat"` or `"blacklisted"` (neither `success_count` nor
`error_count` > 0) the notification is still built because `total_batch = success_count +
duplicate_count + blacklisted_count + error_count`. However, if total_batch == 0 the function
returns early without a notification. This is an unlikely but possible scenario.

### What fix is needed

**Recommended fix (frontend — `frontend/src/app/(dashboard)/candidates/new/page.tsx`):**

After the `onSuccess` callback fires, start a short polling loop that invalidates the
`["notifications"]` query until the backend notification arrives (or a reasonable timeout):

```tsx
import { useQueryClient } from "@tanstack/react-query";

// inside uploadMutation.onSuccess:
onSuccess: (data) => {
  setUploadResult(data);
  setHasUploaded(true);
  setUploadProgress(0);
  setFileStatuses((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
  showToast("success", data.message || "CV berhasil diupload dan sedang diproses.");

  // Poll notifications more aggressively until the batch completes
  let attempts = 0;
  const pollInterval = setInterval(() => {
    attempts++;
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    if (attempts >= 20) clearInterval(pollInterval); // stop after ~10 minutes
  }, 30_000);
},
```

Or a simpler alternative: reduce `refetchInterval` in `NotificationBell` from 30 000 ms to
10 000 ms. This is a system-wide change so the 30 s default is fine; the targeted fix is
preferred.

**Alternatively (simplest):** on `onSuccess`, immediately call:
```tsx
queryClient.invalidateQueries({ queryKey: ["notifications"] });
```
This forces a single immediate refetch of notifications. If the backend is fast (small batch),
the notification may already exist. For large batches the user still waits for the natural 30 s
poll, but this at least closes the "just-missed-the-tick" race condition.

---

## Bug 2 — Phone Number Not Normalized During Bulk CV Upload

### Where the formatter is defined

**File:** `backend/app/core/phone_utils.py`  
**Function:** `normalize_phone(value: str | None) -> str`

The function:
- Strips all non-digit characters (spaces, `+`, `-`, `()`, letters)
- Converts `62xxx` → `08xxx` (Indonesian country code → leading zero)
- Converts `8xxx` → `08xxx` (missing leading zero)
- Returns a plain-digit string like `"081234567890"`

### Where it IS called (manual edit flow)

**File:** `backend/app/routers/candidates.py`

- **Line 41:** `from app.core.phone_utils import normalize_phone as _normalize_phone`
- **Line 316** — `POST /candidates` (create manually):
  ```python
  payload.phone = _normalize_phone(payload.phone) or None
  ```
- **Line 804** — `PUT /candidates/{id}` (manual update):
  ```python
  if "phone" in payload.model_dump(exclude_unset=True):
      payload.phone = _normalize_phone(payload.phone) or None
  ```

### Where it is NOT called (bulk upload flow)

**File:** `backend/app/services/cv_pipeline.py`

`normalize_phone` is **never imported and never called** in this file.

Phone numbers are stored raw from the LLM extraction result in three places:

1. **Line 597** — duplicate update path:
   ```python
   if extracted.get("telepon"):
       existing_candidate.phone = extracted["telepon"]  # ← not normalized
   ```

2. **Line 669** — new candidate creation:
   ```python
   candidate = Candidate(
       full_name=extracted.get("nama") or "Unknown",
       email=extracted.get("email"),
       phone=extracted.get("telepon"),              # ← not normalized
       ...
   )
   ```

3. **Line 582** — `check_duplicate` call uses the raw phone for lookup:
   ```python
   dup = candidate_service.check_duplicate(
       db,
       email=extracted.get("email"),
       phone=extracted.get("telepon"),              # ← raw, may miss existing normalized records
       identity_no=extracted.get("nik"),
   )
   ```
   > **Side-effect:** The duplicate check may also fail to match an existing candidate whose
   > phone is stored in `08xxx` format if the LLM returned `+628xxx` or `0812 xxx yyy`. The
   > `candidate_service.check_duplicate` likely uses `phone_variants()` from `phone_utils.py`
   > to handle this, but confirming this is secondary.

### Where to add the fix

**File:** `backend/app/services/cv_pipeline.py`

**Step 1 — Import at the top of the file:**
```python
from app.core.phone_utils import normalize_phone as _normalize_phone
```

**Step 2 — Normalize before any phone usage, immediately after LLM extraction:**

After the line `extracted = await _call_llm_extract(cv_text_stripped, was_truncated)` (around
line 576 in `process_cv_ingestion`), add:

```python
# Normalize phone number to consistent format (08xxx, digits only)
if extracted.get("telepon"):
    extracted["telepon"] = _normalize_phone(extracted["telepon"]) or None
```

This single change fixes all three downstream usages: the duplicate check, the duplicate-update
path, and the new Candidate creation.

---

## Additional Findings

### 1. `batch_id` is None for legacy records
`_create_candidate_ingestion_notification` returns early with a warning log if `batch_id` is
`None` (line ~245 in `cv_pipeline.py`). Old screening records without `batch_id` will never
trigger a notification. This is noted in a code comment but worth tracking.

### 2. The toast fires immediately on upload — it works
The `showToast("success", ...)` in `BulkCVUploadPage.onSuccess` fires immediately when the
`POST /api/v1/candidates/bulk-upload` returns `202 Accepted`. This is working correctly. What
is missing is the **bell notification** which comes 30–120+ seconds later from the async
worker. The two mechanisms are independent.

### 3. No per-file progress feedback from the worker
The page has no way to know which files have been processed by the arq worker. The "done"
badge on each file line item is set when the HTTP upload completes (not when AI extraction
completes). Users may misinterpret this as extraction being complete.

### 4. Duplicate check may silently bypass on unnormalized phone
If an existing candidate's phone is stored as `"081234567890"` (normalized), and the LLM
extracts `"+628123456789"` from the new CV, the duplicate check depends on `phone_variants()`
in `candidate_service.check_duplicate`. Fixing Bug 2 (normalizing before the check) also
makes this more reliable.

---

## Summary Table

| # | Bug | Root cause file | Line(s) | Fix file | Fix type |
|---|-----|-----------------|---------|----------|----------|
| 1 | No bell notification | `frontend/src/app/(dashboard)/candidates/new/page.tsx` | `onSuccess` handler (no `invalidateQueries`) | Same file | Add `queryClient.invalidateQueries({ queryKey: ["notifications"] })` in `onSuccess` |
| 2 | Phone not normalized | `backend/app/services/cv_pipeline.py` | ~576 (new candidate), ~597 (dup update) | Same file | Import `normalize_phone`, call it on `extracted["telepon"]` after LLM extraction |
