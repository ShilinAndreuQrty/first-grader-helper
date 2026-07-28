#!/usr/bin/env sh
set -eu

backup_dir="${BACKUP_DIR:-./backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"

docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump --format=custom \
  --username="${POSTGRES_USER:-ipmkn}" \
  --dbname="${POSTGRES_DB:-ipmkn}" \
  > "$backup_dir/ipmkn-$timestamp.dump"

echo "Backup created: $backup_dir/ipmkn-$timestamp.dump"
