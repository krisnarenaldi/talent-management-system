# Implementation Plan: Duplicate PIC Contact Validation

## Context

- **Frontend file**: `frontend/src/app/(dashboard)/admin/clients/page.tsx`
- **Backend file**: `backend/app/routers/clients.py`
- **Delimiter**: `;` (always)
- **No DB migration needed** — `pic_contact` column already exists as plain text, no unique constraint

---

## Plan

- [ ] 1. Add within-client duplicate contact check in `updatePic` (real-time validation).

  In `ClientFormModal`, inside the `updatePic` function, after the existing phone-format validation block for `field === "contact"`, add a second pass over the current `pics` array to detect if the trimmed, lowercased value of the incoming `value` already exists in another row's `contact`. If found, set `picErrors[index].contact` to `"Nomor kontak sudah digunakan oleh PIC lain di klien ini"`; if not found (and format is valid), clear the error.

  The logic for the new check — using the *updated* pics array (apply the change first via `setPics`, then run the duplicate check in the same handler, or compute a temporary array inline) — must avoid false-positives when the user is editing the only row that has that number.

  Concrete implementation detail: compute `updatedPics` inline as the new value of `pics` after the field change, then scan `updatedPics` for duplicates against index `i !== index` where `p.contact.trim().toLowerCase() === value.trim().toLowerCase()`.

  Files: `frontend/src/app/(dashboard)/admin/clients/page.tsx` — `updatePic` function only.

  Verify: TypeScript compiles — `cd frontend && npx tsc --noEmit --skipLibCheck 2>&1 | head -30` — zero errors.

---

- [ ] 2. Add within-client duplicate contact check in `onSubmit` (submit-time guard).

  In `ClientFormModal.onSubmit`, right after the existing `if (picErrors.some((e) => e.contact)) return;` guard, add a second check:

  ```ts
  // Check for duplicate contacts within this client
  const contacts = pics.map((p) => p.contact.trim().toLowerCase()).filter(Boolean);
  const hasDuplicate = contacts.some((c, i) => contacts.indexOf(c) !== i);
  if (hasDuplicate) {
    // Find which indices are duplicates and set errors
    const seen = new Map<string, number>();
    const newPicErrors = picErrors.map((e) => ({ ...e }));
    contacts.forEach((c, i) => {
      if (!c) return;
      if (seen.has(c)) {
        newPicErrors[i].contact = "Nomor kontak sudah digunakan oleh PIC lain di klien ini";
        const firstIdx = seen.get(c)!;
        newPicErrors[firstIdx].contact = "Nomor kontak sudah digunakan oleh PIC lain di klien ini";
      } else {
        seen.set(c, i);
      }
    });
    setPicErrors(newPicErrors);
    return;
  }
  ```

  Files: `frontend/src/app/(dashboard)/admin/clients/page.tsx` — `onSubmit` function only.

  Verify: `cd frontend && npx tsc --noEmit --skipLibCheck 2>&1 | head -30` — zero errors.

---

- [ ] 3. Add cross-client duplicate contact validation in `create_client` (backend).

  In `backend/app/routers/clients.py`, inside `create_client`, before the `Client(**payload.model_dump())` line, add:

  ```python
  if payload.pic_contact:
      new_contacts = [c.strip() for c in payload.pic_contact.split(";") if c.strip()]
      if new_contacts:
          existing_clients = db.query(Client).filter(Client.pic_contact != None).all()
          for existing in existing_clients:
              existing_contacts = [c.strip() for c in existing.pic_contact.split(";") if c.strip()]
              for nc in new_contacts:
                  if nc in existing_contacts:
                      raise HTTPException(
                          status_code=400,
                          detail=f"Nomor kontak PIC sudah digunakan oleh klien lain: {nc}",
                      )
  ```

  Files: `backend/app/routers/clients.py` — `create_client` function only.

  Verify: The backend container starts without import errors. Manually POST a client with a `pic_contact` that already exists in another client; expect a 400 response with the matching number in the detail string.

---

- [ ] 4. Add cross-client duplicate contact validation in `update_client` (backend).

  In `backend/app/routers/clients.py`, inside `update_client`, after fetching `client` (the 404 guard), before the `for key, value in ...` loop, add:

  ```python
  if payload.pic_contact:
      new_contacts = [c.strip() for c in payload.pic_contact.split(";") if c.strip()]
      if new_contacts:
          existing_clients = (
              db.query(Client)
              .filter(Client.pic_contact != None, Client.id != client_id)
              .all()
          )
          for existing in existing_clients:
              existing_contacts = [c.strip() for c in existing.pic_contact.split(";") if c.strip()]
              for nc in new_contacts:
                  if nc in existing_contacts:
                      raise HTTPException(
                          status_code=400,
                          detail=f"Nomor kontak PIC sudah digunakan oleh klien lain: {nc}",
                      )
  ```

  The filter `Client.id != client_id` ensures the client being edited is excluded — its own existing contacts don't trigger a false conflict.

  Files: `backend/app/routers/clients.py` — `update_client` function only.

  Verify: Same as step 3, but via PUT. Also verify that editing a client with its own existing contacts does NOT trigger a 400.

---

- [ ] 5. Verify frontend `onError` handlers already surface the backend error message correctly.

  `getErrorMessage` in `frontend/src/lib/errors.ts` already handles `detail` as a plain string — the message `"Nomor kontak PIC sudah digunakan oleh klien lain: 08xxx"` will pass through unchanged. **No changes needed** to `createMutation.onError` or `updateMutation.onError`.

  Verify: After completing steps 3–4, trigger a duplicate via the UI; confirm the toast shows the exact backend detail string (e.g. "Nomor kontak PIC sudah digunakan oleh klien lain: 08123456789"). This is an integration smoke test only — no code change required in this step.

---

- [ ] 6. Final TypeScript compile check.

  After all frontend changes are done:

  ```
  cd "/Users/krisnarenaldi/Documents/Projects/freelance/Talent Management System/frontend" && npx tsc --noEmit --skipLibCheck 2>&1 | head -30
  ```

  Expected: zero errors output.

---

## Notes & Assumptions

- **Case sensitivity**: Frontend duplicate check is case-insensitive (`.toLowerCase()`). Backend is case-sensitive trim-only (matching the task spec: "case-sensitive trim for backend"). This is intentional — frontend catches obvious same-case duplicates before submission, backend is the authoritative guard.
- **No unique DB constraint**: The plan does not add any SQL constraint. The backend check is application-level only, matching the task requirement.
- **Empty contacts are skipped**: Both frontend and backend ignore empty/whitespace-only contact values during duplicate detection.
- **Delimiter**: Always `;`, consistent with existing display code in the table (`client.pic_contact.split(";")`).
