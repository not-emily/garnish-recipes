# Puma configuration. See https://puma.io/puma/Puma/DSL.html for the DSL.
#
# Scale target: the MacBook Pro server runs Garnish for a friends-and-family
# household (typically < 20 concurrent users, < 30 open Cable connections).
# Tuning prioritises eliminating intermittent unavailability over raw throughput.
#
# Threads: 5 per worker. Higher than Rails default (3) so brief slow queries,
# GoodJob bookkeeping, and Cable handshakes don't starve one another under
# normal load. GVL + mostly-fast endpoints mean returns diminish above ~5.
threads_count = ENV.fetch("RAILS_MAX_THREADS", 5).to_i
threads threads_count, threads_count

# Workers: single process by default. Keeps memory footprint low on the shared
# MacBook. Set WEB_CONCURRENCY=2+ if observed load justifies it — memory per
# worker is ~200MB and each worker opens its own DB pool (pool size applies
# per process).
workers ENV.fetch("WEB_CONCURRENCY", 1).to_i

# Preload the app when running >1 worker so they share copy-on-write memory.
# Harmless when workers = 1.
preload_app!

# Port Puma listens on. Default 3000; prod uses 3000 behind Cloudflare Tunnel.
port ENV.fetch("PORT", 3000)

# Re-establish ActiveRecord connections in each forked worker. Required when
# preload_app! is set; the pool held by the parent is useless post-fork.
before_fork do
  ActiveRecord::Base.connection_pool.disconnect! if defined?(ActiveRecord)
end

on_worker_boot do
  ActiveRecord::Base.establish_connection if defined?(ActiveRecord)
end

# Allow puma to be restarted by `bin/rails restart` command.
plugin :tmp_restart

# Specify the PID file. Defaults to tmp/pids/server.pid in development.
# In other environments, only set the PID file if requested.
pidfile ENV["PIDFILE"] if ENV["PIDFILE"]
