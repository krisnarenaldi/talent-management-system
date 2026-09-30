#!/bin/sh
set -e

# ── Fix uploads ownership ─────────────────────────────────────────────────────
if [ -d /uploads ]; then
  chown -R appuser:appuser /uploads 2>/dev/null || chmod -R 777 /uploads 2>/dev/null || true
fi

# ── Wait for DB then run migrations ──────────────────────────────────────────
# Alembic upgrade head sering gagal karena postgres/pgbouncer belum siap.
# Strategi: retry hingga 30x dengan jeda 2 detik (total max ~60 detik).
echo "Waiting for database to be ready..."

MAX_RETRIES=30
RETRY_DELAY=2
attempt=1

until alembic upgrade head 2>&1; do
  exit_code=$?

  # Jika error bukan koneksi (misal error migration logic), jangan retry
  # Error kode 1 dari alembic bisa berarti apapun — kita cek output-nya
  if alembic current 2>&1 | grep -q "Can't connect\|connection refused\|could not connect\|Connection refused"; then
    if [ "$attempt" -ge "$MAX_RETRIES" ]; then
      echo "ERROR: Database still not reachable after $MAX_RETRIES attempts. Aborting."
      exit 1
    fi
    echo "DB not ready yet (attempt $attempt/$MAX_RETRIES), retrying in ${RETRY_DELAY}s..."
    attempt=$((attempt + 1))
    sleep "$RETRY_DELAY"
  else
    # Bukan masalah koneksi — langsung gagal dengan pesan jelas
    echo "ERROR: Migration failed with a non-connection error (exit $exit_code). Check migration files."
    exit 1
  fi
done

echo "Migrations completed successfully."

# ── Hand off to app process ───────────────────────────────────────────────────
exec gosu appuser "$@"
