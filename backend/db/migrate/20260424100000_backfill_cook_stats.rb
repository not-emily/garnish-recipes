class BackfillCookStats < ActiveRecord::Migration[8.1]
  # One-shot recompute of recipes.times_cooked and last_cooked_at from
  # meal_plan_entries. Phase 4C introduces TallyCooksJob to keep these
  # columns fresh against "plan-ahead-then-eat" cases that the
  # MealPlanEntry after_commit trigger can't see. Running the same
  # recompute now means Day 1 after deploy already reflects current
  # truth instead of waiting for the first 2am job run.
  #
  # Idempotent: same query used by TallyCooksJob. Re-running does no harm.
  def up
    execute <<~SQL
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

  def down
    # Data fix — no sensible rollback. Leaving as a no-op rather than
    # nulling out valid stats.
  end
end
