# Phase 1: R2 Setup + DB Backup Offsite

> **Depends on:** —
> **Enables:** Phase 2 (image bytes go to R2 in prod)
>
> See: [Full Plan](../plan.md)

## Goal

Stand up a Cloudflare R2 bucket with API credentials, install `aws-cli` on the prod Mac, extend the nightly DB backup to push `latest.sql.gz` to R2, and document the restore procedure.

## Key Deliverables

- R2 bucket created (`garnish-prod`) and bound to a scoped API token
- Four `CLOUDFLARE_R2_*` env vars wired on the prod Mac so Rails picks up R2 in production
- `aws-cli` installed and configured against R2's S3-compatible endpoint
- `scripts/backup-db.sh` extended: gzips the dump, uploads to `r2://garnish-prod/db/latest.sql.gz` overwriting nightly
- Restore drill executed once: pull from R2 → gunzip → `psql` into a scratch DB
- `docs/ops/backup-restore.md` runbook

## Files to Create / Modify

- `scripts/backup-db.sh` — modify: gzip step + `aws s3 cp` line + endpoint flag
- `docs/ops/backup-restore.md` — new
- `~/.garnish/env` on prod Mac (not in repo) — new

## Dependencies

**Internal:** —

**External:**
- Cloudflare account with R2 enabled (Cloudflare dashboard work)
- `aws-cli` v2 (`brew install awscli` on prod Mac)

## Implementation Notes

### 1.1 Cloudflare R2 bucket + API token

In the Cloudflare dashboard:

1. Navigate to **R2** → **Create bucket**
   - Name: `garnish-prod`
   - Location: Automatic
   - **Default encryption:** Cloudflare-managed (default)
2. Note the **Account ID** shown on the R2 home page (top right). Required for the S3 endpoint URL.
3. Navigate to **R2** → **Manage R2 API Tokens** → **Create API token**
   - Token name: `garnish-prod-rw`
   - Permissions: **Object Read & Write**
   - Specify bucket: `garnish-prod` (scope to this bucket only — limits blast radius if compromised)
   - TTL: leave blank (no expiry; rotate manually if needed)
   - Click **Create API Token**
4. Copy the **Access Key ID** and **Secret Access Key** immediately — they're only shown once.

### 1.2 Wire env vars on prod Mac

Rails picks these up via `production.rb:45` for ActiveStorage. Both Rails and the backup script need them.

Create `~/.garnish/env` on the prod Mac (sourced by both Rails launch script and cron):

```sh
# ~/.garnish/env — DO NOT COMMIT
export CLOUDFLARE_R2_ACCESS_KEY_ID="<from step 1.1.4>"
export CLOUDFLARE_R2_SECRET_ACCESS_KEY="<from step 1.1.4>"
export CLOUDFLARE_R2_ACCOUNT_ID="<from step 1.1.2>"
export CLOUDFLARE_R2_BUCKET="garnish-prod"
```

Permissions: `chmod 600 ~/.garnish/env`.

Update the Rails launch (Procfile.prod or launchd plist — whatever currently boots Puma) to source this file before starting Rails. Verify env reaches Rails: `Rails.env.production?` console shows the keys via `ENV["CLOUDFLARE_R2_BUCKET"]`.

**Deviation watch:** if the Mac's Rails is launched via a launchd plist with `EnvironmentVariables`, sourcing `~/.garnish/env` from a shell wrapper won't reach launchd. Two fixes: (a) embed the four env vars into the plist directly, or (b) wrap Rails launch in a shell script that `source`s the env file. Option (a) is more robust; option (b) lets you rotate keys without reloading the plist.

### 1.3 Install + configure `aws-cli`

```sh
brew install awscli
aws --version  # verify install
```

Configure a named profile for R2:

```sh
aws configure --profile r2
# AWS Access Key ID: <CLOUDFLARE_R2_ACCESS_KEY_ID>
# AWS Secret Access Key: <CLOUDFLARE_R2_SECRET_ACCESS_KEY>
# Default region: auto
# Default output format: json
```

Smoke test (replace `<account-id>`):

```sh
aws s3 ls s3://garnish-prod/ \
  --profile r2 \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com
# Should return empty (bucket is empty) without error
```

If this hangs or errors, troubleshoot before proceeding — every later step depends on it.

### 1.4 Extend `scripts/backup-db.sh`

Replace the existing dump line with: dump → gzip → local copy → upload to R2.

```sh
#!/bin/bash
set -e

# Cron on macOS runs with a minimal PATH; hard-code pg_dump location.
export PATH="/usr/local/pgsql/bin:$PATH"

# Source R2 credentials so aws-cli works under cron.
[ -f "$HOME/.garnish/env" ] && source "$HOME/.garnish/env"

BACKUP_DIR="$HOME/.garnish/backups"
KEEP=14
R2_ENDPOINT="https://${CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_BUCKET="${CLOUDFLARE_R2_BUCKET}"

mkdir -p "$BACKUP_DIR"

LOCAL_DUMP="$BACKUP_DIR/garnish_$(date +%Y%m%d).sql.gz"

echo "==> Backing up garnish_production..."
pg_dump garnish_production | gzip > "$LOCAL_DUMP"

echo "==> Uploading to R2 (latest.sql.gz, overwrite)..."
aws s3 cp "$LOCAL_DUMP" "s3://${R2_BUCKET}/db/latest.sql.gz" \
  --profile r2 \
  --endpoint-url "$R2_ENDPOINT"

# Local 14-day rolling cleanup (existing behavior, just covers .sql.gz too)
find "$BACKUP_DIR" -name "garnish_*.sql.gz" -mtime +$KEEP -delete
find "$BACKUP_DIR" -name "garnish_*.sql"    -mtime +$KEEP -delete

echo "==> Backup complete (local + R2). Kept last $KEEP days locally."
```

**Deviation watch:**
- `gzip` keeps the local copy compressed too — saves disk on the Mac. The find pattern matches both compressed and any old uncompressed dumps so legacy files prune cleanly.
- The `source $HOME/.garnish/env` line is critical for cron because cron's environment has none of the shell rc loading. Without this, `aws s3 cp` fails with missing credentials.
- `aws s3 cp` overwrites by default — exactly what we want for `latest.sql.gz`.

### 1.5 Restore drill (one-time)

Verify the backup is actually restorable. Run from any machine with R2 creds and `aws-cli` + `psql`:

```sh
# Download
aws s3 cp s3://garnish-prod/db/latest.sql.gz /tmp/garnish-latest.sql.gz \
  --profile r2 \
  --endpoint-url "https://${CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Decompress
gunzip /tmp/garnish-latest.sql.gz

# Restore into a scratch DB to verify (don't touch production!)
createdb garnish_restore_test
psql garnish_restore_test < /tmp/garnish-latest.sql

# Sanity check
psql garnish_restore_test -c "SELECT COUNT(*) FROM recipes;"
psql garnish_restore_test -c "SELECT COUNT(*) FROM users;"

# Cleanup
dropdb garnish_restore_test
rm /tmp/garnish-latest.sql
```

If the counts look reasonable (matches what's in production), the backup is good.

### 1.6 Runbook: `docs/ops/backup-restore.md`

Document in this order: where backups live (local 14-day, R2 latest-only), recovery hierarchy (always try local first), the exact restore commands, and known gotchas. Keep it under 100 lines — this gets read at 2am when something's wrong; brevity matters.

Include:
- Backup paths: `~/.garnish/backups/garnish_YYYYMMDD.sql.gz` (local), `s3://garnish-prod/db/latest.sql.gz` (R2)
- Manual run: `~/.garnish/scripts/backup-db.sh` (works under interactive shell too)
- Schedule: `0 3 * * * ...` cron entry on the Mac
- Restore from local: `gunzip -c ~/.garnish/backups/garnish_YYYYMMDD.sql.gz | psql garnish_production`
- Restore from R2: the four-command sequence from 1.5
- Cron health check: `tail -20 ~/.garnish/backups/cron.log` to see recent runs
- Common failure modes:
  - "command not found: pg_dump" → PATH issue, check the `export PATH=` line
  - "Unable to locate credentials" → `~/.garnish/env` not sourced, check it exists and is readable
  - "Bucket not found" → `CLOUDFLARE_R2_ACCOUNT_ID` mismatched
  - Empty backup → Postgres not running or wrong DB name

## Validation

- [ ] R2 bucket `garnish-prod` exists and is empty before first run
- [ ] `aws s3 ls s3://garnish-prod/ --profile r2 --endpoint-url ...` returns success without error
- [ ] Manual run of `~/.garnish/scripts/backup-db.sh` produces both a local `.sql.gz` file AND an R2 object visible via `aws s3 ls s3://garnish-prod/db/`
- [ ] Cron-simulated run succeeds: `env -i HOME="$HOME" PATH=/usr/bin:/bin ~/.garnish/scripts/backup-db.sh`
- [ ] Restore drill completes: scratch DB shows reasonable row counts in `recipes` and `users`
- [ ] `docs/ops/backup-restore.md` exists and covers all failure modes listed above
- [ ] Following morning after first cron run: `aws s3 ls s3://garnish-prod/db/` shows `latest.sql.gz` with LastModified after 3am
