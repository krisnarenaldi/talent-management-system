# Delete Candidate Review — `/applications?view=all`

## Evidence Summary

### 1. Delete button appears on every row (`view=all`)

`ApplicationsPipeline` renders when `viewAll === true` (line ~869, `searchParams.get("view") === "all"`). Inside the pipeline table, every `applications.map(...)` row conditionally renders a delete `<button>` guarded by `{canDelete && ...}` (page.tsx ~780). The button calls `handleDeleteClick(application.id, application.candidate_name)` to open the confirmation dialog. ✅

### 2. Confirmation dialog shown before delete

State `deleteConfirm: { id, name } | null` controls a modal overlay (`fixed inset-0 z-50 …`) that is rendered at the bottom of `ApplicationsPipeline`. The modal requires a second click ("Ya, Hapus") before `handleDeleteConfirm` is called, and shows a spinner while `deleting === true`. The cancel button clears the state without deleting. ✅

### 3. Hard delete endpoint used (not soft delete / status change)

Frontend calls `api.delete(\`/api/v1/applications/${deleteConfirm.id}\`)` (page.tsx ~352).

Backend endpoint (`routers/applications.py` lines 815–838):

```python
@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(..., current_user=Depends(require_role("hr", "manager", "admin"))):
    application = db.query(Application).filter(Application.id == application_id).first()
    # Nullify FK on ai_screening_result to avoid constraint error
    if application.ai_screening_result:
        application.ai_screening_result.application_id = None
    db.delete(application)
    db.commit()
```

`db.delete()` + `db.commit()` is a hard delete. The `Application` model has `stage_histories = relationship("StageHistory", ..., cascade="all, delete-orphan")` and `StageHistory.application_id` has `ondelete="CASCADE"`, so stage history rows are removed with the parent. No `is_deleted` flag is set. ✅

### 4. Table refreshes after successful delete

After `api.delete(...)` resolves, `queryClient.invalidateQueries({ queryKey: ["applications"] })` is called (page.tsx ~354). The active query key is `["applications", { …filters… }]`, which is a prefix match under React Query's default behavior — the invalidation correctly refetches the pipeline list and removes the deleted row. `setDeleteConfirm(null)` closes the dialog before invalidation. ✅

### 5. TypeScript correctness

- `deleteConfirm` typed as `{ id: string; name: string } | null` — matches usage.
- `canDelete` derived the same way as the existing `canCreateApplication` and `canExport` guards — consistent pattern.
- `useQueryClient` imported from `@tanstack/react-query` (already in imports at top of file).
- `api.delete(...)` call is consistent with existing `api.get(...)` / `api.post(...)` calls throughout the file.
- No new type imports or declarations required. ✅

### 6. Code style and existing patterns followed

- State hooks (`useState`, `useQueryClient`) added next to the existing hook block.
- Modal markup uses the same Tailwind utility classes and `material-symbols-outlined` icons as other modals in the codebase.
- `canDelete` guard pattern mirrors `canCreateApplication` and `canExport` — same role array, same `normalizeRole()` helper. ✅

### 7. No unrelated feature changes

Changes are confined to `ApplicationsPipeline` within `frontend/src/app/(dashboard)/applications/page.tsx`. The `ApplicationsSummary` component, all other pages, and backend routes other than the new `DELETE /{application_id}` endpoint are unaffected. The new backend endpoint is a standalone addition that does not alter existing GET/POST/PATCH routes. ✅

## No blockers found.
