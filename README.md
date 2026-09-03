# TMS — Talent Management System
**Client:** Altek (Perusahaan Penyedia Jasa Rekrutmen)

## Stack
| Layer | Teknologi |
|---|---|
| Frontend | Next.js 15 + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | PostgreSQL 16 + PgBouncer |
| Automation | n8n (self-hosted) |
| File Storage | OneDrive for Business (Microsoft Graph API) |
| Infrastruktur | Docker Compose di Hostinger VPS KVM 2 |

## Struktur Folder
```
├── frontend/       # Next.js App
├── backend/        # FastAPI App
├── docs/           # PRD, ERD, dan dokumentasi lainnya
├── .kiro/specs/    # Requirements, Design, Tasks
├── docker-compose.yml
├── nginx.conf
└── .env.example
```

## Mulai Development

### 1. Salin environment variables
```bash
cp .env.example .env
# Edit .env dengan nilai yang sesuai
```

### 2. Jalankan semua service
```bash
docker-compose up -d
```

### 3. Jalankan database migration
```bash
docker-compose exec backend alembic upgrade head
```

### 4. Seed data awal
```bash
docker-compose exec backend python -m app.db.seed
```

### Akses
- Frontend: http://localhost (via Nginx)
- API Docs: http://localhost/api/docs (development only)
- n8n: http://localhost/n8n/

## Fasa Implementasi
| Fase | Status | Fokus |
|---|---|---|
| Fase 1 — MVP | 🚧 In Progress | Database kandidat, pipeline rekrutmen, blacklist, export, monitoring karyawan |
| Fase 2 — CV | ⏳ Planned | Generate CV standar dari template Altek |
| Fase 3 — AI | ⏳ Planned | Ekstraksi CV, AI scoring, Natural Language Search |
| Fase 4 — Analytics | ⏳ Planned | Dashboard pola kandidat |

## Dokumentasi Lengkap
- [Requirements](.kiro/specs/requirements.md)
- [Design](.kiro/specs/design.md)
- [Tasks](.kiro/specs/tasks.md)
- [PRD](docs/PRD-Talent-Management-System.md)
- [ERD](docs/ERD-TMS.mermaid)
