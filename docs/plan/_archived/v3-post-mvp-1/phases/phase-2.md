# Phase 2: Backend Stability

> **Depends on:** Phase 1 (so users are already insulated from transient failures before we dig)
> **Enables:** Less-frequent need for the resilience framework added in Phase 1; a diagnosable pattern for future outages
>
> See: [Full Plan](../plan.md)

## Goal

Reduce how often the Rails backend becomes briefly unreachable on the MacBook Pro server. The user has observed intermittent windows (resolving in minutes) where the frontend shows the "oops" error state and sign-in also fails. Hypothesis: Puma worker/thread starvation from a combination of HTTP requests, ActionCable connections, and GoodJob workers contending for the same process. This phase is investigation-first, tuning-second, plus adding structured health logging so the next outage is diagnosable from the logs alone.

## Key Deliverables

### Sub-phase 2A — Diagnosis
- Capture current Puma configuration (`config/puma.rb`): worker count, thread count per worker, preload setting
- Capture current DB pool setting (`config/database.yml`): pool size and timeout
- Capture current GoodJob configuration: concurrency limits, threads per process, in-process vs. separate
- Capture ActionCable configuration: adapter (async confirmed), subscription/connection counts in practice
- Survey Rails logs from the MacBook for:
  - Recent `ActiveRecord::ConnectionTimeoutError`
  - Recent `Puma::ThreadPool` warnings ("worker is busy", etc.)
  - `Cannot acquire database connection`-type messages
  - Any `TIMEOUT` or OOM from the underlying macOS (check `Console.app` or `log show`)
- Check Cloudflare Tunnel logs (`cloudflared` logs on the server) for disconnects or reconnects

### Sub-phase 2B — Configuration Tuning
Based on 2A findings:

**Puma:**
- Likely action: increase worker count and/or threads per worker. Current defaults may be 1 worker × 5 threads, which is thin for an app that holds ActionCable connections.
- Target: 2–3 workers × 5 threads as starting point. Monitor RSS memory — MacBook is shared.
- If ActionCable is confirmed as worker-holder: consider `ActionCable.server.config.allow_same_origin_as_host`, connection limits, or separating Cable into its own process (see 2C).

**Database pool:**
- Pool size should cover: Puma threads × workers + GoodJob concurrency + Cable subscription workers. Rails default of 5 is almost certainly too low.
- Target: set pool to match `puma_workers * puma_threads + goodjob_concurrency + buffer` (probably 15–25).
- Set `checkout_timeout: 10` (up from default 5) to tolerate brief spikes.

**GoodJob:**
- Verify concurrency settings are reasonable (`max_threads`). Default of 5 is typically fine.
- Audit for any long-running or stuck jobs — the grocery-list generator, recipe import, or ingestion jobs might hold a worker during user-visible operations.

### Sub-phase 2C — Optional: Process Separation
If 2A confirms ActionCable starvation (many open subscriptions while HTTP requests queue), split into two processes:
- Web Puma (HTTP only, mounts ActionCable as a standalone app on a different port or URL prefix)
- ActionCable Puma or standalone Cable server

**Decide during 2A; skip if Puma tuning alone is sufficient.** Note: splitting adds deployment complexity on a single MacBook, so the bar for doing this is "tuning isn't enough."

### Sub-phase 2D — Structured Health Logging
- Add structured log entries at key points: request start/end with duration, Puma queue depth (via `Puma.stats` hook), cable connection open/close, GoodJob job start/end with duration
- Log rotation configured so logs don't fill the disk
- Lightweight `/health` endpoint returning: DB reachable (yes/no), GoodJob reachable (yes/no), Cable subscription count, Puma worker count, RSS memory. Returns 200 if all pass, 503 otherwise.
- A `scripts/check-health.sh` that curls `/health` and greps for issues — useful for cron or manual check-ins
- (Optional nice-to-have) Wire the `/health` endpoint into an external uptime monitor like UptimeRobot free tier; out of scope for this phase but documented in the runbook

### Sub-phase 2E — Runbook
- Write a short `docs/runbooks/backend-outage.md` with:
  - Symptoms users see
  - How to check the server from Tailscale (log location, `/health` command, `ps` to see puma workers)
  - Common causes and their fingerprints in the logs
  - Restart procedure (which matches the existing deploy pattern)

## Files to Create

- `backend/scripts/check-health.sh` — simple shell script curling `/health` and parsing output
- `backend/app/controllers/api/v1/health_controller.rb` — returns structured health JSON
- `docs/runbooks/backend-outage.md` — operational runbook

## Files to Modify

- `backend/config/puma.rb` — tune workers/threads based on 2A findings
- `backend/config/database.yml` — pool size and checkout timeout
- `backend/config/routes.rb` — add `/health` route (or `/up` if Rails 7.1+ default is already present; extend it)
- `backend/config/environments/production.rb` — structured log format if not already set
- `backend/config/initializers/good_job.rb` or equivalent — concurrency settings if they need adjustment
- (If 2C is pursued) `backend/config/cable.yml`, deploy scripts for the Cable process

## Dependencies

**Internal:** Phase 1 should be shipped so users tolerate the server being briefly unavailable while we restart for config changes.

**External:**
- `cloudflared` logs on the MacBook server (existing)
- Tailscale SSH (existing)
- No new gems anticipated

## Implementation Notes

### Getting Puma / DB Pool / GoodJob Current State

From a Tailscale SSH session on the MacBook server:

```bash
cd ~/garnish/backend
bundle exec puma -V
cat config/puma.rb
cat config/database.yml
ps aux | grep puma
# Check actual RSS memory per worker
ps -o pid,rss,command -p $(pgrep -f puma)

# GoodJob running state
bundle exec rails runner 'puts GoodJob::Configuration.new(:execution_mode).to_json'
```

### Puma Tuning Starting Point

```ruby
# config/puma.rb
workers ENV.fetch("WEB_CONCURRENCY") { 2 }.to_i
threads_count = ENV.fetch("RAILS_MAX_THREADS") { 5 }.to_i
threads threads_count, threads_count

preload_app!

on_worker_boot do
  ActiveRecord::Base.establish_connection if defined?(ActiveRecord)
end
```

Start with 2 workers × 5 threads; watch memory. If the MacBook server has headroom and we're still seeing timeouts, go to 3 workers. Don't exceed what RSS × workers fits comfortably in RAM.

### DB Pool Sizing Formula

```
pool_size = (puma_workers * puma_threads) + goodjob_max_threads + active_cable_worker_budget + buffer
```

For 2 Puma workers × 5 threads + 5 GoodJob threads + 5 Cable + 5 buffer = **25**. Set per-process in `database.yml`:

```yaml
production:
  <<: *default
  url: <%= ENV['DATABASE_URL'] %>
  pool: <%= ENV.fetch("RAILS_MAX_THREADS", 5).to_i + 10 %>
  checkout_timeout: 10
```

(The exact formula matters less than making it big enough. Connection slots on a local Postgres are cheap.)

### Health Controller Shape

```ruby
# app/controllers/api/v1/health_controller.rb
class Api::V1::HealthController < ApplicationController
  skip_before_action :authenticate_user!

  def show
    checks = {
      database: db_ok?,
      goodjob: goodjob_ok?,
      cable_subscriptions: ActionCable.server.connections.count,
      puma_stats: Puma.stats_hash rescue nil,
      memory_rss_mb: (`ps -o rss= -p #{Process.pid}`.to_i / 1024),
    }
    status = (checks[:database] && checks[:goodjob]) ? :ok : :service_unavailable
    render json: checks, status: status
  end

  private

  def db_ok?
    ActiveRecord::Base.connection.execute("SELECT 1")
    true
  rescue
    false
  end

  def goodjob_ok?
    GoodJob.configuration.execution_mode != :inline
  rescue
    false
  end
end
```

Route in `config/routes.rb`:

```ruby
namespace :api do
  namespace :v1 do
    get "/health", to: "health#show"
  end
end
```

Keep it unauthenticated — it's meant to be curled from anywhere.

### ActionCable Investigation

Key question for 2A: **how many active Cable connections are typical?**

```ruby
# Run on the server
bin/rails runner 'puts ActionCable.server.connections.count'
```

If this is low (< 5), the async adapter and in-process Cable are fine. If it's creeping into the teens or higher (multiple household members + phones + desktops), worker starvation becomes plausible and 2C enters the picture.

### Log Format

If not already structured, move to lograge or similar:

```ruby
# config/environments/production.rb
config.lograge.enabled = true
config.lograge.formatter = Lograge::Formatters::Json.new
config.lograge.custom_options = lambda do |event|
  { remote_ip: event.payload[:remote_ip], user_id: event.payload[:user_id] }
end
```

This makes log-greping for outage patterns tractable from the command line.

## Validation

- [ ] `config/puma.rb` committed with tuned worker/thread counts; rationale in a comment
- [ ] `config/database.yml` pool size covers all in-process consumers; rationale in a comment
- [ ] `/api/v1/health` endpoint returns JSON structure documented above; 200 healthy / 503 unhealthy
- [ ] `scripts/check-health.sh` runs locally, returns non-zero on failure
- [ ] `docs/runbooks/backend-outage.md` written with symptoms, diagnostic commands, restart procedure
- [ ] Deployed configuration verified from Tailscale: `ps` shows expected Puma workers; `/health` returns 200
- [ ] At least one simulated load test (e.g., `ab` or `hey` with concurrent requests + a phone on ActionCable) confirms no timeouts
- [ ] Structured logs capture request duration + user_id in production
- [ ] Decision on Sub-phase 2C (process separation) made and documented — either deferred or completed
