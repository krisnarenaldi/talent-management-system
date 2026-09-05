from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, users, clients, positions, candidates, applications
from app.routers import blacklist, employees, export, admin, internal
from app.routers import agreement_types, blacklist_status_types

app = FastAPI(
    title="TMS API",
    description="Talent Management System — Altek",
    version="1.0.0",
    docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/api/redoc" if settings.ENVIRONMENT != "production" else None,
    redirect_slashes=False,  # Hindari redirect otomatis yang memecah CORS
)

# CORS — hanya izinkan origin frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,  # Penting untuk httpOnly cookie
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router,         prefix="/api/v1/auth",                 tags=["Auth"])
app.include_router(users.router,        prefix="/api/v1/users",                tags=["Users"])
app.include_router(clients.router,      prefix="/api/v1/clients",              tags=["Clients"])
app.include_router(positions.router,    prefix="/api/v1/positions",            tags=["Positions"])
app.include_router(candidates.router,   prefix="/api/v1/candidates",           tags=["Candidates"])
app.include_router(applications.router, prefix="/api/v1/applications",         tags=["Applications"])
app.include_router(blacklist.router,    prefix="/api/v1/blacklist",            tags=["Blacklist"])
app.include_router(employees.router,    prefix="/api/v1/employees",            tags=["Employees"])
app.include_router(export.router,       prefix="/api/v1/export",               tags=["Export"])
app.include_router(admin.router,        prefix="/api/v1/admin",                tags=["Admin"])
app.include_router(internal.router,     prefix="/api/v1/internal",             tags=["Internal"])
app.include_router(agreement_types.router,    prefix="/api/v1/agreement-types",  tags=["Agreement Types"])
app.include_router(blacklist_status_types.router, prefix="/api/v1/blacklist-status-types", tags=["Blacklist Status Types"])


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "TMS API"}
