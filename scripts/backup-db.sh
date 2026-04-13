#!/bin/bash
set -e

BACKUP_DIR="$HOME/.garnish/backups"
KEEP=14

mkdir -p "$BACKUP_DIR"

echo "==> Backing up garnish_production..."
pg_dump garnish_production > "$BACKUP_DIR/garnish_$(date +%Y%m%d).sql"

# Delete backups older than $KEEP days
find "$BACKUP_DIR" -name "garnish_*.sql" -mtime +$KEEP -delete

echo "==> Backup complete. Kept last $KEEP days."
