#!/bin/sh
set -e

if [ -d /uploads ]; then
  chown -R appuser:appuser /uploads
fi

exec gosu appuser "$@"