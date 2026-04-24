Rails.application.configure do
  config.active_job.queue_adapter = :good_job

  config.good_job.execution_mode = case Rails.env
                                   when "test" then :inline
                                   else             :async
                                   end

  config.good_job.queues = "*"
  config.good_job.max_threads = 5
  config.good_job.poll_interval = 10
  config.good_job.shutdown_timeout = 25
  config.good_job.preserve_job_records = true
  config.good_job.retry_on_unhandled_error = false

  # Cron runs only in environments with a live scheduler — skip in test (inline
  # mode) so it doesn't enqueue phantom jobs during specs.
  config.good_job.enable_cron = !Rails.env.test?
  config.good_job.cron = {
    tally_cooks: {
      cron: "0 2 * * *",
      class: "TallyCooksJob",
      description: "Nightly recompute of recipes.times_cooked and last_cooked_at from meal_plan_entries"
    }
  }
end
