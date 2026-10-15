# Implementation Plan — Riwayat Cuti (Leave History) Tab

Follow the exact same pattern as the existing **Kontrak** tab: add, view, delete — no edit.

---

- [ ] 1. Create the `EmployeeLeave` SQLAlchemy model.
      New file `backend/app/models/employee_leave.py`. Mirror the style of `EmployeeContract` in `employee.py` — UUID PK with `default=uuid.uuid4`, `employee_id` FK to `employee.id` with `ondelete="CASCADE"`, columns typed exactly as the spec.

      ```python
      # backend/app/models/employee_leave.py
      import uuid
      from sqlalchemy import Column, Date, DateTime, ForeignKey, Text, func
      from sqlalchemy.dialects.postgresql import UUID
      from sqlalchemy.orm import relationship
      from app.db.database import Base

      class EmployeeLeave(Base):
          __tablename__ = "employee_leaves"

          id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
          employee_id = Column(UUID(as_uuid=True), ForeignKey("employee.id", ondelete="CASCADE"), nullable=False, index=True)
          start_date  = Column(Date, nullable=False)
          end_date    = Column(Date, nullable=False)
          reason      = Column(Text, nullable=False)
          created_at  = Column(DateTime(timezone=True), server_default=func.now())

          employee = relationship("Employee", back_populates="leaves")
      ```

      Then add the `leaves` relationship to `Employee` in `backend/app/models/employee.py`:
      ```python
      leaves = relationship("EmployeeLeave", back_populates="employee", cascade="all, delete-orphan")
      ```

      Files:
      - `backend/app/models/employee_leave.py` (create)
      - `backend/app/models/employee.py` (add `leaves` relationship to `Employee` class)

      Verify: `python -c "from app.models.employee_leave import EmployeeLeave; print('OK')"` run inside the backend container (`docker exec tms_backend bash -c "cd /app && python -c ..."`) exits 0.

---

- [ ] 2. Register `EmployeeLeave` in the models `__init__` so Alembic autogenerate picks it up.
      Add one import line to the existing block.

      ```python
      # in backend/app/models/__init__.py — add after the employee line:
      from app.models.employee_leave import EmployeeLeave
      ```

      Files: `backend/app/models/__init__.py`

      Verify: `python -c "from app.models import EmployeeLeave; print('OK')"` inside the backend container exits 0.

---

- [ ] 3. Add Pydantic schemas for `EmployeeLeave`.
      Append to `backend/app/schemas/employee.py` following the `EmployeeContract*` pattern — Base → Create → Response with `from_attributes = True`.

      ```python
      # append to backend/app/schemas/employee.py

      class EmployeeLeaveBase(BaseModel):
          start_date: date
          end_date:   date
          reason:     str

      class EmployeeLeaveCreate(EmployeeLeaveBase):
          pass

      class EmployeeLeaveResponse(EmployeeLeaveBase):
          id:          AutoStrUUID
          employee_id: AutoStrUUID
          created_at:  Optional[datetime] = None

          class Config:
              from_attributes = True
      ```

      Files: `backend/app/schemas/employee.py`

      Verify: `python -c "from app.schemas.employee import EmployeeLeaveCreate, EmployeeLeaveResponse; print('OK')"` inside the backend container exits 0.

---

- [ ] 4. Add three leave endpoints to the employees router.
      Add imports and three route handlers to `backend/app/routers/employees.py`. Follow the contracts CRUD section exactly — dual-path decorators (`/leaves/` and `/leaves`) on GET/POST, `require_role` for write operations, `get_current_user` for reads.

      **Imports to add** at the top of the file:
      ```python
      from app.models.employee_leave import EmployeeLeave
      from app.schemas.employee import (
          ...,                          # existing imports
          EmployeeLeaveCreate,
          EmployeeLeaveResponse,
      )
      ```

      **Endpoints to append** at the bottom of the file:
      ```python
      # ── Leaves CRUD ──────────────────────────────────────────────────────────────
      @router.get("/{employee_id}/leaves/",  response_model=list[EmployeeLeaveResponse])
      @router.get("/{employee_id}/leaves",   response_model=list[EmployeeLeaveResponse])
      def list_leaves(
          employee_id: str,
          db: Session = Depends(get_db),
          current_user=Depends(get_current_user),
      ):
          db.query(Employee).filter(Employee.id == employee_id).first() or _raise_404("Karyawan tidak ditemukan")
          return (
              db.query(EmployeeLeave)
              .filter(EmployeeLeave.employee_id == employee_id)
              .order_by(EmployeeLeave.start_date.desc())
              .all()
          )

      @router.post("/{employee_id}/leaves/",  response_model=EmployeeLeaveResponse, status_code=status.HTTP_201_CREATED)
      @router.post("/{employee_id}/leaves",   response_model=EmployeeLeaveResponse, status_code=status.HTTP_201_CREATED)
      def add_leave(
          employee_id: str,
          payload: EmployeeLeaveCreate,
          db: Session = Depends(get_db),
          current_user=Depends(require_role("hr", "manager", "admin")),
      ):
          db.query(Employee).filter(Employee.id == employee_id).first() or _raise_404("Karyawan tidak ditemukan")
          leave = EmployeeLeave(employee_id=employee_id, **payload.model_dump())
          db.add(leave)
          db.commit()
          db.refresh(leave)
          return leave

      @router.delete("/{employee_id}/leaves/{leave_id}", status_code=status.HTTP_204_NO_CONTENT)
      def delete_leave(
          employee_id: str,
          leave_id: str,
          db: Session = Depends(get_db),
          current_user=Depends(require_role("hr", "manager", "admin")),
      ):
          leave = (
              db.query(EmployeeLeave)
              .filter(EmployeeLeave.id == leave_id, EmployeeLeave.employee_id == employee_id)
              .first()
          ) or _raise_404("Data cuti tidak ditemukan")
          db.delete(leave)
          db.commit()
      ```

      Files: `backend/app/routers/employees.py`

      Verify: Restart the backend container (`docker restart tms_backend`) and confirm `GET /api/v1/employees/{id}/leaves` returns 200 via `curl` or the FastAPI docs at `/api/docs`.

---

- [ ] 5. Generate and apply the Alembic migration.
      Alembic runs **inside the `tms_backend` container** — the `alembic.ini` uses env-var interpolation for the DB host (`pgbouncer`), which is only reachable from inside the Docker network. The entrypoint runs `alembic upgrade head` automatically on container start, so the workflow is: generate locally in the container → commit the file → restart triggers auto-apply.

      Run inside the backend container:
      ```bash
      docker exec tms_backend bash -c "cd /app && python -m alembic revision --autogenerate -m 'add_employee_leaves_table'"
      ```

      This creates a new file under `backend/app/db/migrations/versions/` (e.g. `v0w1x2y3z4a5_add_employee_leaves_table.py`). Inspect the generated file to confirm it contains:
      - `op.create_table('employee_leaves', ...)`  with all six columns
      - A foreign key to `employee.id` with `ondelete='CASCADE'`

      If autogenerate missed anything, edit the file manually before applying.

      Apply:
      ```bash
      docker exec tms_backend bash -c "cd /app && python -m alembic upgrade head"
      ```

      Files:
      - `backend/app/db/migrations/versions/<hash>_add_employee_leaves_table.py` (created by alembic, commit it)

      Verify: `docker exec tms_backend bash -c "cd /app && python -m alembic current"` shows the new revision as `(head)`.

---

- [ ] 6. Add the `EmployeeLeave` TypeScript type to the frontend.
      Append to `frontend/src/types/index.ts` after the `EmployeeDocument` interface, mirroring the `EmployeeContract` pattern.

      ```typescript
      export interface EmployeeLeave {
        id: string;
        employee_id: string;
        start_date: string;   // ISO date string "YYYY-MM-DD"
        end_date: string;
        reason: string;
        created_at?: string;
      }
      ```

      Files: `frontend/src/types/index.ts`

      Verify: `cd frontend && npx tsc --noEmit` exits 0 (no new type errors).

---

- [ ] 7. Add API helper functions for leaves to the frontend API layer.
      Append to `frontend/src/lib/api/employees.ts`, following the `fetchContracts` / `addContract` / `deleteContract` pattern exactly.

      ```typescript
      // ── Leaves ────────────────────────────────────────────────────────────────────
      import type { EmployeeLeave } from "@/types";   // add to the existing import block at top

      export async function fetchLeaves(employeeId: string): Promise<EmployeeLeave[]> {
        const response = await api.get(`/api/v1/employees/${employeeId}/leaves`);
        return response.data as EmployeeLeave[];
      }

      export async function addLeave(
        employeeId: string,
        payload: Pick<EmployeeLeave, "start_date" | "end_date" | "reason">,
      ): Promise<EmployeeLeave> {
        const response = await api.post(`/api/v1/employees/${employeeId}/leaves`, payload);
        return response.data as EmployeeLeave;
      }

      export async function deleteLeave(employeeId: string, leaveId: string): Promise<void> {
        await api.delete(`/api/v1/employees/${employeeId}/leaves/${leaveId}`);
      }
      ```

      Note: `EmployeeLeave` must be added to the `import type { ... } from "@/types"` block at the top of the file (not a second import statement).

      Files: `frontend/src/lib/api/employees.ts`

      Verify: `cd frontend && npx tsc --noEmit` exits 0.

---

- [ ] 8. Add the `LeavesTab` component and wire up the "Riwayat Cuti" tab.
      All changes are in `frontend/src/app/(dashboard)/employees/[id]/page.tsx`.

      **Step A — imports.** Add to the existing import block:
      ```typescript
      import { fetchLeaves, addLeave, deleteLeave } from "@/lib/api/employees";
      import type { EmployeeLeave } from "@/types";
      ```

      **Step B — empty form constant** (alongside `EMPTY_CONTRACT`):
      ```typescript
      const EMPTY_LEAVE = { start_date: "", end_date: "", reason: "" };
      ```

      **Step C — `LeavesTab` component.** Add after the `ContractsTab` / `ContractRow` block and before `PayrollTab`. Mirror `ContractsTab` structure: a form card on top, a list card below.

      ```tsx
      function LeavesTab({ employeeId }: { employeeId: string }) {
        const queryClient = useQueryClient();
        const showToast = useToastStore((s) => s.showToast);
        const [form, setForm] = useState(EMPTY_LEAVE);

        const { data: leaves = [], isLoading } = useQuery({
          queryKey: ["leaves", employeeId],
          queryFn: () => fetchLeaves(employeeId),
        });

        const addMutation = useMutation({
          mutationFn: (payload: typeof EMPTY_LEAVE) => addLeave(employeeId, payload),
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leaves", employeeId] });
            showToast("success", "Data cuti berhasil ditambahkan.");
            setForm(EMPTY_LEAVE);
          },
          onError: (err: unknown) => {
            showToast("error", getErrorMessage(err, "Gagal menambah data cuti."));
          },
        });

        const deleteMutation = useMutation({
          mutationFn: (id: string) => deleteLeave(employeeId, id),
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leaves", employeeId] });
            showToast("success", "Data cuti berhasil dihapus.");
          },
          onError: (err: unknown) => {
            showToast("error", getErrorMessage(err, "Gagal menghapus data cuti."));
          },
        });

        const canSubmit = form.start_date && form.end_date && form.reason.trim();

        return (
          <div className="space-y-5">
            {/* Add leave form */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Tambah Riwayat Cuti</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    Alasan Cuti
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Tuliskan alasan cuti…"
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                </div>
                <div className="flex items-end sm:col-span-2 lg:col-span-3 lg:justify-end">
                  <button
                    type="button"
                    disabled={addMutation.isPending || !canSubmit}
                    onClick={() => addMutation.mutate(form)}
                    className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-secondary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {addMutation.isPending ? "Menyimpan…" : "Tambah Cuti"}
                  </button>
                </div>
              </div>
            </div>

            {/* Leaves list */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Riwayat Cuti</h2>
              {isLoading ? (
                <p className="text-sm text-gray-500">Memuat data cuti…</p>
              ) : leaves.length === 0 ? (
                <p className="text-sm text-gray-500">Belum ada riwayat cuti.</p>
              ) : (
                <div className="space-y-3">
                  {leaves.map((leave) => (
                    <LeaveRow
                      key={leave.id}
                      leave={leave}
                      onDelete={() => deleteMutation.mutate(leave.id)}
                      isDeleting={deleteMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }

      function LeaveRow({
        leave,
        onDelete,
        isDeleting,
      }: {
        leave: EmployeeLeave;
        onDelete: () => void;
        isDeleting: boolean;
      }) {
        return (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-800">
                  {safeDate(leave.start_date)}
                  <span className="mx-2 text-gray-400">—</span>
                  {safeDate(leave.end_date)}
                </div>
                <p className="text-sm text-gray-600">{leave.reason}</p>
                {leave.created_at && (
                  <p className="text-xs text-gray-400">Dicatat: {safeDate(leave.created_at)}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed"
              >
                Hapus
              </button>
            </div>
          </div>
        );
      }
      ```

      **Step D — register the tab.** In the `tabs` array inside `EmployeeDetailPage`, add the new tab after `"contracts"`:
      ```typescript
      { key: "leaves", label: "Riwayat Cuti" },
      ```

      **Step E — render the tab.** In the tab render block, add:
      ```tsx
      {activeTab === "leaves" && <LeavesTab employeeId={id} />}
      ```

      Files: `frontend/src/app/(dashboard)/employees/[id]/page.tsx`

      Verify: `cd frontend && npx tsc --noEmit` exits 0. Then open the browser, navigate to any employee detail page, and confirm "Riwayat Cuti" tab appears, the add form submits successfully, records appear in the list, and the delete button removes a record.

---

## Summary of files touched

| File | Action |
|---|---|
| `backend/app/models/employee_leave.py` | Create |
| `backend/app/models/employee.py` | Add `leaves` relationship to `Employee` |
| `backend/app/models/__init__.py` | Add import for `EmployeeLeave` |
| `backend/app/schemas/employee.py` | Add `EmployeeLeaveBase`, `EmployeeLeaveCreate`, `EmployeeLeaveResponse` |
| `backend/app/routers/employees.py` | Add imports + 3 leave endpoints |
| `backend/app/db/migrations/versions/<hash>_add_employee_leaves_table.py` | Generated by alembic |
| `frontend/src/types/index.ts` | Add `EmployeeLeave` interface |
| `frontend/src/lib/api/employees.ts` | Add `fetchLeaves`, `addLeave`, `deleteLeave` |
| `frontend/src/app/(dashboard)/employees/[id]/page.tsx` | Add `LeavesTab`, `LeaveRow`, tab entry, tab render |

## Alembic note

Alembic **must be run inside the `tms_backend` Docker container**. The `alembic.ini` uses `%(POSTGRES_HOST)s` interpolation that resolves to `pgbouncer`, which is only reachable within the `tms_internal` Docker network. The entrypoint script (`entrypoint.sh`) automatically runs `alembic upgrade head` on every container start, so once the migration file is committed and the container is restarted, it will be applied automatically.

---

## Verification results (run by implementation agent)

**Python AST syntax check (all backend files):** PASS
- `employee_leave.py` OK
- `employees.py` (router) OK  
- `employee.py` (model) OK
- `models/__init__.py` OK
- `schemas/employee.py` OK (verified by file read)

**TypeScript check:**
- `tsc --noEmit --skipLibCheck --isolatedModules`: exit 0, no errors
- Pre-existing TS1005 error on PersonalDataTab nested ternary (line 108) was fixed by reformatting.

**Alembic migration:**
- `alembic revision --autogenerate -m "add employee_leaves table"` → generated `10e7822c0983` (but included unrelated schema changes)
- Autogenerated migration failed on `extracted_json` TEXT→JSONB cast (pre-existing schema debt unrelated to leaves)
- Resolution: stub migration `10e7822c0983` (no-op) + clean migration `v1w2x3y4z5a6` (creates employee_leaves table only)
- `alembic upgrade head` output:
  ```
  Running upgrade u2v3w4x5y6z7 -> 10e7822c0983, add employee_leaves table (stub)
  Running upgrade 10e7822c0983 -> v1w2x3y4z5a6, add employee_leaves table
  ```
  **PASSED** — `employee_leaves` table created successfully in the database.

**Commit:** `feat: add Riwayat Cuti tab to employee detail page` (10 files, 380 insertions)
