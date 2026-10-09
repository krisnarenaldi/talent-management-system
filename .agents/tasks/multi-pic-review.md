# Multi-PIC support for client management

`pic_name` and `pic_contact` on the `client` table now store multiple values as semicolon-delimited strings. The modal grows dynamic rows (add/remove PIC), `onSubmit` joins them on `";"`, the table splits on `";"` for display, and a migration drops the `uq_client_pic_contact` unique constraint that would otherwise block duplicates. The backend router loses the unique-contact check it previously enforced at the application layer.

Watch for: **picErrors initialization mismatch** — on edit, `picErrors` always starts as `[{}]` (one entry) regardless of how many rows `pics` is initialized with, so per-row validation is broken until the user interacts with a row (confirmed). The `down_revision` in the new migration points to `s7t8u9v0w1x2` rather than `h5i6j7k8l9m0` (the migration that *added* the constraint), leaving the chain semantically disconnected from its logical predecessor (confirmed).

**Verdict**: NEEDS_CHANGES

---

## High-level view

The semicolon split/join logic and backward-compat behavior are correct: `split(";").filter(Boolean)` on a legacy single-value string produces a one-element array, and `Math.max(names.length, contacts.length, 1)` ensures the modal always opens with at least one row. Old data renders as a single row in both the table and the edit modal without any data migration.

The `picErrors` state is initialized as `[{}]` unconditionally, including when editing a client that has three existing PICs. Until the user touches a contact field in rows 2 and 3, `picErrors[1]` and `picErrors[2]` are `undefined`, making `picErrors[index]?.contact` always falsy for those rows and the guard `picErrors.some(e => e.contact)` unable to block invalid entries in rows that were never touched.

The migration's `down_revision` is `s7t8u9v0w1x2` (make_blacklist_candidate_id_nullable), not `h5i6j7k8l9m0` (add_unique_constraint_client_pic_contact). This means the migration chain for the unique constraint is not contiguous: `add` → several unrelated migrations → `drop`. Alembic will run the drop without error because it's a valid linear tip, but a `downgrade` from `i1j2k3l4m5n6` lands at `s7t8u9v0w1x2` rather than at the state just before the constraint was added — the rollback semantics are wrong.

---

<details>
<summary>Issues (2)</summary>

1. **picErrors initialization mismatch on edit** — `picErrors` is always initialized as `[{}]`, but `pics` may have 2+ rows when editing an existing client. Rows beyond the first have no corresponding `picErrors` entry until touched, so phone validation silently fails to fire for those rows. Initialize `picErrors` with `Array.from({ length: pics.length }, () => ({}))` using the same computed length as `pics`.

2. **Migration down_revision skips the add-constraint migration** — `i1j2k3l4m5n6` sets `down_revision = 's7t8u9v0w1x2'` instead of `'h5i6j7k8l9m0'`. A `downgrade` from the new migration will not re-land at the state where the constraint existed; it will land at the blacklist migration. Change `down_revision` to `'h5i6j7k8l9m0'` so the rollback path is semantically correct.

</details>

---

<details>
<summary>Details</summary>

### picErrors initialization mismatch on edit

When `ClientFormModal` mounts for an existing client, `pics` is computed as:

```typescript
const maxLen = Math.max(names.length, contacts.length, 1);
return Array.from({ length: maxLen }, (_, i) => ({ name: names[i] || "", contact: contacts[i] || "" }));
```

A client with `pic_contact = "08111;08222;08333"` gets `pics` of length 3. But `picErrors` is initialized as:

```typescript
const [picErrors, setPicErrors] = useState<{ contact?: string }[]>([{}]);
```

Always length 1. The contact input in rows 1 and 2 reads `picErrors[index]?.contact` — `undefined` from a missing array slot, not `""` or an empty object. The validation guard before submit:

```typescript
if (picErrors.some((e) => e.contact)) return;
```

iterates over the single-element array. An invalid phone number typed into row 2 will never set `picErrors[1]` because `updatePic` writes `prev.map((e, i) => i === index ? ... : e)` — when `prev` has only one element and `index` is 1, the map changes nothing and `picErrors` stays length 1. The fix is to initialize `picErrors` with the same length as `pics`.

### Migration down_revision skips the add-constraint migration

The new migration file:

```python
revision = 'i1j2k3l4m5n6'
down_revision = 's7t8u9v0w1x2'   # make_blacklist_candidate_id_nullable
```

The migration that added the constraint:

```python
revision = 'h5i6j7k8l9m0'
down_revision = 'g4h5i6j7k8l9'
```

The two migrations are not adjacent in the chain. Alembic resolves `i1j2k3l4m5n6` as the current head and will apply the upgrade without error. But `alembic downgrade -1` from `i1j2k3l4m5n6` steps back to `s7t8u9v0w1x2`, completely bypassing `h5i6j7k8l9m0`. The unique constraint will not be restored on rollback. Correcting `down_revision` to `h5i6j7k8l9m0` makes the add/drop pair a logical unit and restores correct rollback semantics.

</details>

---

<details>
<summary>File map</summary>

- `frontend/src/app/(dashboard)/admin/clients/page.tsx` — dynamic PIC row UI; semicolon join/split in `onSubmit` and table cells; `picErrors` per-row validation state
- `backend/app/routers/clients.py` — unique contact validation removed from both `create_client` and `update_client`
- `backend/app/db/migrations/versions/i1j2k3l4m5n6_drop_unique_constraint_client_pic_contact.py` — drops `uq_client_pic_contact` unique constraint

Full diff: `git diff` against base branch.

</details>
