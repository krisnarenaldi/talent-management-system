#!/bin/sh
set -e

if [ -d /uploads ]; then
  chown -R appuser:appuser /uploads 2>/dev/null || chmod -R 777 /uploads 2>/dev/null || true
fi

echo "Running database migrations..."
if alembic upgrade head; then
  echo "Migrations completed successfully."
else
  echo "ERROR: Migration failed!"
  exit 1
fi

exec gosu appuser "$@"