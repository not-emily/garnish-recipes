# DB Backup & Restore Runbook

How nightly backups work, where they live, and how to recover from them.

## Backup paths

- **Local (primary recovery layer)** — `~/.garnish/backups/garnish_YYYYMMDD.sql.gz` on `farley-station`. 14-day rolling. Pruned by the script.
- **R2 (offsite, latest only)** — `s3://garnish-prod/db/latest.sql.gz`. Overwritten nightly. For "MacBook physically gone" scenarios.

**Recovery hierarchy:** always try local first (faster, more snapshots). R2 is only useful if local is also lost.

## Schedule

Nightly cron on `farley-station`:

```
0 3 * * * /Users/emily/.garnish/scripts/backup-db.sh >> ~/.garnish/backups/cron.log 2>&1
```

Script: `~/.garnish/scripts/backup-db.sh` (deployed copy of repo `scripts/backup-db.sh`).

## Health check

```bash
# On farley-station
tail -20 ~/.garnish/backups/cron.log    # Most recent run output
ls -la ~/.garnish/backups/              # Confirm files dated through yesterday

# From any machine with R2 creds (verifies offsite is fresh)
aws s3 ls s3://garnish-prod/db/ \
  --profile r2 \
  --endpoint-url "https://${CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
# LastModified should be after 03:00 today
```

## Manual run

Just runs the same script the cron runs. Safe any time — won't conflict with other operations.

```bash
# On farley-station
~/.garnish/scripts/backup-db.sh
```

## Restore from local

```bash
# Pick the dump you want (most recent unless you need to roll back further)
ls ~/.garnish/backups/garnish_*.sql.gz

# Restore into a scratch DB to verify before touching production
createdb garnish_restore_test
gunzip -c ~/.garnish/backups/garnish_YYYYMMDD.sql.gz | psql garnish_restore_test
psql garnish_restore_test -c "SELECT COUNT(*) FROM recipes;"  # sanity

# If satisfied, restore over production (DESTRUCTIVE — confirms your intent first)
sudo launchctl bootout system/<rails-launchd-label>  # stop Rails first
dropdb garnish_production
createdb garnish_production
gunzip -c ~/.garnish/backups/garnish_YYYYMMDD.sql.gz | psql garnish_production
sudo launchctl bootstrap system /Library/LaunchDaemons/<rails-launchd-label>.plist

# Cleanup
dropdb garnish_restore_test
```

## Restore from R2

When local is also unavailable (different machine, full disk loss).

```bash
# 1. Source R2 creds
source ~/.garnish/.env  # or set them manually

# 2. Download
aws s3 cp s3://garnish-prod/db/latest.sql.gz /tmp/garnish-latest.sql.gz \
  --profile r2 \
  --endpoint-url "https://${CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# 3. Decompress + restore (same as local restore from step 2 onward)
gunzip /tmp/garnish-latest.sql.gz
createdb garnish_restore_test
psql garnish_restore_test < /tmp/garnish-latest.sql

# 4. Verify, then restore over production with the same destructive sequence as above
```

## Common failure modes

| Symptom in `cron.log` | Cause | Fix |
|---|---|---|
| `pg_dump: command not found` | Cron's PATH doesn't include Postgres bin dir | Confirm `export PATH="/usr/local/pgsql/bin:$PATH"` is in `scripts/backup-db.sh` |
| Cron log file never updates | `~/.garnish/backups/` doesn't exist (redirect target) | `mkdir -p ~/.garnish/backups` |
| `Unable to locate credentials` | `~/.garnish/.env` not sourced or missing | Confirm file exists, `chmod 600`, has the four `CLOUDFLARE_R2_*` vars |
| `An error occurred (NoSuchBucket)` | Bucket name mismatch or wrong account ID | Verify `CLOUDFLARE_R2_BUCKET=garnish-prod` and the account ID matches the dashboard |
| `Could not connect to server` (pg_dump) | Postgres not running | `brew services restart postgresql` or check `pg_ctl status` |
| Empty / suspiciously small dump | Wrong DB name | Confirm `garnish_production` exists locally |
| `aws: command not found` | aws-cli not installed under cron's PATH | Confirm `which aws` from interactive shell, add its dir to script PATH if non-standard |

## When to re-run the restore drill

After:
- Major Postgres version upgrade
- Significant schema change (new large tables, new extensions)
- Any modification to `scripts/backup-db.sh`

A drill takes ~5 minutes and catches "the dumps were silently broken for weeks" before you actually need them.
