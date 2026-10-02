# Implementation Plan: Navbar Keyboard Shortcuts & Quick Create Menu

## Exploration Findings

### Navbar component
The navbar lives inside the dashboard layout: `frontend/src/app/(dashboard)/layout.tsx`. This is a `"use client"` component that already renders:
- `<NotificationBell />` from `@/components/NotificationBell`
- A `help` button (currently uses `material-symbols-outlined` icon `help` — this is the `?` button)
- An `apps` button (currently uses `material-symbols-outlined` icon `apps` — this is the dot-grid button)
- User avatar dropdown with `menuRef` / `menuOpen` state

Both placeholder buttons exist but are not wired up. The plan hooks into them.

### Auth store pattern
`useAuthStore` from `@/stores/auth.store` is used everywhere. The relevant selector is `isRole(...roles)` which returns a boolean. Pattern seen in `Sidebar.tsx`:
```ts
const isRole = useAuthStore((state) => state.isRole);
const isPM = isRole("pm");
```
Role values are `"admin" | "hr" | "manager" | "pm"` (from `src/types/index.ts`).

### Icon library
The project uses **Material Symbols Outlined** via a global CSS font (`<span className="material-symbols-outlined">icon_name</span>`). `lucide-react` is also installed but not used for UI icons — stick with Material Symbols to stay consistent.

### Existing hook patterns
- `useModalEscape.ts` — registers a `keydown` listener for Escape; the new `useKeyboardShortcuts` hook should follow the same structure but be more capable.
- `NotificationBell.tsx` — the popover click-outside pattern: `useRef` + `useEffect` with `mousedown` listener, returning `removeEventListener` in cleanup. **QuickCreateMenu must follow this exact pattern.**

### Existing modal pattern
No shared modal component exists yet; modals in the codebase are inline JSX inside the component. For `KeyboardShortcutModal`, follow the same inline-overlay pattern used in the user dropdown in `layout.tsx`:
- A `fixed inset-0 z-40` backdrop div + `onClick` to close
- A centered panel `fixed … z-50` 

### Tailwind design tokens available
Colors: `primary`, `on-primary`, `surface`, `on-surface`, `on-surface-variant`, `surface-container`, `surface-container-high`, `outline-variant`, `primary-container`, `on-primary-container`, `secondary-container`, `on-secondary-container`
Border radius: `rounded-xl` (0.75rem), `rounded-lg` (0.5rem)
Font sizes: `text-body-sm` (13px), `text-body-md` (14px), `text-headline-md` (20px), `text-label-sm` (11px)

### Build and type-check commands
- Build: `cd frontend && npm run build`
- Type-check: `cd frontend && npm run type-check`
- Lint: `cd frontend && npm run lint`

### Key routes confirmed to exist
- `/candidates/new` ✓
- `/applications/new` ✓
- `/blacklist/new` ✓
- `/employees` ✓ (no `/employees/new` route directory exists, so omit it from shortcuts)

**Assumption:** `/employees/new` route does not exist as a standalone page, so the QuickCreate action "Karyawan Baru" is removed from the plan. Only the confirmed routes are used.

---

## Implementation Plan

- [ ] 1. Create `useKeyboardShortcuts` hook
      Registers a global `keydown` listener on `document`. Ignores events when `e.target` is `INPUT`, `TEXTAREA`, `SELECT`, or `contentEditable`. Ignores events when `ctrlKey || metaKey || altKey` is held. On `?`: calls `setIsModalOpen(true)` (toggle). On `Escape`: calls `setIsModalOpen(false)`. Navigation shortcuts call `router.push(path)`: `c` → `/candidates/new`, `b` → `/blacklist/new`, `a` → `/applications/new`, `e` → `/employees`, `d` → `/dashboard`, `l` → `/blacklist`. The hook signature is `useKeyboardShortcuts(isModalOpen: boolean, setIsModalOpen: (v: boolean) => void): void`. Uses `useRouter` from `next/navigation` internally. Cleanup removes the listener on unmount.
      Files: `frontend/src/hooks/useKeyboardShortcuts.ts`
      Verify: `cd frontend && npm run type-check` — no TypeScript errors.

- [ ] 2. Create `KeyboardShortcutModal` component
      A centered full-screen overlay modal. The backdrop is `fixed inset-0 bg-black/40 z-50 flex items-center justify-center` with an `onClick` handler that calls `onClose`. The panel itself is a `div` (with `e.stopPropagation()` to prevent backdrop click from closing when clicking inside) styled `bg-surface rounded-2xl shadow-xl w-full max-w-md p-6 relative`. Title: `"Keyboard Shortcuts"` using `text-headline-md`. Close button `×` positioned `absolute top-4 right-4` using `text-on-surface-variant hover:text-on-surface`. Shortcut rows are a 2-column grid. Each row: `<kbd>` element styled `inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded bg-surface-container-high border border-outline-variant text-body-sm font-mono text-on-surface` + description text in `text-body-sm text-on-surface-variant`. Shortcut list (8 rows): `?` / Tampilkan/sembunyikan shortcut ini, `Esc` / Tutup modal, `C` / Kandidat baru, `B` / Blacklist baru, `A` / Lamaran baru, `E` / Daftar karyawan, `D` / Dashboard, `L` / Daftar blacklist. Props: `{ isOpen: boolean; onClose: () => void }`. Returns `null` when `!isOpen`.
      Files: `frontend/src/components/ui/KeyboardShortcutModal.tsx`
      Verify: `cd frontend && npm run type-check` — no TypeScript errors.

- [ ] 3. Create `QuickCreateMenu` component
      A popover triggered by the navbar dot-grid button. Props: `{ isOpen: boolean; onClose: () => void }`. Uses a `useRef<HTMLDivElement>` on the outer wrapper and a `useEffect` with `mousedown` listener (same pattern as `NotificationBell`) to close when clicking outside. Renders as `absolute right-0 top-10 z-50` panel: `bg-surface border border-outline-variant rounded-xl shadow-lg p-4 w-64`. Title: `"Akses Cepat"` in `text-body-sm font-medium text-on-surface-variant mb-3`. Actions grid: `grid grid-cols-2 gap-2`. Each action card is a `button` with `onClick` that calls `router.push(href)` then `onClose()`. Card style: `flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-primary-container hover:text-on-primary-container transition-colors text-center`. Icon: `<span className="material-symbols-outlined text-2xl">icon_name</span>`. Label: `text-label-sm`. Role-aware rendering uses `useAuthStore((s) => s.isRole)` called inside the component. Action list with roles and icons:
      - "Kandidat Baru" icon `person_add` → `/candidates/new` — roles: hr, manager, admin
      - "Lamaran Baru" icon `work` → `/applications/new` — roles: hr, manager, admin
      - "Blacklist Baru" icon `gavel` → `/blacklist/new` — roles: hr, manager, admin, pm
      Returns `null` when `!isOpen`.
      Files: `frontend/src/components/ui/QuickCreateMenu.tsx`
      Verify: `cd frontend && npm run type-check` — no TypeScript errors.

- [ ] 4. Wire everything into the dashboard layout
      In `frontend/src/app/(dashboard)/layout.tsx`:
      1. Add imports: `useKeyboardShortcuts` from `@/hooks/useKeyboardShortcuts`, `KeyboardShortcutModal` from `@/components/ui/KeyboardShortcutModal`, `QuickCreateMenu` from `@/components/ui/QuickCreateMenu`.
      2. Add state: `const [shortcutModalOpen, setShortcutModalOpen] = useState(false)` and `const [quickMenuOpen, setQuickMenuOpen] = useState(false)`.
      3. Call the hook: `useKeyboardShortcuts(shortcutModalOpen, setShortcutModalOpen)` — place after existing `useEffect` calls.
      4. Replace the existing static `help` button with an `onClick` handler:
         ```tsx
         <button
           onClick={() => setShortcutModalOpen((v) => !v)}
           className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary-container transition-colors"
           title="Keyboard shortcuts (?)"
         >
           <span className="material-symbols-outlined">help</span>
         </button>
         ```
      5. Replace the existing static `apps` button with a relative-positioned wrapper + `QuickCreateMenu`:
         ```tsx
         <div className="relative">
           <button
             onClick={() => setQuickMenuOpen((v) => !v)}
             className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary-container transition-colors"
             title="Akses cepat"
           >
             <span className="material-symbols-outlined">apps</span>
           </button>
           <QuickCreateMenu isOpen={quickMenuOpen} onClose={() => setQuickMenuOpen(false)} />
         </div>
         ```
      6. Render `<KeyboardShortcutModal isOpen={shortcutModalOpen} onClose={() => setShortcutModalOpen(false)} />` just before the closing `</TokenRefreshProvider>` tag (outside the scrolling content area so it renders above everything).
      Files: `frontend/src/app/(dashboard)/layout.tsx`
      Verify: `cd frontend && npm run build` — build succeeds with no TypeScript errors. Open the app and verify `?` key opens the modal, `Esc` closes it, `c` navigates to `/candidates/new`; clicking the `apps` icon shows the quick-create popover.

---

## Dependency order
- Items 1, 2, 3 are independent and can be implemented in any order (or in parallel).
- Item 4 depends on items 1, 2, and 3 all being complete.

## TypeScript verification result (post-implementation)

Command: `cd frontend && npx tsc --noEmit 2>&1 | head -50`

Result: **PASS** — zero errors introduced by the new code.
One pre-existing error found (unrelated to this change):
`src/app/(dashboard)/analytics/analytics-page.test.tsx(1,10): error TS2614: Module '"./page"' has no exported member 'formatPeriodLabel'.`
This error existed before this implementation and is not caused by any file modified here.

---

## Design decisions made
1. **No `/employees/new` route.** The route directory `frontend/src/app/(dashboard)/employees/` contains only `[id]/` and `page.tsx` — no `new/` subdirectory. Removed from shortcuts and quick-create rather than routing to a non-existent page.
2. **State lives in `layout.tsx`, not a context.** The modal and popover state (`shortcutModalOpen`, `quickMenuOpen`) are local `useState` in the layout. A context would be over-engineered for two boolean flags.
3. **No new modal abstraction.** The project has no shared `<Modal>` wrapper; the backdrop+panel pattern used in the user dropdown is copied directly into `KeyboardShortcutModal`. Adding a new abstraction for a single use case adds unnecessary indirection.
4. **QuickCreate uses `isOpen` prop instead of self-contained toggle.** The open state lives in the parent (layout) so the `apps` button in the navbar can control it. This is consistent with how `NotificationBell` is structured as a self-contained component, except here we expose the state up since the trigger button is in the parent.
5. **Material Symbols only.** `lucide-react` is installed but not used for UI icons in the existing components. All icons use `material-symbols-outlined` spans.
