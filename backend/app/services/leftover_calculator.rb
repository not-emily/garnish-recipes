class LeftoverCalculator
  attr_reader :servings, :diners

  def initialize(recipe:, household:, servings_override: nil, diners_override: nil)
    @servings = (servings_override || recipe.servings).to_i
    @diners = (diners_override || household.default_diners).to_i
  end

  def calculable?
    servings.positive? && diners.positive?
  end

  def meals_count
    return 0 unless calculable?
    servings / diners
  end

  def remaining_servings
    return 0 unless calculable?
    servings % diners
  end

  def has_full_leftover_meals?
    meals_count > 1
  end

  def has_partial_leftovers?
    remaining_servings.positive?
  end

  # Total leftover meals to offer in the prompt — everything after the
  # original meal.
  def suggested_leftover_count
    return 0 unless has_full_leftover_meals?
    meals_count - 1
  end
end
