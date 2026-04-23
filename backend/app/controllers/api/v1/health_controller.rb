module Api
  module V1
    # Richer health endpoint than Rails' default /up. Returns structured JSON
    # covering the subsystems most likely to fail on the MacBook server:
    # database reachability, GoodJob mode, ActionCable subscription count,
    # Puma pool stats, and resident memory. Used by scripts/check-health.sh
    # and can be wired into external uptime monitors.
    #
    # Unauthenticated by design — must be callable from anywhere without a
    # session, e.g. a cron job or UptimeRobot ping.
    class HealthController < ApplicationController
      def show
        db_ok = database_reachable?
        goodjob_mode = goodjob_execution_mode

        payload = {
          ok: db_ok && goodjob_mode != :inline_fallback,
          database: { reachable: db_ok, pool_size: db_pool_size, pool_busy: db_pool_busy },
          goodjob: { mode: goodjob_mode, max_threads: goodjob_max_threads },
          cable: { connection_count: cable_connection_count },
          puma: puma_stats,
          memory_rss_mb: rss_mb,
          version: commit_sha,
          timestamp: Time.current.iso8601
        }

        render json: payload, status: payload[:ok] ? :ok : :service_unavailable
      end

      private

      def database_reachable?
        ActiveRecord::Base.connection.execute("SELECT 1")
        true
      rescue StandardError
        false
      end

      def db_pool_size
        ActiveRecord::Base.connection_pool.size
      rescue StandardError
        nil
      end

      def db_pool_busy
        pool = ActiveRecord::Base.connection_pool
        pool.stat[:busy]
      rescue StandardError
        nil
      end

      def goodjob_execution_mode
        GoodJob.configuration.execution_mode
      rescue StandardError
        :inline_fallback
      end

      def goodjob_max_threads
        GoodJob.configuration.max_threads
      rescue StandardError
        nil
      end

      def cable_connection_count
        ActionCable.server.connections.size
      rescue StandardError
        nil
      end

      # Puma.stats isn't always available (e.g. under tests without Puma).
      # Wrap and return nil fields rather than failing the whole endpoint.
      def puma_stats
        return { available: false } unless defined?(Puma) && Puma.respond_to?(:stats_hash)

        stats = Puma.stats_hash
        {
          available: true,
          workers: stats[:workers],
          running: stats[:running],
          booted_workers: stats[:booted_workers],
          pool_capacity: stats[:pool_capacity],
          max_threads: stats[:max_threads],
          requests_count: stats[:requests_count]
        }
      rescue StandardError
        { available: false }
      end

      def rss_mb
        # /proc-less fallback for macOS — use `ps` against the current PID.
        kb = `ps -o rss= -p #{Process.pid} 2>/dev/null`.to_i
        return nil if kb.zero?
        (kb / 1024.0).round(1)
      rescue StandardError
        nil
      end

      def commit_sha
        ENV["GIT_COMMIT_SHA"] || Rails.application.config.x.git_sha
      rescue StandardError
        nil
      end
    end
  end
end
