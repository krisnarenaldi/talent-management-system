#!/bin/bash
set -e

# ============================================================
# TMS Backend Entrypoint
# Dijalankan setiap kali container backend start.
# Menangani migration Alembic secara aman (idempotent).
# ============================================================

echo "==> [entrypoint] Menunggu database siap..."

# Tunggu postgres / pgbouncer siap menerima koneksi
MAX_RETRIES=30
COUNT=0
until python -c "
import psycopg2, os, sys
try:
    conn = psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'pgbouncer'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        dbname=os.getenv('POSTGRES_DB'),
        user=os.getenv('POSTGRES_USER'),
        password=os.getenv('POSTGRES_PASSWORD'),
        connect_timeout=3,
    )
    conn.close()
    sys.exit(0)
except Exception as e:
    sys.exit(1)
" 2>/dev/null; do
    COUNT=$((COUNT + 1))
    if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
        echo "==> [entrypoint] ERROR: Database tidak bisa dihubungi setelah ${MAX_RETRIES} percobaan. Abort."
        exit 1
    fi
    echo "==> [entrypoint] Database belum siap, retry ${COUNT}/${MAX_RETRIES}..."
    sleep 2
done

echo "==> [entrypoint] Database siap."

# ── Jalankan Alembic migration ──────────────────────────────
# Strategi: upgrade head selalu.
# Jika ada revision yang sudah diapply manual (DuplicateTable, dll),
# script ini akan mendeteksi dan stamp otomatis ke revision terakhir yang aman.

echo "==> [entrypoint] Menjalankan Alembic migration..."

# Coba upgrade head. Jika gagal karena objek sudah ada (deploy ulang / manual migration),
# stamp ke head lalu coba lagi.
if ! python -m alembic upgrade head 2>&1; then
    echo "==> [entrypoint] Migration gagal, mencoba stamp ke head lalu retry..."
    python -m alembic stamp head
    python -m alembic upgrade head
fi

echo "==> [entrypoint] Migration selesai."

# ── Jalankan command utama (uvicorn / arq) ──────────────────
echo "==> [entrypoint] Menjalankan: $@"
exec "$@"
