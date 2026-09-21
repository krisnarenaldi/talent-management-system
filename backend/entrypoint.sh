#!/bin/sh
set -e

if [ -d /uploads ]; then
  chown -R appuser:appuser /uploads 2>/dev/null || chmod -R 777 /uploads 2>/dev/null || true
fi

echo "Running database migrations..."
if ! alembic upgrade head 2>&1; then
  echo "Migration failed, attempting to stamp head (schema may already be up-to-date)..."
  alembic stamp head
  echo "Stamped head. Retrying upgrade..."
  alembic upgrade head
fi

exec gosu appuser "$@"