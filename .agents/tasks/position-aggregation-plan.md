# Implementation Plan — Position Aggregation by Client

## Context

- **Backend**: FastAPI + SQLAlchemy, router registered at `/api/v1/positions` in `backend/app/main.py`
- **Frontend**: Next.js App Router, page at `frontend/src/app/(dashboard)/admin/positions/page.tsx`
- **Types**: `frontend/src/types/index.ts` — `Position` and `Client` types already exist
- **API client**: `frontend/src/lib/api.ts` — axios instance with auto-refresh interceptor; call via `api.get(url, { params })`
- **Styling convention**: Tailwind with custom tokens (`bg-surface-container-lowest`, `text-on-surface-variant`, etc.) matching clients/page.tsx and positions/page.tsx exactly
- **Auth pattern**: `useAuthStore` + `isRole("admin", "hr", "manager")` guard at top of component, `useEffect` redirect to `/dashboard` if not authorized
- **Data fetching**: `@tanstack/react-query` `useQuery` hook; mutations via `useMutation`
- **Date formatting**: `format(new Date(x), "dd MMM yyyy", { locale: idLocale })` from `date-fns`

---

## Items

- [ ] 1. **Add `PositionsByClientResponse` Pydantic schema** in `backend/app/schemas/position.py`

  Add a new response schema for the aggregation endpoint at the bottom of the file:

  ```python
  class PositionsByClientResponse(BaseModel):
      client_id: AutoStrUUID
      client_name: str
      total_positions: int
      last_created_at: datetime | None

      class Config:
          from_attributes = True
  ```

  Files: `backend/app/schemas/position.py`
  Verify: `cd backend && python -c "from app.schemas.position import PositionsByClientResponse; print('ok')"` — prints `ok` without errors.

---

- [ ] 2. **Add `GET /api/v1/positions/by-client` endpoint** in `backend/app/routers/positions.py`

  Add the new route **before** any `/{position_id}` route (it currently has none, but insert it at the top of the file immediately after the imports, before the `GET ""` route). Use a SQLAlchemy group-by query:

  ```python
  from sqlalchemy import func as sqlfunc

  @router.get("/by-client", response_model=list[PositionsByClientResponse])
  def list_positions_by_client(
      db: Session = Depends(get_db),
      current_user=Depends(require_role("hr", "manager", "admin")),
  ):
      rows = (
          db.query(
              Client.id.label("client_id"),
              Client.name.label("client_name"),
              sqlfunc.count(Position.id).label("total_positions"),
              sqlfunc.max(Position.created_at).label("last_created_at"),
          )
          .join(Position, Position.client_id == Client.id)
          .group_by(Client.id, Client.name)
          .order_by(Client.name)
          .all()
      )
      return [
          {
              "client_id": row.client_id,
              "client_name": row.client_name,
              "total_positions": row.total_positions,
              "last_created_at": row.last_created_at,
          }
          for row in rows
      ]
  ```

  Also add `PositionsByClientResponse` to the import from `app.schemas.position` at the top of the router file.

  **Important**: Register this route **before** any `/{position_id}` pattern (currently no such route in this file, but keep it first anyway to be safe against future additions).

  Files: `backend/app/routers/positions.py`, `backend/app/schemas/position.py`
  Verify: Start the backend with `uvicorn app.main:app --reload` and call `curl http://localhost:8000/api/v1/positions/by-client` — returns a JSON array (may be empty but must not 404/422).

---

- [ ] 3. **Add `PositionByClient` TypeScript type** in `frontend/src/types/index.ts`

  Append to the `// --- Position ---` section, after the existing `Position` interface:

  ```typescript
  export interface PositionByClient {
    client_id: string;
    client_name: string;
    total_positions: number;
    last_created_at: string | null;
  }
  ```

  Files: `frontend/src/types/index.ts`
  Verify: `cd frontend && npx tsc --noEmit` — no new type errors.

---

- [ ] 4. **Replace `/admin/positions/page.tsx` with the aggregation table**

  Overwrite `frontend/src/app/(dashboard)/admin/positions/page.tsx` entirely. The new page:
  - Auth guard: same `useAuthStore` + `isRole("admin", "hr", "manager")` + `useEffect` redirect pattern
  - Fetches `GET /api/v1/positions/by-client` via `useQuery({ queryKey: ["positions-by-client"], queryFn: ... })`
  - Renders a table with three columns: **KLIEN** | **JUMLAH POSISI** | **TERAKHIR DIBUAT**
  - KLIEN cell: `<Link href={/admin/positions/${row.client_id}}>` styled as `text-primary underline hover:text-primary/80 font-medium`
  - JUMLAH POSISI cell: `{row.total_positions} Posisi`
  - TERAKHIR DIBUAT cell: `row.last_created_at ? format(new Date(row.last_created_at), "dd MMM yyyy", { locale: idLocale }) : "-"`
  - Page title: `Kelola Posisi` (same `text-headline-lg font-bold text-on-surface` heading)
  - Loading/error/empty states matching the existing table skeleton (use `progress_activity` spinner, `search_off` icon for empty)
  - Footer showing `Total: {rows.length} klien`
  - No "Tambah Posisi" button on this page (moved to detail page)
  - No filters needed (no search/dropdown)
  - Imports needed: `"use client"`, `useEffect`, `useState` (not needed but keep for future), `useRouter`, `useQuery` from `@tanstack/react-query`, `Link` from `next/link`, `format` from `date-fns`, `id as idLocale` from `date-fns/locale`, `api` from `@/lib/api`, `PositionByClient` from `@/types`, `useAuthStore`, `useToastStore` (optional)

  Files: `frontend/src/app/(dashboard)/admin/positions/page.tsx`
  Verify: `cd frontend && npx tsc --noEmit` — no errors. Navigate to `/admin/positions` in dev server — table renders with client rows linking to `/admin/positions/[clientId]`.

---

- [ ] 5. **Create the client-scoped positions list at `/admin/positions/[clientId]/page.tsx`**

  Create the new directory and file: `frontend/src/app/(dashboard)/admin/positions/[clientId]/page.tsx`

  This page is the current `page.tsx` content adapted as follows:

  **What to keep from the existing page:**
  - All existing imports (`useQuery`, `useMutation`, `useForm`, `zodResolver`, `z`, `format`, etc.)
  - `positionCreateSchema`, `positionUpdateSchema` zod schemas (unchanged)
  - `PositionFormModal` component (entire function, unchanged)
  - All `useState` hooks for modal/edit state
  - `createMutation`, `updateMutation` mutations (unchanged)
  - The positions table markup (all 8 columns: Judul Posisi, Klien, Tipe Pekerjaan, Durasi, Status, Dibuat, Diubah, Aksi)
  - `handleToggleActive` function (unchanged)

  **What changes:**
  1. Read `clientId` from params: `const params = useParams(); const clientId = params.clientId as string;`
  2. Import `useParams` from `next/navigation`
  3. Import `Link` from `next/link`
  4. Add a `useQuery` to fetch the client name:
     ```typescript
     const { data: clientDetail } = useQuery<Client>({
       queryKey: ["client", clientId],
       queryFn: () => api.get(`/api/v1/clients/${clientId}`).then(r => r.data),
       enabled: authorized && !!clientId,
     });
     ```
     The existing `/api/v1/clients` endpoint returns individual clients by ID — confirm this in the clients router; if not, use the `clients` list query and find by ID.
  5. **Remove** `clientFilter` state and its `<select>` dropdown (Klien filter)
  6. **Remove** old `statusFilter` state's dropdown from the filter bar — but **add** a new compact Status filter in the filter row:
     ```tsx
     <select
       value={statusFilter}
       onChange={(e) => setStatusFilter(e.target.value)}
       className="px-3 py-1.5 bg-surface border border-outline-variant rounded-md text-body-sm ..."
     >
       <option value="">Semua Status</option>
       <option value="active">Aktif</option>
       <option value="inactive">Nonaktif</option>
     </select>
     ```
     (The filter itself is kept, just the Klien dropdown is removed)
  7. Pass `client_id: clientId` as a fixed param to `fetchPositions` — remove the `client_id: clientFilter || undefined` line and replace with `client_id: clientId`
  8. Page title changes to: `Posisi — {clientDetail?.name ?? "..."}` 
  9. Add breadcrumb/back button above the title:
     ```tsx
     <Link href="/admin/positions" className="flex items-center gap-1 text-on-surface-variant hover:text-on-surface text-body-sm mb-2">
       <span className="material-symbols-outlined text-base">arrow_back</span>
       Kembali ke Daftar Klien
     </Link>
     ```
  10. The "Tambah Posisi" button opens the modal — when it calls `onCreate`, the `PositionCreateForm` should have `client_id` pre-set. Pass `defaultClientId={clientId}` prop to `PositionFormModal` and in the modal's `defaultValues` for create mode, set `client_id: defaultClientId ?? ""`. Also disable the Klien `<select>` in create mode (the client is already known).
  11. Remove `fetchClients` query usage only for the filter dropdown; keep it for the modal (the modal still needs the full clients list for its Klien select — although since we're pre-setting it, you can simplify but keeping it is safe and avoids changing the modal)
  12. Footer shows `Total: {totalPositions} posisi`

  Files: `frontend/src/app/(dashboard)/admin/positions/[clientId]/page.tsx` (new file)
  Verify: `cd frontend && npx tsc --noEmit` — no errors. Navigate to `/admin/positions/[some-client-id]` — page renders with only that client's positions, correct title, back button works.

---

- [ ] 6. **Verify client detail endpoint exists** (investigation step — do before step 5 if unsure)

  Check `backend/app/routers/clients.py` for a `GET /{client_id}` route. If it exists, use `api.get(/api/v1/clients/${clientId})` in step 5. If it does not exist, fall back to using the `clients` list query: `useQuery(["clients"], fetchClients)` and find by ID with `.find(c => c.id === clientId)`.

  Files: `backend/app/routers/clients.py` (read only)
  Verify: Confirm the approach before writing step 5 component.

---

## Summary of all files modified/created

| File | Action |
|---|---|
| `backend/app/schemas/position.py` | Add `PositionsByClientResponse` schema |
| `backend/app/routers/positions.py` | Add `GET /by-client` route (before `/{id}` routes) |
| `frontend/src/types/index.ts` | Add `PositionByClient` interface |
| `frontend/src/app/(dashboard)/admin/positions/page.tsx` | Replace with aggregation table |
| `frontend/src/app/(dashboard)/admin/positions/[clientId]/page.tsx` | Create — adapted from old positions page |

## Dependency order

Items must be done in order: 1 → 2 (depends on 1) → 3 → 4 (depends on 3) → 6 (read-only check) → 5 (depends on 3 and findings from 6).

## Key decisions

- **Route safety**: `GET /by-client` is added as the first route in the router file to prevent FastAPI from matching it against a future `/{position_id}` pattern. This is idiomatic FastAPI.
- **No new backend route for client detail**: Use the existing `/api/v1/clients/{id}` or list fallback rather than adding more backend work.
- **Modal reuse**: `PositionFormModal` is copied verbatim into the new `[clientId]` page file. It is not extracted into a shared component — that refactor is out of scope and would risk breaking the existing behavior.
- **Status filter kept, Klien filter removed**: The `[clientId]` page keeps the Status dropdown (Aktif/Nonaktif) and removes only the Klien dropdown, exactly as specified.
- **`sqlfunc` alias**: The aggregation query imports `func as sqlfunc` to avoid shadowing the module-level `func` from SQLAlchemy already imported in the models. In the router file, use `from sqlalchemy import func` directly (not aliased) since the router doesn't import it yet.
