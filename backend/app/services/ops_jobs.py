"""
ops_jobs.py — Cron jobs arq pengganti n8n "Database Backup" dan "Contract Expiry Alert".

Kedua fungsi ini didaftarkan di WorkerSettings.cron_jobs di app/worker.py.
Dipanggil otomatis oleh arq runtime sesuai jadwal yang dikonfigurasi.
"""
from __future__ import annotations

import asyncio
import datetime
import logging
import os
import subprocess
import tempfile

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.employee import Employee, EmployeeContract
from app.models.notification import Notification
from app.models.user import User
from app.services.onedrive_service import onedrive_service

logger = logging.getLogger("ops_jobs")


# ── Database Backup ──────────────────────────────────────────────────────────

async def backup_database(ctx: dict) -> None:
    """
    Harian 02.00 — jalankan pg_dump, upload ke OneDrive /backups/, hapus file lokal.
    Menggantikan n8n workflow "Database Backup".
    """
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"tms_backup_{timestamp}.sql"

    pg_host = settings.POSTGRES_HOST
    pg_db = settings.POSTGRES_DB
    pg_user = settings.POSTGRES_USER

    logger.info("Memulai pg_dump: db=%s host=%s", pg_db, pg_host)

    with tempfile.TemporaryDirectory() as tmpdir:
        dump_path = os.path.join(tmpdir, filename)

        env = os.environ.copy()
        env["PGPASSWORD"] = settings.POSTGRES_PASSWORD

        try:
            proc = await asyncio.create_subprocess_exec(
                "pg_dump",
                "-h", pg_host,
                "-p", str(settings.POSTGRES_PORT),
                "-U", pg_user,
                "-d", pg_db,
                "-F", "p",          # plain-text SQL
                "-f", dump_path,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()
        except FileNotFoundError:
            logger.error("pg_dump tidak ditemukan di PATH — lewati backup")
            return

        if proc.returncode != 0:
            logger.error("pg_dump gagal (returncode=%d): %s", proc.returncode, stderr.decode())
            return

        file_size = os.path.getsize(dump_path)
        logger.info("pg_dump selesai: %s (%d bytes)", filename, file_size)

        # Upload ke OneDrive jika dikonfigurasi
        if settings.STORAGE_BACKEND == "onedrive" and settings.ONEDRIVE_DRIVE_ID:
            try:
                with open(dump_path, "rb") as fh:
                    content = fh.read()
                result = await onedrive_service.upload_file(
                    file_content=content,
                    filename=filename,
                    folder="backups",
                )
                logger.info(
                    "Backup diupload ke OneDrive: drive_item_id=%s",
                    result.get("drive_item_id"),
                )
            except Exception as exc:
                logger.error("Gagal upload backup ke OneDrive: %s", exc)
        else:
            # Simpan di volume lokal (untuk dev / local storage)
            backup_dir = os.path.join(settings.UPLOAD_DIR, "backups")
            os.makedirs(backup_dir, exist_ok=True)
            dest = os.path.join(backup_dir, filename)
            import shutil
            shutil.copy2(dump_path, dest)
            logger.info("Backup disimpan lokal: %s", dest)

    logger.info("Backup selesai: %s", filename)


# ── Contract Expiry Alert ─────────────────────────────────────────────────────

_ALERT_DAYS = [30, 14, 7]  # hari sebelum kontrak berakhir


async def check_contract_expiry(ctx: dict) -> None:
    """
    Harian 08.00 — cek kontrak karyawan yang berakhir dalam 30/14/7 hari,
    buat notifikasi ke semua user berole Manager dan Admin.
    Menggantikan n8n workflow "Contract Expiry Alert".
    """
    today = datetime.date.today()
    db = SessionLocal()
    try:
        # Ambil semua Manager dan Admin untuk menerima notifikasi
        managers = (
            db.query(User)
            .filter(
                User.is_active == True,
                User.role.in_(["manager", "admin"]),
            )
            .all()
        )

        if not managers:
            logger.warning("Tidak ada Manager/Admin aktif untuk menerima notifikasi kontrak.")
            return

        notif_count = 0
        for days in _ALERT_DAYS:
            target_date = today + datetime.timedelta(days=days)

            expiring = (
                db.query(EmployeeContract)
                .join(Employee, EmployeeContract.employee_id == Employee.id)
                .filter(
                    EmployeeContract.end_date == target_date,
                    EmployeeContract.status == "aktif",
                    Employee.employee_status == "aktif",
                )
                .all()
            )

            for contract in expiring:
                employee = contract.employee
                message = (
                    f"Kontrak karyawan {employee.full_name} akan berakhir "
                    f"dalam {days} hari ({target_date.strftime('%d %b %Y')})"
                )
                link = f"/employees/{employee.id}"

                for mgr in managers:
                    notif = Notification(
                        user_id=mgr.id,
                        type="contract_expiry_alert",
                        message=message,
                        link=link,
                    )
                    db.add(notif)
                    notif_count += 1

        if notif_count:
            db.commit()
            logger.info(
                "Contract expiry check selesai: %d notifikasi dibuat (hari ini: %s)",
                notif_count,
                today,
            )
        else:
            logger.info("Contract expiry check: tidak ada kontrak yang berakhir dalam %s hari ke depan.", _ALERT_DAYS)

    except Exception as exc:
        logger.exception("check_contract_expiry gagal: %s", exc)
        db.rollback()
    finally:
        db.close()
