class TallyCooksJob < ApplicationJob
  queue_as :default

  # Idempotent recompute of every recipe's cooking stats from the current
  # state of `meal_plan_entries`. Safe to run multiple times per day; safe
  # to miss runs during downtime — the next run always catches up because
  # it recomputes from the source of truth rather than incrementing.
  #
  # This fills the gap the MealPlanEntry after_commit trigger can't cover:
  # a future-dated entry whose date passes without the entry being deleted.
  # The trigger fires on create/destroy only, so "plan it Monday, eat it
  # Thursday, entry never deleted" would never be counted without this job.
  #
  # Only updates rows whose values actually changed, keeping the UPDATE
  # cheap when nothing has drifted.
  def perform
    ActiveRecord::Base.connection.execute(<<~SQL)
      UPDATE recipes
      SET
        times_cooked = COALESCE(subq.cnt, 0),
        last_cooked_at = subq.last_date
      FROM (
        SELECT r.id AS recipe_id,
               COUNT(e.*) AS cnt,
               MAX(e.date) AS last_date
        FROM recipes r
        LEFT JOIN meal_plan_entries e
          ON e.recipe_id = r.id
          AND e.is_leftover = false
          AND e.date <= CURRENT_DATE
        GROUP BY r.id
      ) subq
      WHERE recipes.id = subq.recipe_id
        AND (recipes.times_cooked IS DISTINCT FROM COALESCE(subq.cnt, 0)
          OR recipes.last_cooked_at IS DISTINCT FROM subq.last_date)
    SQL
  end
end
