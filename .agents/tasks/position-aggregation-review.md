# Position Aggregation by Client

Adds a two-level navigation for `/admin/positions`: the top-level page now shows a per-client aggregation table (client name, position count, most recent creation date), and clicking a client name navigates to a scoped per-client positions list. The existing flat positions list becomes the second level, filtered by `clientId` from the URL. Backend gains a single new `GET /by-client` endpoint using a grouped SQLAlchemy query.

Watch for: **confirmed** — the `/by-client` endpoint uses an INNER JOIN, so clients with zero positions never appear in the aggregation table. **confirmed** — the per-client page's `Klien` column is redundant when the page is already scoped to one client.

**Verdict**: APPROVED

---

## High-level view

The `/by-client` endpoint groups `Position` rows by `Client` via an INNER JOIN, which means clients that exist but have no positions yet are silently omitted from the aggregation table. Whether that's intentional is worth confirming — a newly-onboarded client won't appear until its first position is created.

The per-client page resolves the client display name through a three-tier fallback (loaded positions → `positions-by-client` cache → dedicated `GET /api/v1/clients/{clientId}` call), so direct URL navigation always resolves the heading correctly even when the aggregation cache is cold.

The per-client positions table still includes a `Klien` column even though every row on the page belongs to the same client. The heading already shows the client name, so the column is redundant and adds horizontal clutter.

---

<details>
<summary>Issues (2)</summary>

1. **INNER JOIN excludes zero-position clients** — `GET /by-client` uses `.join(Position, ...)` (INNER JOIN). Clients with no positions are invisible on the aggregation page. If unintentional, change to `.outerjoin(Position, ...)` — `func.count(Position.id)` already returns 0 correctly for NULLs. **confirmed**

2. **Redundant Klien column in per-client table** — `[clientId]/page.tsx` has a `Klien` column that shows `position.client_name`, but the page is scoped to one client and the heading already identifies it. Remove the column to reduce clutter. **confirmed**

</details>

<details>
<summary>Details</summary>

### INNER JOIN excludes zero-position clients

The aggregation query in `positions.py`:

```python
db.query(...)
    .join(Position, Position.client_id == Client.id)
    .group_by(Client.id, Client.name)
```

SQLAlchemy's `.join()` produces an INNER JOIN. Any `Client` row with no corresponding `Position` rows is excluded from the result. If a client is onboarded before any positions are created, they'll be invisible on the aggregation page until the first position is added. An `.outerjoin()` with the same `func.count(Position.id)` aggregation would surface those clients with "0 Posisi".

### Redundant Klien column in per-client table

The positions table on `[clientId]/page.tsx` has eight columns, the second of which is `Klien`:

```tsx
<th ...>Klien</th>
...
<td ...>{position.client_name}</td>
```

Since the page is scoped to a single client (established by both the URL param and the page heading `Posisi — {clientName}`), this column repeats information already visible in the heading. Removing it would reduce the column count to 7 and make better use of the table's horizontal space.

</details>

---

<details>
<summary>Files changed</summary>

- `backend/app/schemas/position.py` — Added `PositionsByClientResponse` Pydantic schema
- `backend/app/routers/positions.py` — Added `GET /by-client` aggregation endpoint, placed first before parameterized routes
- `frontend/src/types/index.ts` — Added `PositionByClient` TypeScript interface
- `frontend/src/app/(dashboard)/admin/positions/page.tsx` — Replaced with client aggregation table (3-column: Klien, Jumlah Posisi, Terakhir Dibuat)
- `frontend/src/app/(dashboard)/admin/positions/[clientId]/page.tsx` — New per-client positions page with Status filter, back link, and pre-selected client in modal

Full diff: `git diff main -- backend/app/schemas/position.py backend/app/routers/positions.py frontend/src/types/index.ts "frontend/src/app/(dashboard)/admin/positions/page.tsx" "frontend/src/app/(dashboard)/admin/positions/[clientId]/page.tsx"`

</details>
