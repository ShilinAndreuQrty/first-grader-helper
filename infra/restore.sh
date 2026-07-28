#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  echo "Usage: ./infra/restore.sh ./backups/ipmkn-TIMESTAMP.dump" >&2
  exit 2
fi

echo "Restore replaces the current database content."
docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore --clean --if-exists \
  --username="${POSTGRES_USER:-ipmkn}" \
  --dbname="${POSTGRES_DB:-ipmkn}" < "$1"
