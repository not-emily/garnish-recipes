class MealPlan < ApplicationRecord
  belongs_to :household
  has_many :entries, -> { order(:date, :meal_slot, :position) },
           class_name: "MealPlanEntry", dependent: :destroy

  validates :week_start, presence: true
  validate :week_start_is_monday

  # Canonicalise any date to its Monday so callers can pass "today" and
  # get back the right plan without worrying about day-of-week math.
  def self.week_start_for(date)
    date = date.to_date
    date - ((date.wday - 1) % 7)
  end

  # Convenience — find the plan for a given week, creating it if necessary.
  # Meal plans are lazy: the first time anyone navigates to a week, we
  # materialize a row so entries have something to hang off.
  def self.for_week!(household:, week_start:)
    monday = week_start_for(week_start)
    find_or_create_by!(household: household, week_start: monday)
  end

  def week_end
    week_start + 6
  end

  private

  def week_start_is_monday
    return if week_start.blank?
    errors.add(:week_start, "must be a Monday") unless week_start.monday?
  end
end
