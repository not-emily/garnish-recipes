class MealPlanChannel < ApplicationCable::Channel
  def subscribed
    household = current_user.active_household
    unless household
      reject
      return
    end

    plan = MealPlan.for_week!(household: household, week_start: params[:week_start])
    stream_for plan
  rescue Date::Error, ArgumentError
    reject
  end
end
