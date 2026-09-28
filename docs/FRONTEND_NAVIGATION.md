# Frontend Navigation Structure - Talent Management System

## Route Hierarchy

```
/ (Dashboard)
├── /clients                    # Client Management
│   ├── /clients                # List clients (table dengan search/filter)
│   ├── /clients/:id            # Client detail + positions
│   └── /clients/new            # Create client
│
├── /positions                  # Job Openings / Posisi
│   ├── /positions              # List positions (kanban by status: active/closed)
│   ├── /positions/:id          # Position detail + applications pipeline
│   └── /positions/new          # Create position
│
├── /candidates                 # Candidate Pool
│   ├── /candidates             # List kandidat (table + filter: source, status, skills)
│   ├── /candidates/:id         # Candidate profile detail
│   │   ├── /profile            # Basic info, education, experience, documents
│   │   ├── /applications       # History lamaran
│   │   ├── /generated-cvs      # CV yang di-generate
│   │   └── /blacklist          # Blacklist status (jika ada)
│   ├── /candidates/import      # Bulk import kandidat
│   └── /candidates/blacklist   # Blacklist management (list + add)
│
├── /recruitment                # Recruitment Pipeline (Core)
│   ├── /recruitment/pipeline   # Kanban board by stage
│   │   ├── Konfirmasi
│   │   ├── HR Interview
│   │   ├── Psikotest
│   │   ├── User Interview
│   │   ├── Offering
│   │   ├── Kontrak
│   │   └── Onboarding
│   ├── /recruitment/applications/:id  # Application detail
│   │   ├── /overview           # Summary kandidat + position
│   │   ├── /stages             # Stage history timeline
│   │   ├── /ai-screening       # AI screening result
│   │   ├── /schedule           # Interview scheduling
│   │   ├── /offer              # Offer management
│   │   ├── /contract           # Contract generation
│   │   └── /onboarding         # Onboarding checklist
│   └── /recruitment/calendar   # Interview calendar view
│
├── /employees                  # Employee Management
│   ├── /employees              # Directory (table: NIP, name, client, status, contract end)
│   ├── /employees/:id          # Employee detail
│   │   ├── /profile            # Personal info, placement, role
│   │   ├── /contracts          # Contract history (list + create extension)
│   │   ├── /payroll            # Payroll data (restricted: HR/Admin only)
│   │   ├── /documents          # Document management
│   │   └── /history            # Placement history (via candidate_id)
│   ├── /employees/contracts    # Contract management (expiring soon, renewals)
│   └── /employees/onboarding   # Onboarding tasks for new hires
│
├── /reports                    # Analytics & Reports
│   ├── /reports/recruitment    # Funnel, time-to-hire, source effectiveness
│   ├── /reports/employees      # Headcount, turnover, contract expiry
│   ├── /reports/clients        # Revenue per client, placement rate
│   └── /reports/custom         # Custom report builder
│
├── /settings                   # Settings & Admin (role-based)
│   ├── /settings/users         # User management (Admin only)
│   ├── /settings/roles         # Role & permission matrix
│   ├── /settings/master-data   # Master data management
│   │   ├── /agreement-types    # CRUD agreement types
│   │   ├── /blacklist-statuses # CRUD blacklist categories
│   │   ├── /source-channels    # CRUD source channels
│   │   └── /stage-config       # Configure recruitment stages
│   └── /settings/system        # System config (notifications, email templates)
│
└── /profile                    # Current user profile
    ├── /profile/account        # Account settings
    └── /profile/notifications  # Notification preferences
```

---

## Role-Based Menu Visibility

| Menu | Admin | HR | Manager | Recruiter |
|------|-------|-----|---------|-----------|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Clients | ✅ | ✅ | ✅ | ✅ |
| Positions | ✅ | ✅ | ✅ | ✅ |
| Candidates | ✅ | ✅ | ✅ | ✅ |
| Recruitment Pipeline | ✅ | ✅ | ✅ | ✅ |
| Employees | ✅ | ✅ | ✅ | ❌ |
| Employee Payroll | ✅ | ✅ | ❌ | ❌ |
| Reports | ✅ | ✅ | ✅ | 👁️ (own only) |
| Settings > Users | ✅ | ❌ | ❌ | ❌ |
| Settings > Master Data | ✅ | ✅ | ❌ | ❌ |
| Settings > System | ✅ | ❌ | ❌ | ❌ |

---

## Key UI Components per Route

### 1. `/recruitment/pipeline` - Kanban Board
- Columns = STAGE_HISTORY.stage_name values
- Cards = APPLICATION with: candidate name, position, client, days in stage, AI score badge
- Drag-drop → update STAGE_HISTORY + APPLICATION.current_stage
- Quick actions: schedule interview, send offer, generate contract

### 2. `/candidates/:id` - Candidate 360° View
- **Tabs**: Profile | Applications | Generated CVs | Documents | Blacklist
- Profile: edit basic info, add education/experience inline
- Documents: upload + verify (CANDIDATE_DOCUMENT.is_verified)
- AI CV Generator button → creates GENERATED_CV record

### 3. `/employees/:id/contracts` - Contract Timeline
- Visual timeline of EMPLOYEE_CONTRACT records
- Show: agreement type, duration, status, auto-calculated end_date
- "Extend Contract" button → pre-fill new contract with same agreement_type
- Alert badge if end_date < 30 days

### 4. `/settings/master-data/agreement-types` - Master Data CRUD
- Simple table: label, is_active, created_by, actions
- Used in: EMPLOYEE_CONTRACT.agreement_type_id dropdown

---

## Suggested Tech Stack for Navigation

```typescript
// React Router v6 + Nested Routes
const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'clients', element: <Clients /> },
      { path: 'positions', element: <Positions /> },
      { path: 'candidates', element: <Candidates /> },
      { path: 'recruitment', element: <Recruitment /> },
      { path: 'employees', element: <Employees /> },
      { path: 'reports', element: <Reports /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
  { path: '/login', element: <Login /> },
];
```

---

## Priority Implementation Order

| Phase | Routes | Reason |
|-------|--------|--------|
| **MVP 1** | Dashboard, Positions, Candidates, Recruitment Pipeline, Application Detail | Core recruitment flow |
| **MVP 2** | Clients, Employees (basic), Settings (master data) | Complete data management |
| **MVP 3** | Reports, Payroll, Contract Extensions, Onboarding | Advanced features |
| **Later** | Calendar, Custom Reports, Bulk Import, Notifications | Nice to have |

---

## State Management Notes

- **React Query / TanStack Query** untuk server state (caching, invalidation)
- **Zustand / Context** untuk: current user, permissions, UI state (sidebar open, filters)
- **React Hook Form + Zod** untuk forms (validation matches backend schema)