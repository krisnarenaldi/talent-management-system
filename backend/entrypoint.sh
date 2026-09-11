#!/bin/sh
set -e

# Change ownership of the uploads directory to the appuser
# This ensures the app can write to the /uploads directory even when
# mounted via Docker volume or bind mount from host
if [ -d /uploads ]; then
  chown -R appuser:appuser /uploads
fi

# Execute the original command
exec "$@"