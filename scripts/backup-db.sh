#!/bin/bash
set -e

# Cron on macOS runs with a minimal PATH (/usr/bin:/bin) and won't find
# pg_dump from the EnterpriseDB Postgres installer. Hard-code its location
# so the script works under cron and from an interactive shell.
export PATH="/usr/local/pgsql/bin:$PATH"

BACKUP_DIR="$HOME/.garnish/backups"
KEEP=14

mkdir -p "$BACKUP_DIR"

echo "==> Backing up garnish_production..."
pg_dump garnish_production > "$BACKUP_DIR/garnish_$(date +%Y%m%d).sql"

# Delete backups older than $KEEP days
find "$BACKUP_DIR" -name "garnish_*.sql" -mtime +$KEEP -delete

echo "==> Backup complete. Kept last $KEEP days."
