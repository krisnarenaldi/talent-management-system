"""
One-time script to create all database tables from SQLAlchemy models,
then stamp alembic to the current head revision.
Run after fresh postgres setup (e.g. after colima reset).
Usage: docker compose exec -T backend python -m app.db.init_db
"""
import sys
import os

# Ensure project root is in path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, PROJECT_ROOT)
os.chdir(PROJECT_ROOT)

from app.db.database import engine, Base
from app.models import *  # noqa: F401,F403 — register semua model ke Base.metadata
from alembic.config import Config
from alembic import command


def main() -> None:
    print("Creating all tables from SQLAlchemy models...")
    Base.metadata.create_all(bind=engine)
    print("Done.")

    print("Stamping alembic to head revision...")
    alembic_cfg = Config(os.path.join(PROJECT_ROOT, "alembic.ini"))
    command.stamp(alembic_cfg, "head")
    print("Alembic stamped to head.")


if __name__ == "__main__":
    main()
