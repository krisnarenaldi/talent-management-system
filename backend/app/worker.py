"""
worker.py — arq WorkerSettings, entry point untuk container worker.

Jalankan dengan:
    arq app.worker.WorkerSettings

Di docker-compose.yml, worker service menggunakan command ini dengan image
yang sama dengan backend (tidak perlu Dockerfile terpisah).

Menggantikan:
  - n8n workflow "CV Parser" (8 HTTP node)  → process_cv_screening
  - n8n workflow "Database Backup"          → backup_database (cron 02.00)
  - n8n workflow "Contract Expiry Alert"    → check_contract_expiry (cron 08.00)
"""
from arq.connections import RedisSettings
from arq.cron import cron

from app.core.config import settings
from app.services.cv_pipeline import process_cv_screening
from app.services.ops_jobs import backup_database, check_contract_expiry


class WorkerSettings:
    # ── Task functions ────────────────────────────────────────────────────────
    functions = [process_cv_screening]

    # ── Cron jobs ─────────────────────────────────────────────────────────────
    cron_jobs = [
        cron(backup_database, hour=2, minute=0),        # harian 02.00
        cron(check_contract_expiry, hour=8, minute=0),  # harian 08.00
    ]

    # ── Redis connection ──────────────────────────────────────────────────────
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)

    # ── Concurrency & timeout ─────────────────────────────────────────────────
    max_jobs = 10
    job_timeout = 300   # 5 menit per CV — sesuaikan jika rata-rata lebih lama

    # ── Retry on worker crash (bukan retry on task error) ────────────────────
    # Jika worker restart saat job sedang berjalan, arq tidak otomatis re-enqueue.
    # Gunakan health check di docker-compose untuk restart otomatis.
    keep_result = 86400  # simpan hasil job 24 jam di Redis (untuk observability)
