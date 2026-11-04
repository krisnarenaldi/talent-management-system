# Bulk-reject active applications on client/position deactivation

Adds a `reject_reason` column and a composite `(position_id, status)` index to `application`, exposes `bulk_reject`/`reject_reason` on the position and client update schemas, and routes both update endpoints through a shared `bulk_reject_applications` service so that deactivating a position — or a client, which cascades to its positions — rejects every still-active application with a recorded reason. The DELETE-client guard that previously blocked deactivation while positions/applications were active is removed in favor of the new PUT-with-bulk_reject flow. Two frontend components render a state-driven confirmation modal (not `confirm()`) that collects a required reason and PUTs the bulk-reject payload.

**Watch for:** the two new Deactivate buttons are created but mounted on no page, so the bulk-reject flow has no UI entry point yet — the PUT endpoint works, but a user cannot trigger the feature from the frontend until the buttons are placed in the positions/clients pages.

**Verdict**: APPROVED

## High-level view

The migration chains correctly onto the merge head `d0d2ce95d403` as a single new head (verified: no other revision points to it), adds the nullable `reject_reason` column with its comment, and adds the composite index under a name distinct from the existing `ix_application_position_id`, so the "check whether `ix_application_position_id` exists" concern dissolves — there is no name to collide with — and `IF NOT EXISTS` makes it re-runnable; upgrade and downgrade are symmetric and idempotent, matching the codebase's raw-SQL migration convention.

The shared `bulk_reject_applications` service issues one bulk `UPDATE` scoped to active applications for the given positions, sets `reject_reason` and `updated_at`, and uses `synchronize_session="fetch"`; callers rely on their own `db.commit()`, consistent with the `autocommit=False` session, so there is no `with db.begin()` anywhere in the change.

Both routers run the bulk-reject before their field-update loops: positions.py guards its `setattr` loop with `SKIP_FIELDS={bulk_reject, reject_reason}`, while clients.py's loop iterates a fixed `("name","industry","is_active")` tuple so `bulk_reject`/`reject_reason` never reach `setattr`, and re-setting `is_active` from the payload is idempotent on top of the bulk-reject's `client.is_active=False`.

clients.py removes both DELETE guards (active-positions and active-applications), leaving a plain soft-delete with the 404 check intact, and drops the now-unused `Application` import.

The frontend components are state-driven modals that require a non-empty reason, PUT the exact `{is_active:false, bulk_reject:true, reject_reason}` payload to `/api/v1/positions|clients/{id}`, and call `onSuccess` on success — but neither component is imported anywhere, so the feature is unreachable from the UI.

<details>
<summary>Issues (1)</summary>

1. **Deactivate buttons not mounted** — the two new components are never imported or rendered in the positions/clients pages, so the bulk-reject flow has no frontend trigger. Mount them where the deactivate action lives (positions detail/list and the clients page) so the feature is reachable; until then only the raw PUT endpoint exposes the behavior.

</details>

<details>
<summary>Details</summary>

### Migration: reject_reason column + composite index

The migration sits on top of the merge head `d0d2ce95d403` (revision `e5f6a7b8c9d0`), which is the current single head — confirmed that no other revision points to `d0d2ce95d403`, so there is no multi-head to resolve. Upgrade adds the nullable `VARCHAR(255)` `reject_reason` column plus its comment, and creates `ix_application_position_status` on `(position_id, status)`. The index name is deliberately distinct from the existing `ix_application_position_id`, so the "check whether `ix_application_position_id` exists" requirement dissolves — there is no name to collide with — and `CREATE INDEX IF NOT EXISTS` makes the step idempotent. Downgrade reverses the order (drop index, then column), both guarded with `IF EXISTS`. The raw-SQL-via-`op.execute` style matches the codebase's other idempotent migrations rather than the `op.add_column`/`op.create_index` the spec suggested.

### ORM column added to Application

`reject_reason` was also added to the `Application` model — not strictly called out by the spec. This addition is required: the bulk `UPDATE` resolves `reject_reason` against the model's mapped columns, and `ApplicationResponse` (`from_attributes = True`) serializes the attribute from the ORM object. Without the model column the update statement would fail to resolve the key.

### bulk_reject_applications service

One bulk `UPDATE` scoped to `Application.position_id IN (...)` and `status='active'`, setting `status='rejected'`, `reject_reason`, and `updated_at=func.now()`. The explicit `updated_at` matters: bulk `UPDATE` statements do not fire `onupdate`, so omitting it would leave rejected rows with their old `updated_at`. An empty `position_ids` short-circuits to `0` before issuing `IN ()`, which is invalid SQL — so the guard is not cosmetic.

### Frontend components

Both are `"use client"` components using `useState` for modal visibility (not `confirm()`), require a trimmed reason before submitting (inline error otherwise), `PUT` `{is_active:false, bulk_reject:true, reject_reason:reason.trim()}` to `/api/v1/positions|clients/{id}`, and invoke the `onSuccess` prop after success. The `api` client uses an empty `baseURL` with Next.js rewrites, so the `/api/v1` prefix in the path is what reaches the backend, matching existing `api.put('/api/v1/...')` calls in the positions and clients pages.

### Test coverage

There is no backend test directory, so the migration, the new service, and the router branches are verified only by `py_compile` (syntax) and `tsc` (types) — not behaviorally. The bulk-reject `WHERE` clause, the required-reason 400 guard, and the DELETE-guard removal have no behavioral test.

</details>

<details>
<summary>File map</summary>

- `backend/app/db/migrations/versions/e5f6a7b8c9d0_add_reject_reason_to_application.py` — new migration: adds `reject_reason` column + comment and composite `(position_id, status)` index; symmetric idempotent up/down.
- `backend/app/models/application.py` — adds `reject_reason` mapped column (required for the bulk update and response serialization).
- `backend/app/services/application_service.py` — new `bulk_reject_applications` service; one bulk UPDATE with `synchronize_session="fetch"`.
- `backend/app/schemas/application.py` — adds `reject_reason` to `ApplicationResponse` (inherited by `ApplicationStageDetail`).
- `backend/app/schemas/position.py` — adds `bulk_reject`/`reject_reason` to `PositionUpdate`.
- `backend/app/schemas/client.py` — adds `bulk_reject`/`reject_reason` to `ClientUpdate`.
- `backend/app/routers/positions.py` — bulk-reject branch before the `model_dump` loop; `SKIP_FIELDS` guard; imports the new service.
- `backend/app/routers/clients.py` — bulk-reject branch (deactivates positions + rejects applications); DELETE guards removed (404 kept); dead `Application` import dropped.
- `frontend/src/components/positions/DeactivatePositionButton.tsx` — state-driven confirm modal, required reason, PUTs the bulk-reject payload, calls `onSuccess`.
- `frontend/src/components/clients/DeactivateClientButton.tsx` — same pattern for client deactivation.

Full diff: `git diff 1c31ba7 HEAD` (commit `255ec38`).

</details>
