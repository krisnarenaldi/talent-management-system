# Duplicate PIC contact validation across clients

The change adds duplicate-contact enforcement at two levels: frontend catches same-contact entries within a single client's PIC rows as the user types and on form submit; backend catches the same contact appearing across different clients on create and update. The storage format is a semicolon-delimited string in `pic_contact`; a previous migration dropped the DB-level unique constraint and widened the column to 500 chars to accommodate multiple contacts. The validation logic is implemented entirely in application code.

**Watch for:** Inactive client contacts are included in the cross-client uniqueness check — a phone number can't be reused even after the original client is deactivated. Whether that's the intended policy is not stated. The `onSubmit` in `ClientFormModal` calls `mutateAsync` without a surrounding try/catch; the rejection is suppressed by React Hook Form's `handleSubmit` wrapper but this reliance is implicit.

**Verdict**: APPROVED

---

## High-level view

The frontend performs two distinct checks: a live per-keystroke duplicate check in `updatePic`, and an `onSubmit` guard that re-checks duplicates across the full `pics` array before sending. Both layers operate on trimmed, lowercased values. The `onSubmit` scan uses a two-pass `seen` map that marks both the first occurrence and the duplicate, closing a gap in the `updatePic` `.some()` check which only marks the later entry.

The backend cross-client duplicate scan loads all clients with a non-null `pic_contact`, splits by `;`, strips whitespace, and does a linear intersection. On update it excludes the client being edited via `Client.id != client_id`. No `is_active` filter is applied, so deactivated clients' contacts permanently block reuse. No DB-level unique constraint remains, so the enforcement is soft — a concurrent create could race past — but this is acceptable for an internal admin tool.

Error responses from the backend (HTTP 400 with a string `detail`) flow through `getErrorMessage`, which handles both FastAPI string and Pydantic array shapes, and surface as toast notifications via `onError` on both mutations. The path from `HTTPException(status_code=400, detail="...")` to a visible toast is fully wired.

The migration chain resolves the earlier multi-head problem: `h5i6j7k8l9m0` added the unique constraint, `i1j2k3l4m5n6` drops it (revising the pre-existing head `s7t8u9v0w1x2`), and `t1u2v3w4x5y6` widens the column. The final model has `pic_contact = Column(String(500))` with no unique constraint.

---

<details>
<summary>Issues (2)</summary>

1. **Inactive client contacts block reuse** — `create_client` and `update_client` query all clients with a non-null `pic_contact` and apply no `is_active` filter. A deactivated client's phone numbers permanently block those numbers from being assigned to a new or existing client. If the intended policy is "contacts must be unique across active clients only", add `.filter(Client.is_active == True)` to both queries. [confirmed]

2. **`onSubmit` unhandled rejection** — `onSubmit` calls `await onCreate(...)` / `await onUpdate(...)` via `mutateAsync` with no surrounding try/catch. React Hook Form's `handleSubmit` suppresses async errors from the submit handler, so the UI won't crash, but the reliance is implicit and version-dependent. Adding an empty catch makes the intent explicit and guards against RHF version changes. [confirmed]

</details>

---

<details>
<summary>Details</summary>

### Inactive client contacts block reuse

Both `create_client` and `update_client` query:

```python
db.query(Client).filter(Client.pic_contact != None).all()
```

No `is_active` filter is applied. A contact belonging to a soft-deleted client permanently occupies the uniqueness space. Currently there is no way to recycle a contact from a deactivated client without directly editing the DB. [confirmed]

### `onSubmit` unhandled rejection

`ClientFormModal.onSubmit` calls `mutateAsync` without catching the rejection:

```typescript
const onSubmit = async (data: Record<string, unknown>) => {
  // ...
  if (isCreating) {
    await onCreate(fullData as unknown as ClientCreateForm);
  } else if (client) {
    await onUpdate({ id: client.id, payload: fullData as unknown as ClientUpdateForm });
  }
};
```

RHF's `handleSubmit` wraps the async handler and swallows the rejection, so in practice the `onError` toast fires and the modal stays open. The fix is a single try/catch at the call site:

```typescript
try {
  if (isCreating) await onCreate(...);
  else if (client) await onUpdate(...);
} catch {
  // onError already shows the toast
}
```

[confirmed — RHF suppresses but the reliance is implicit]

</details>

---

<details>
<summary>File map</summary>

- `frontend/src/app/(dashboard)/admin/clients/page.tsx` — multi-PIC UI with per-row contact inputs, within-client duplicate check in `updatePic` and `onSubmit`
- `backend/app/routers/clients.py` — cross-client contact uniqueness check in `create_client` and `update_client`
- `backend/app/db/migrations/versions/h5i6j7k8l9m0_add_unique_constraint_client_pic_contact.py` — added the DB-level unique constraint (now superseded)
- `backend/app/db/migrations/versions/i1j2k3l4m5n6_drop_unique_constraint_client_pic_contact.py` — drops the unique constraint to allow multi-contact storage
- `backend/app/db/migrations/versions/t1u2v3w4x5y6_widen_pic_contact_to_500.py` — widens `pic_contact` from 100 to 500 chars

</details>
