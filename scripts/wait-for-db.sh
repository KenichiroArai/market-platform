#!/usr/bin/env sh
set -eu

HOST="${POSTGRES_HOST:-localhost}"
PORT="${POSTGRES_PORT:-5432}"
USER="${POSTGRES_USER:-market}"
DB="${POSTGRES_DB:-market}"
RETRIES="${WAIT_FOR_DB_RETRIES:-30}"

echo "Waiting for PostgreSQL at ${HOST}:${PORT}..."

i=0
while [ "$i" -lt "$RETRIES" ]; do
  if pg_isready -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" >/dev/null 2>&1; then
    echo "PostgreSQL is ready."
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done

echo "Timed out waiting for PostgreSQL." >&2
exit 1
