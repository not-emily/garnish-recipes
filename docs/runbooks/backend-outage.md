# Backend Outage Runbook

When the Garnish backend becomes briefly unreachable or slow enough that the frontend's `OfflineBanner` shows "Can't reach the server." Most episodes resolve in 1–5 minutes; this document covers how to diagnose and how to tell a transient blip from something more serious.

The backend runs natively (no Docker) on the MacBook Pro `farley_station`, reachable over Tailscale. Public traffic comes in via Cloudflare Tunnel.

## Symptoms users see

- `OfflineBanner` showing "Can't reach the server — retrying…"
- New requests hang for 5–10 seconds, then fail with a toast
- Real-time updates stop (grocery/meal plan changes from other household members don't appear); `ConnectionIndicator` shows "Reconnecting…"
- Login works normally once the server recovers — **session is not lost** as of Phase 1

If the user reports being "logged out" with a generic error: first confirm they actually see the sign-in page (real logout) vs. they're seeing the banner/error toast and the app is still mounted (not a logout — just slow server).

## Fast check from any machine

```bash
# From your dev laptop (over Tailscale):
HEALTH_URL=http://farley_station:3000/api/v1/health scripts/check-health.sh

# Or publicly (via Cloudflare Tunnel):
HEALTH_URL=https://api.garnish.app/api/v1/health scripts/check-health.sh
```

The `/api/v1/health` endpoint returns `200` when everything is healthy and `503` when a subsystem is down. Its JSON tells you *which* subsystem:

```json
{
  "ok": true,
  "database": { "reachable": true, "pool_size": 20, "pool_busy": 3 },
  "goodjob": { "mode": "async", "max_threads": 5 },
  "cable": { "connection_count": 2 },
  "puma": { "max_threads": 5, "pool_capacity": 4, "requests_count": 12834 },
  "memory_rss_mb": 284.3,
  "version": "abc1234",
  "timestamp": "2026-04-22T21:14:00Z"
}
```

### Red flags

| Field | Concerning value | What it means |
|-------|------------------|---------------|
| `database.reachable` | `false` | Postgres is down or the pool is fully exhausted and can't even run `SELECT 1` |
| `database.pool_busy` | `== pool_size` | All connections checked out — next request will wait on `checkout_timeout` |
| `goodjob.mode` | `inline_fallback` | GoodJob config couldn't load — background jobs may be inline-blocking requests |
| `cable.connection_count` | `0` when users are active | WebSocket upgrades are failing (CF Tunnel, reverse proxy) |
| `puma.pool_capacity` | `0` | All Puma threads busy — requests are queueing |
| `memory_rss_mb` | `> 800` sustained | Worker is leaking or the machine is under memory pressure |

## SSH in for a deeper look

```bash
ssh farley_station
cd ~/.garnish/backend
```

### Is Puma running? How many workers?

```bash
ps aux | grep '[p]uma' | head
# Expect: 1 "cluster" master + N workers = (WEB_CONCURRENCY, default 1)
```

If no Puma process is running, the app has died. Check `log/production.log` for the crash reason and restart:

```bash
bin/rails restart
# or from your laptop:
scripts/deploy-backend.sh   # full redeploy, overkill for just a restart
```

### Is Postgres up?

```bash
pg_isready -p 5432 -d garnish_production
# "accepting connections" → DB fine; anything else → Postgres issue
```

### Connection usage right now

```bash
psql garnish_production -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'garnish_production';"
```

Compare against `pool × (workers + 1)` (the +1 accounts for GoodJob's schedulers running inside the worker). With the defaults (`DB_POOL=20`, `WEB_CONCURRENCY=1`), expect up to ~20 active connections under load.

### Is Cloudflare Tunnel connected?

```bash
sudo launchctl list | grep cloudflared
# Or:
tail -n 50 /Library/Logs/com.cloudflare.cloudflared.log
# Look for "Registered tunnel connection" vs. "Connection lost"
```

CF Tunnel can drop and reconnect silently; that window is the most common "server unavailable" cause that isn't really the server's fault.

### Recent server log

```bash
tail -n 200 log/production.log | less
# Grep for trouble fingerprints:
grep -E 'ActiveRecord::ConnectionTimeoutError|Puma::ThreadPool|Cannot acquire' log/production.log | tail
```

## Common causes and fingerprints

### 1. Connection pool exhaustion (most likely)

**Fingerprint**: `ActiveRecord::ConnectionTimeoutError` in log; `/health` shows `pool_busy == pool_size`; user symptoms resolve after 10s bursts.

**Fix now**: restart the process (`bin/rails restart`). Usually clears stuck connections from a leaked query.

**Fix permanently**: increase `DB_POOL` in `.env`. Default in `database.yml` is 20 — bump to 30 if you've grown household members or run more concurrent GoodJob imports.

### 2. GoodJob stuck or looping

**Fingerprint**: `/health` shows GoodJob in async mode but the job table keeps growing; `good_jobs` rows with very old `scheduled_at` values.

**Check**: `psql garnish_production -c "SELECT id, job_class, scheduled_at FROM good_jobs WHERE finished_at IS NULL ORDER BY scheduled_at LIMIT 20;"`

**Fix**: restart Puma — GoodJob runs in-process and restarts with it.

### 3. Cloudflare Tunnel disconnect

**Fingerprint**: `/health` works over Tailscale but not the public URL; `cloudflared` logs show "Connection lost"; users report outage but local `curl` to `localhost:3000` works fine.

**Fix**: `sudo launchctl kickstart -k system/com.cloudflare.cloudflared` (or whatever service name it's loaded under). Usually auto-recovers.

### 4. Mac went to sleep or the network bounced

**Fingerprint**: Server was healthy just before, healthy now, gap in the middle with no logs.

**Fix**: nothing — sleep/wake cycles and network interface bounces are transparent after Phase 1's frontend resilience work. Only a concern if recurring; consider `pmset` settings to prevent sleep (`sudo pmset -a disablesleep 1`).

### 5. Memory pressure

**Fingerprint**: `/health` shows `memory_rss_mb > 800` sustained; or `kernel_task` at high CPU in Activity Monitor.

**Check**: `ps -o pid,rss,command -ax | sort -k 2 -rn | head`

**Fix now**: `bin/rails restart`. Long-term: find the leak (long-running GoodJob? accumulating caches?) — capture a heap dump if it recurs.

## Restart procedure

**Soft restart (preferred)**:
```bash
ssh farley_station
cd ~/.garnish/backend
bin/rails restart
```

**Hard restart** (if `bin/rails restart` hangs or the process is wedged):
```bash
ssh farley_station
pkill -f 'puma'
cd ~/.garnish/backend
# Start Puma however it's launched in production (systemd-style launchd on macOS,
# or foreman/overmind). Check tmp/pids/server.pid and your launchd plist.
```

**Full redeploy** (latest main, runs migrations, restarts):
```bash
# From your dev machine:
scripts/deploy-backend.sh
```

## When to escalate

If the same symptom recurs within an hour, or `/health` stays red for more than 10 minutes, assume there's a real problem rather than a transient blip and dig into logs + `pg_stat_activity` before restarting reflexively — a restart will clear the symptom but hide the cause.
