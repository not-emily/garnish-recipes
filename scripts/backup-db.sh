#!/bin/bash
set -e

# Cron on macOS runs with a minimal PATH (/usr/bin:/bin) and won't find
# pg_dump from the EnterpriseDB Postgres installer. Hard-code its location
# so the script works under cron and from an interactive shell.
export PATH="/usr/local/pgsql/bin:$PATH"

# R2 credentials for the offsite upload step. Cron has no shell rc loaded,
# so explicitly source the env file. Missing file = local-only backup
# (still useful) — the aws s3 cp below will simply fail downstream.
[ -f "$HOME/.garnish/.env" ] && source "$HOME/.garnish/.env"

BACKUP_DIR="$HOME/.garnish/backups"
KEEP=14

mkdir -p "$BACKUP_DIR"

LOCAL_DUMP="$BACKUP_DIR/garnish_$(date +%Y%m%d).sql.gz"

echo "==> Backing up garnish_production to $LOCAL_DUMP..."
pg_dump garnish_production | gzip > "$LOCAL_DUMP"

if [ -n "${CLOUDFLARE_R2_ACCOUNT_ID:-}" ] && [ -n "${CLOUDFLARE_R2_BUCKET:-}" ]; then
  echo "==> Uploading to R2 (latest.sql.gz, overwrite)..."
  aws s3 cp "$LOCAL_DUMP" "s3://${CLOUDFLARE_R2_BUCKET}/db/latest.sql.gz" \
    --profile r2 \
    --endpoint-url "https://${CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
else
  echo "==> Skipping R2 upload (CLOUDFLARE_R2_* env vars not set)."
fi

# Delete backups older than $KEEP days. Patterns cover both compressed
# and any legacy uncompressed dumps.
find "$BACKUP_DIR" -name "garnish_*.sql.gz" -mtime +$KEEP -delete
find "$BACKUP_DIR" -name "garnish_*.sql"    -mtime +$KEEP -delete

echo "==> Backup complete. Kept last $KEEP days locally."
