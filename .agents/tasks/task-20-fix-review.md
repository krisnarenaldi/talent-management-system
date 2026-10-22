# TASK-20 Code Review Fix Verification

Fixes applied to: TASK-20.2 RBAC, TASK-20.2 Combobox, TASK-20.3 Progress UX, Fix 1 (DuplicateWarningBanner + BlacklistWarningModal + manual/new page).

All four issues flagged in the original code review have been addressed. The RBAC check no longer parses role strings. The position dropdown is now a proper combobox. The upload page shows real upload progress. The manual/new route now exists and surfaces blacklist/duplicate state via dedicated UI components. No blocking regressions detected in the areas reviewed.

**Watch for:**
- `onCreateResult` fires **before** education/experience sub-requests complete (confirmed). The callback triggers immediately after the `POST /api/v1/candidates` call resolves, before the per-section PUT/POST loop runs. If a sub-request fails, the page has already displayed the DuplicateWarningBanner or BlacklistWarningModal — and if the user navigated away via the banner, the education/experience saves were never sent to the API.
- `StatusBadge` for `"uploading"` now shows `"⏳ Sedang diupload"` — accurate during the HTTP transfer phase, but the plan called for `"⏳ Terkirim — AI sedang memproses"` as the post-upload label. The current label reverts to `"✅ Berhasil diekstrak"` on success anyway, so the mismatch is cosmetic, not functional.

**Verdict**: APPROVED

---

## High-level view

Fix 2 (RBAC) is a clean swap. `user.role?.split(".").pop()` is gone; `isRole("admin", "manager")` is the single call site, pulling from a store function that does `roles.includes(user.role)` against the flat `UserRole` union (`"admin" | "hr" | "manager" | "pm"`). The `user` selector is no longer imported. No other file in the modal needed to change.

Fix 3 (Combobox) replaces the `<select>` with an accessible inline combobox — `role="combobox"`, `aria-expanded`, `aria-controls`, `role="listbox"` on the dropdown list, `role="option"` per item. The `mousedown` handler on list items fires before the input's `blur` event, preventing the dropdown from closing before the click registers. Outside-click detection uses a `mousedown` listener on `document` scoped to a `ref`, removed on unmount. `setValue("position_id", ...)` drives the form value; `register("position_id")` is not attached to the input element. This is correct for a controlled combobox — Zod validates `position_id` as UUID at submit time.

Fix 4 (Progress UX) integrates `onUploadProgress` directly into the axios call. `uploadProgress` state is reset to 0 in both `onSuccess` and `onError`. The progress bar is gated on `uploadMutation.isPending && uploadProgress > 0`, so it disappears on completion. A post-upload informational banner (blue, with a link to Pending Review) is rendered when `hasUploaded && !uploadMutation.isPending`. The `StatusBadge` label during upload reads `"⏳ Sedang diupload"` — accurate for the transfer phase.

Fix 1 (DuplicateWarningBanner + BlacklistWarningModal + manual/new page) ships the three new files the original review flagged as missing. `CandidateForm` gained two optional props: `onCreateResult?: (result: CreateCandidateResult) => void` and `preventNavigationOnCreate?: boolean`. The manual/new page sets both — it holds navigation, shows the banner or modal based on result, and lets the user choose when to navigate. The existing `/candidates/new` bulk upload route continues to use `CandidateForm` in default mode with neither prop, so its behavior is unchanged.

The sequencing issue in `CandidateForm` is worth noting: `onCreateResult` fires immediately after the candidate POST resolves, before the education/experience sub-requests run. If the user acts on the modal/banner and navigates away during that window, sub-requests that haven't fired yet are abandoned.

<details>
<summary>Issues (2)</summary>

1. **onCreateResult fires before sub-requests complete** — `onCreateResult` is called right after `POST /api/v1/candidates` returns, before the education/experience loop runs (lines 279-281 in CandidateForm.tsx, before lines 295-350 which send per-section data). The manual/new page may navigate to the candidate detail page or show modal actions before education/experience are persisted. Mitigate by moving the `onCreateResult` call to just before the final `router.push` (after all sub-requests), alongside the existing `showToast("success", ...)` call.

2. **StatusBadge upload label diverges from plan** — The plan specified the `"uploading"` status badge should read `"⏳ Terkirim — AI sedang memproses"` to distinguish post-upload background processing from active transfer. The implementation shows `"⏳ Sedang diupload"` instead. Since the badge transitions immediately to `"✅ Berhasil diekstrak"` on success, this is cosmetic — but the intent was to surface the async AI processing state, which is currently not communicated by the badge. Non-blocking.

</details>

<details>
<summary>Details</summary>

### onCreateResult fires before education/experience sub-requests

`CandidateForm.handleSubmitForm` calls `onCreateResult({ candidateId: targetId, isBlacklisted, isDuplicate })` at line 279-281, which is inside the `if (mode === "create")` block that runs immediately after the `POST /api/v1/candidates` response. The education/experience PUT/POST loops begin around line 295 and complete somewhere around line 350. The `showToast("success", ...)` and final navigation block runs after those loops.

The consequence: the manual/new page receives the callback while sub-request work is still pending. If `isBlacklisted` is false and `isDuplicate` is false, `handleCreateResult` calls `router.push(`/candidates/${result.candidateId}`)` immediately, before education/experience data is saved. If `isBlacklisted` is true, the modal shows and waits for user action — but "Tetap Lanjut" also calls `router.push`, again potentially before sub-requests finish.

The fix is to move the `onCreateResult` call to the same location as the final navigation guard (after line 358), so it fires only once all sub-requests have completed. The flag `preventNavigationOnCreate` already gates `router.push` at that point — `onCreateResult` should be gated the same way.

### BlacklistWarningModal — no focus trap

`role="dialog"`, `aria-modal="true"`, and `aria-labelledby="blacklist-modal-title"` are all present. Focus is not moved programmatically when the modal opens, and there is no focus trap — keyboard users can tab through background content while the modal is visible. Non-blocking for current usage but worth addressing if keyboard accessibility is a requirement.

</details>

---

<details>
<summary>File map</summary>

- `frontend/src/components/candidates/BulkAssignModal.tsx` — RBAC fixed to use `isRole("admin", "manager")`; `<select>` replaced with inline accessible combobox with outside-click detection
- `frontend/src/app/(dashboard)/candidates/new/page.tsx` — `onUploadProgress` integrated into axios call; progress bar and post-upload informational banner added; progress reset on success/error
- `frontend/src/app/(dashboard)/candidates/manual/new/page.tsx` — New page wrapping `CandidateForm` with `preventNavigationOnCreate`, managing create result state, rendering `DuplicateWarningBanner` and `BlacklistWarningModal`
- `frontend/src/components/candidates/DuplicateWarningBanner.tsx` — New inline banner component for duplicate detection
- `frontend/src/components/candidates/BlacklistWarningModal.tsx` — New blocking modal for blacklist detection
- `frontend/src/components/candidates/CandidateForm.tsx` — Added `onCreateResult` and `preventNavigationOnCreate` props; `CreateCandidateResult` interface exported

Full diff: `git diff HEAD~N` or compare against the original task-20-code-review findings.

</details>
