#!/bin/sh
set -e

if [ -d /uploads ]; then
  chown -R appuser:appuser /uploads 2>/dev/null || chmod -R 777 /uploads 2>/dev/null || true
fi

exec gosu appuser "$@"