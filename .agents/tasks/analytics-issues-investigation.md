# Analytics Page Issues — Investigation Report

**Date:** 2025-07-17  
**Scope:** `/analytics` page — three user-reported issues

---

## Summary (TL;DR)

| # | Issue | Root Cause | Status |
|---|-------|-----------|--------|
| 1 | Line chart shows Y-axis "7 & 8" as a single dot | Only 1 data point in the last 6 months; single-point rendering + Y-axis scale math | **Frontend logic bug (minor) + data thinness** |
| 2 | "Distribusi Pipeline per Tahapan" — empty | `pipeline-breakdown` endpoint crashes at runtime (SQLAlchemy expression bug) | **Backend bug — endpoint likely returning 500** |
| 3 | "Rasio Kelolosan Interview User per Posisi / Client" — empty | Raw SQL references `p.client_name` which is a Python `@property`, not a DB column — query fails at runtime | **Backend bug — endpoint likely returning 500** |

---

## Issue 1 — "Tren Kandidat Masuk per Bulan": Y-axis shows 7 & 8, only a dot

### Root Cause

The `LineChart` component (`frontend/src/app/(dashboard)/analytics/page.tsx`, `LineChart` function) calculates Y-axis labels and point positions from `minCount` and `maxCount`. When the `pipeline-trend` API (`GET /api/v1/analytics/pipeline-trend?months=6`) returns **only one data point**, the SVG rendering has two separate problems.

#### Problem A — Only one dot, no line

**File:** `frontend/src/app/(dashboard)/analytics/page.tsx` — `LineChart` component, `points` calculation.

```ts
const points = data.map((d, i) => {
  const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
  const y = ...
  return { x, y, period: d.period, count: d.count };
});
const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
```

With `data.length === 1`, every `i / (data.length - 1 || 1)` equals `0 / 1 = 0`, so the single point is placed at `x = padding` (the left edge). The `linePath` is just `"M 40 <y>"` — a move with no `L` segment, so the SVG `<path>` renders as a **single point/dot** with no visible line.

#### Problem B — Y-axis shows 7 and 8

**File:** same component, Y-axis grid rendering.

```ts
const maxCount = Math.max(...data.map(d => d.count), 1);
const minCount = Math.min(...data.map(d => d.count));
const countRange = maxCount - minCount || 1;
```

With a single data point of `count = 7`:
- `maxCount = 7`
- `minCount = 7`
- `countRange = 0 → fallback to 1`

The Y-axis renders 5 grid lines at ratios `[0, 0.25, 0.5, 0.75, 1]`:
```ts
const value = Math.round(minCount + countRange * ratio);
// → Math.round(7 + 1 * 0)   = 7
// → Math.round(7 + 1 * 0.25) = 7
// → Math.round(7 + 1 * 0.5)  = 8 (rounds up)
// → Math.round(7 + 1 * 0.75) = 8
// → Math.round(7 + 1 * 1)    = 8
```

So the Y-axis shows **7, 7, 8, 8, 8** — which the user sees as "angka 7 & 8" repeated as seemingly nonsensical labels.

#### What the values 7 and 8 represent

These are the **count of candidate applications in one month**. The backend query (`analytics_pipeline_trend`) counts `Application` rows grouped by `to_char(created_at, 'YYYY-MM')`, filtered to the last 6 months. The database currently has applications only in **one month** (likely Oktober 2024 with `count = 7`). Because `countRange` collapses to `1` when min == max, the scale incorrectly expands the range by 1, giving `7–8` on the axis.

### Recommended Fix

Two separate fixes:

1. **Y-axis scale**: When `maxCount == minCount`, set the axis range to `[0, maxCount]` instead of `[minCount, minCount+1]`. This gives a sensible scale (0 to 7) even for a single value.
   ```ts
   const minCount = data.length === 1 ? 0 : Math.min(...data.map(d => d.count));
   ```

2. **Single-point dot vs line**: The dot renders correctly for a single point, but the missing line is expected. No code fix needed — but the Y-axis fix above eliminates the confusing labels.

---

## Issue 2 — "Distribusi Pipeline per Tahapan": always empty

### Root Cause

**File:** `backend/app/routers/analytics.py`, `analytics_pipeline_breakdown()`, line ~151.

```python
select(
    Application.current_stage.label("stage"),
    Position.id.label("position_id"),
    Position.title.label("position_title"),
    Position.client.name.label("client_name"),   # ← BUG
    func.to_char(Application.created_at, 'YYYY-MM').label("period"),
    func.count(Application.id).label("count"),
)
```

`Position.client.name` is attempting to traverse the SQLAlchemy **relationship** attribute `Position.client` (a `relationship("Client", ...)`) and then access `.name` on it in a column expression context. **This is invalid in SQLAlchemy 2's `select()` column list.** SQLAlchemy cannot generate valid SQL from `RelationshipProperty.name` used as a column expression.

This causes one of two failure modes at runtime:
- **AttributeError / Invalid column expression** — FastAPI catches it as a 500 Internal Server Error, and the frontend receives no data (the `useQuery` hook silently returns `undefined`, and `pipelineData?.length === 0` triggers the "Belum ada data pipeline." message).
- Or if the server is on SQLAlchemy 1.x compatibility mode, it may generate incorrect SQL that also returns 0 rows.

The same issue applies to the `GROUP BY` clause:
```python
query = query.group_by(
    Application.current_stage,
    Position.id,
    Position.title,
    Position.client.name,   # ← same invalid expression
    func.to_char(Application.created_at, 'YYYY-MM'),
)
```

### Recommended Fix

Replace `Position.client.name.label("client_name")` with a proper join on `Client` and reference `Client.name`:

```python
from app.models.client import Client  # already imported at top of file as unused

query = (
    select(
        Application.current_stage.label("stage"),
        Position.id.label("position_id"),
        Position.title.label("position_title"),
        Client.name.label("client_name"),          # ← fix: join Client and use Client.name
        func.to_char(Application.created_at, 'YYYY-MM').label("period"),
        func.count(Application.id).label("count"),
    )
    .join(Position, Application.position_id == Position.id)
    .outerjoin(Client, Position.client_id == Client.id)   # ← add this join
    .outerjoin(Candidate, Application.candidate_id == Candidate.id)
)
```

And in the `GROUP BY`:
```python
query = query.group_by(
    Application.current_stage,
    Position.id,
    Position.title,
    Client.name,    # ← fix
    func.to_char(Application.created_at, 'YYYY-MM'),
)
```

---

## Issue 3 — "Rasio Kelolosan Interview User per Posisi / Client": always empty

### Root Cause

**File:** `backend/app/routers/analytics.py`, `analytics_success_rate_by_position()`, raw SQL text (~line 208).

```sql
SELECT 
    p.id AS position_id,
    p.title AS position_title,
    p.client_name AS client_name,    -- ← BUG: no such column in the position table
    ...
FROM application a
JOIN position p ON a.position_id = p.id
LEFT JOIN ranked_interviews ri ON a.id = ri.application_id AND ri.rn = 1
GROUP BY p.id, p.title, p.client_name  -- ← same bug
```

**`position` table has no `client_name` column.** The `Position` model (`backend/app/models/position.py`) defines `client_name` only as a Python `@property`:

```python
@property
def client_name(self) -> str | None:
    return self.client.name if self.client else None
```

The actual DB column is `client_id` (a UUID FK to the `client` table). The raw SQL query references `p.client_name` which does not exist in PostgreSQL, causing a `column "client_name" does not exist` SQL error. FastAPI returns 500, `useQuery` gets no data, and the frontend shows "Belum ada data posisi."

### Recommended Fix

Add a JOIN to the `client` table and use `c.name`:

```sql
WITH ranked_interviews AS (
    SELECT 
        application_id,
        result,
        ROW_NUMBER() OVER (PARTITION BY application_id ORDER BY created_at DESC) as rn
    FROM stage_history
    WHERE stage_name = 'Interview_User'
)
SELECT 
    p.id AS position_id,
    p.title AS position_title,
    c.name AS client_name,                  -- ← fix: join client table
    COUNT(ri.application_id) AS total_applications,
    SUM(CASE WHEN ri.result IN ('Lanjut', 'Lolos', 'Ok') THEN 1 ELSE 0 END) AS passed_user_interview
FROM application a
JOIN position p ON a.position_id = p.id
LEFT JOIN client c ON p.client_id = c.id    -- ← add this join
LEFT JOIN ranked_interviews ri ON a.id = ri.application_id AND ri.rn = 1
GROUP BY p.id, p.title, c.name              -- ← fix GROUP BY
```

---

## Evidence Summary

| File | Line(s) | Finding |
|------|---------|---------|
| `frontend/src/app/(dashboard)/analytics/page.tsx` | `LineChart`, `minCount`/`countRange` calculation | Y-axis math collapses to range of 1 when only 1 data point, producing "7 & 8" |
| `frontend/src/app/(dashboard)/analytics/page.tsx` | `LineChart`, `points` x-position calculation | Single data point → `i / (length-1)` = 0, all points at x=padding, no line drawn |
| `backend/app/routers/analytics.py` | ~line 151 (`pipeline-breakdown`) | `Position.client.name.label(...)` is invalid as a SQLAlchemy column expression — causes 500 |
| `backend/app/routers/analytics.py` | ~line 208 (`success-rate-by-position`) | `p.client_name` in raw SQL refers to a non-existent DB column — causes SQL error + 500 |
| `backend/app/models/position.py` | `client_name` property | Confirms `client_name` is a Python-only `@property`, not a DB column |

---

## Conclusions

- Issues 2 and 3 are **backend runtime errors** that silently return 500 to the frontend. The frontend empty-state check (`!pipelineData || pipelineData.length === 0`) correctly shows "Belum ada data" but the real cause is a 500 response, not genuinely empty data.
- Issue 1 is a **frontend chart rendering edge case** when only 1 month of data exists; the Y-axis labels are technically correct math but confusing because the scale is artificially compressed.
- All three issues are straightforward fixes. Issues 2 and 3 are the highest priority because they result in silent data loss for the user.
